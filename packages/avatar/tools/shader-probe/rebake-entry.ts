/**
 * The rebake shading A/B — doc 22 §6.3, §10.6.
 *
 * `tools/verify_runtime_bake.ts` proved the rebaked container reproduces the
 * authoring container's VERTICES: bit-exact at neutral, under 0.06 mm on
 * realistic poses, 0.33 mm with all nineteen channels at once, on a 341 mm
 * head. That proof is necessary and it is explicitly not sufficient, and the
 * spec says so: **shading reads normals.**
 *
 * A normal is a difference of neighbouring vertices divided by a small number.
 * A 0.06 mm displacement across a 2 mm triangle is a 0.03 radian tilt, and a
 * specular lobe is the most tilt-sensitive thing in the frame. So a vertex
 * error that reads as negligible in millimetres can read as a visible shift in
 * a highlight — which is exactly the failure the golden set exists to catch and
 * exactly the one nobody had looked for.
 *
 * This renders the SAME head from both containers, through the same material
 * and the same light rig, at several expressions, and hands the frame pairs
 * back for a perceptual diff. It is the shading half of the rebake's proof.
 *
 * WHAT IT PROVES AND WHAT IT DOES NOT. Same caveat as the rest of the probe:
 * WebGL2 over SwiftShader, because Playwright's Chromium has no WebGPU. That
 * makes this a comparison of two renders **on the same rasteriser**, which is
 * precisely what an A/B needs — both sides share every artefact of the software
 * path, so anything left in the diff is the container difference. It says
 * nothing about the absolute look, and it is not a golden.
 *
 * THE NORMALS ARE RECOMPUTED PER FRAME, deliberately, exactly as the runtime
 * does after `computeVertices`. Reusing the authoring container's normals for
 * both sides would compare the two meshes under one lighting solution and
 * quietly assume away the entire question.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §6.3, §10.6
 * SOT-KEYWORDS: rebake ab shading normals probe container diff verification identity expression
 */
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  PerspectiveCamera,
  RectAreaLight,
  Scene,
} from 'three';
import type { Sphere } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { GNMHeadModel, parseContainer } from '../../src/gnm/model.ts';
import { SkinNodeMaterial, SKIN_CURVATURE_ATTRIBUTE, SKIN_THICKNESS_ATTRIBUTE } from '../../src/materials/skin.ts';
import { initRectAreaLights } from '../../src/stage.ts';
import { encoderForContainer } from '../../src/speech/encoder.ts';
import type { ArkitMap, Shape } from '../../src/speech/track.ts';

export interface RebakePair {
  id: string;
  /** The frame from the 34.9 MB authoring container. */
  authoring: string | null;
  /** The frame from the 1.93 MB rebaked container. */
  rebaked: string | null;
  error: string | null;
}

/** The expressions to compare. Chosen to move different parts of the face. */
const CASES: { id: string; shape: Shape }[] = [
  { id: 'neutral', shape: {} },
  { id: 'jaw-open', shape: { jawOpen: 1 } },
  // A smile is the case that matters most: it moves the cheek, which is the
  // largest smooth specular surface on the face and the least forgiving of a
  // normal that has drifted.
  { id: 'smile', shape: { mouthSmileLeft: 0.9, mouthSmileRight: 0.9, cheekSquintLeft: 0.5, cheekSquintRight: 0.5 } },
  { id: 'surprise', shape: { browInnerUp: 1, eyeWideLeft: 0.8, eyeWideRight: 0.8, jawOpen: 0.4 } },
  // Everything at once — the worst case the vertex verifier measured (0.33 mm).
  { id: 'all-channels', shape: {} },
];

const SIZE = 256;

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.arrayBuffer();
}

function buildGeometry(model: GNMHeadModel, positions: Float32Array): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setIndex(Array.from(model.triangles));
  // THE POINT OF THE WHOLE EXERCISE. Recomputed from the vertices this
  // container produced, exactly as the runtime does — not shared between the
  // two sides, which would assume away the question being asked.
  geometry.computeVertexNormals();

  const count = model.numVertices;
  geometry.setAttribute(SKIN_CURVATURE_ATTRIBUTE, new BufferAttribute(new Float32Array(count).fill(0.5), 1));
  geometry.setAttribute(SKIN_THICKNESS_ATTRIBUTE, new BufferAttribute(new Float32Array(count).fill(0.4), 1));
  return geometry;
}

/** Lights placed relative to the head's own bounds, for the same reason as the camera. */
function rig(scene: Scene, centre: { x: number; y: number; z: number }, radius: number) {
  const key = new RectAreaLight(0xfff1e0, 14, radius, radius * 1.6);
  key.position.set(centre.x + radius * 1.6, centre.y + radius * 1.4, centre.z + radius * 2.4);
  key.lookAt(centre.x, centre.y, centre.z);
  const fill = new RectAreaLight(0xdce8ff, 5, radius * 1.4, radius * 1.4);
  fill.position.set(centre.x - radius * 2.2, centre.y + radius * 0.3, centre.z + radius * 2.0);
  fill.lookAt(centre.x, centre.y, centre.z);
  scene.add(key, fill);
}

export async function runRebakeAB(host: HTMLElement, base: string): Promise<RebakePair[]> {
  const [authoringBuffer, rebakedBuffer, arkitMap, identityDoc] = await Promise.all([
    fetchBuffer(`${base}/gnm/gnm_head_web.bin`),
    fetchBuffer(`${base}/gnm/gnm_head_runtime.bin`),
    fetch(`${base}/gnm/arkit-map.json`).then((r) => r.json() as Promise<ArkitMap>),
    fetch(`${base}/gnm/identity.json`).then((r) => r.json() as Promise<{ identity: number[] }>),
  ]);

  const sides = [
    { name: 'authoring', parsed: parseContainer(authoringBuffer) },
    { name: 'rebaked', parsed: parseContainer(rebakedBuffer) },
  ].map((side) => {
    const model = new GNMHeadModel(side.parsed.meta, side.parsed.sections);
    const encoder = encoderForContainer(
      {
        expressionDim: model.expressionDim,
        expressionNames: (side.parsed.meta as { expressionNames?: string[] }).expressionNames ?? [],
        bake: (side.parsed.meta as { bake?: { arkitChannels: number } }).bake,
      },
      arkitMap
    );
    // THE AUTHORING CONTAINER NEEDS THE FROZEN IDENTITY APPLIED. The rebaked
    // one has it folded into the template already — that is the whole point of
    // the rebake — so it gets nothing.
    //
    // Forgetting this is not a subtle error, it is a comparison of two
    // different faces, and it produces a large diff that does not vary with
    // expression. The first run of this A/B did exactly that: 2.55 % on every
    // case, identical to four decimal places, which is the signature of a
    // constant difference rather than a shading one. A number that does not
    // move when the input moves is measuring the wrong thing.
    if (model.identityDim > 0) {
      model.setIdentityVector(Float32Array.from(identityDoc.identity));
    }
    return { ...side, model, encoder };
  });

  const results: RebakePair[] = [];

  for (const testCase of CASES) {
    const frames: Record<string, string | null> = { authoring: null, rebaked: null };
    let error: string | null = null;

    try {
      for (const side of sides) {
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        host.appendChild(canvas);

        const renderer = new WebGPURenderer({ canvas, antialias: false, forceWebGL: true });
        await renderer.init();
        initRectAreaLights();
        renderer.setPixelRatio(1);
        renderer.setSize(SIZE, SIZE, false);

        const shape: Shape =
          testCase.id === 'all-channels'
            ? Object.fromEntries(arkitMap.names.map((n) => [n, 1]))
            : testCase.shape;
        side.model.setExpressionVector(side.encoder.encode(shape));

        const positions = new Float32Array(side.model.numVertices * 3);
        side.model.computeVertices(positions);

        const scene = new Scene();
        scene.background = new Color(0x101214);
        const mesh = new Mesh(
          buildGeometry(side.model, positions),
          new SkinNodeMaterial({ color: new Color(0x6b4432) })
        );
        scene.add(mesh);
        mesh.geometry.computeBoundingSphere();
        const sphere = mesh.geometry.boundingSphere as Sphere;
        rig(scene, sphere.center, sphere.radius);

        // FRAMED FROM THE ACTUAL BOUNDS, not from an assumption about where the
        // head sits. GNM model space is not centred on the origin, and a
        // hand-placed camera put the first run INSIDE the head — a blown-out
        // surface filling the top of frame and nothing below it. Deriving the
        // framing from the geometry costs three lines and cannot be wrong.
        mesh.geometry.computeBoundingSphere();
        const bounds = mesh.geometry.boundingSphere as Sphere;
        const camera = new PerspectiveCamera(26, 1, 0.001, 20);
        const distance = (bounds.radius * 1.35) / Math.tan((26 * Math.PI) / 360);
        camera.position.set(
          bounds.center.x + distance * 0.08,
          bounds.center.y + distance * 0.05,
          bounds.center.z + distance
        );
        camera.lookAt(bounds.center);

        renderer.render(scene, camera);
        renderer.render(scene, camera);
        frames[side.name] = canvas.toDataURL('image/png');

        mesh.geometry.dispose();
        renderer.dispose();
        canvas.remove();
      }
    } catch (thrown) {
      error = thrown instanceof Error ? `${thrown.message}\n${(thrown.stack ?? '').split('\n').slice(1, 5).join('\n')}` : String(thrown);
    }

    results.push({
      id: testCase.id,
      authoring: frames.authoring ?? null,
      rebaked: frames.rebaked ?? null,
      error,
    });
  }

  return results;
}

declare global {
  interface Window {
    __runRebakeAB: (host: HTMLElement, base: string) => Promise<RebakePair[]>;
  }
}

window.__runRebakeAB = runRebakeAB;

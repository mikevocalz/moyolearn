/**
 * The mouth cavity — doc 22 §4 row 7, first half.
 *
 * A mouth that opens without a darkening cavity reads as a *mask*: the teeth
 * and tongue are lit by the same key that lights the face, so the opening looks
 * like a picture of a mouth pasted onto a head rather than a hole in one. Real
 * cavities are dark because almost no light reaches them — the lips occlude
 * nearly the full hemisphere.
 *
 * The reference solved this with a baked per-vertex `aCavity` depth (0 at the
 * lip aperture, 1 at the back of the throat) and one line after
 * `<color_fragment>`:
 *
 *     diffuseColor.rgb *= mix(1.0, 0.10, smoothstep(0.0, 1.0, vCavity));
 *
 * which is a hand-authored occlusion term. It is cheap, it is stable under
 * animation, and no amount of screen-space AO would find it — GTAO cannot see
 * into a mouth that is two triangles wide on screen.
 *
 * PORT NOTE — `colorNode` REPLACES `<color_fragment>`, it does not follow it.
 * `<color_fragment>` is where vertex colours are multiplied in. These three
 * materials do **not** set `vertexColors`, so seeding from `materialColor` is
 * exact. If a mouth material ever gains vertex colours, this file must
 * multiply `attribute('color','vec3')` in by hand — the test asserts
 * `vertexColors === false` so that day fails loudly.
 *
 * `aCavity` is a **`Float32Array`, itemSize 1**, and must stay one: three.js
 * r185 cannot bind a single-component 8-bit attribute on WebGPU
 * (`WebGPUAttributeUtils` throws "Vertex format not supported yet"). See §4
 * row 2 — this is the same trap as `aCurvature`/`aThickness`.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 2, 7
 * SOT-KEYWORDS: mouth cavity teeth gums tongue darkening occlusion acavity colornode tsl
 */
import { MeshStandardNodeMaterial } from 'three/webgpu';
import type { Node } from 'three/webgpu';
import { attribute, materialColor, mix, smoothstep } from 'three/tsl';
import { BufferAttribute, Color } from 'three';

/** Per-vertex cavity depth: 0 at the lip aperture, 1 at the back. */
export const CAVITY_ATTRIBUTE = 'aCavity';

/** Full darkening at the back of the throat. 0.10 = one and a bit stops. */
export const CAVITY_FLOOR = 0.1;

type Float = Node<'float'>;
type Vec3 = Node<'vec3'>;
const asVec3 = (n: unknown): Vec3 => n as Vec3;
/**
 * `attribute()` is declared as `AttributeNode<string>` — the node type is a
 * runtime string upstream, so TypeScript cannot recover the swizzles or the
 * math operators from it. Narrowed once, here, at the boundary. Same gap as
 * `eyes.ts` and `hair.ts`; see doc 22 §4 row 3.
 */
const asFloat = (n: unknown): Float => n as Float;

/** Parsed `gnm/mouth-cavity.json` (`tools/bake_mouth_cavity.py`). */
export interface MouthCavity {
  identitySha256: string;
  apertureZ: number;
  backZ: number;
  count: number;
  indices: number[];
  depth: number[];
}

/**
 * The cavity attribute is **full head length**, inert (0) everywhere outside
 * the mouth, so the mouth meshes and the head mesh can share a vertex layout
 * and the same attribute can be bound to either without an index remap.
 */
export function buildCavityAttribute(
  cavity: MouthCavity,
  numVertices: number
): BufferAttribute {
  // Float32 on purpose — see the header. Do not "optimise" to Uint8.
  const values = new Float32Array(numVertices);
  for (let i = 0; i < cavity.indices.length; ++i) {
    const index = cavity.indices[i];
    const depth = cavity.depth[i];
    if (index === undefined || depth === undefined) continue;
    values[index] = depth;
  }
  return new BufferAttribute(values, 1);
}

/** The darkening term, as a node. Exported so the golden harness can graph it. */
export function cavityColorNode(): Vec3 {
  const depth = asFloat(attribute(CAVITY_ATTRIBUTE, 'float'));
  return asVec3(materialColor.mul(mix(1.0, CAVITY_FLOOR, smoothstep(0.0, 1.0, depth))));
}

export interface MouthMaterials {
  teeth: MeshStandardNodeMaterial;
  gums: MeshStandardNodeMaterial;
  tongue: MeshStandardNodeMaterial;
  ordered(): MeshStandardNodeMaterial[];
  dispose(): void;
}

function cavityMaterial(name: string, color: number, roughness: number) {
  const material = new MeshStandardNodeMaterial({ name, color: new Color(color), roughness, metalness: 0 });
  material.colorNode = cavityColorNode();
  return material;
}

export function makeMouthMaterials(): MouthMaterials {
  // The colours are the reference's and they are deliberate: teeth are a warm
  // pearly off-white and NEVER pure white (pure white teeth read as dentures),
  // and the gums/tongue are desaturated red-browns chosen to sit under a deep
  // complexion rather than the pink that reads correctly only on pale skin.
  const teeth = cavityMaterial('mouth-teeth', 0xf2ead8, 0.25);
  const gums = cavityMaterial('mouth-gums', 0x8c4a44, 0.4);
  const tongue = cavityMaterial('mouth-tongue', 0x9a5350, 0.35);

  return {
    teeth,
    gums,
    tongue,
    ordered: () => [teeth, gums, tongue],
    dispose() {
      teeth.dispose();
      gums.dispose();
      tongue.dispose();
    },
  };
}

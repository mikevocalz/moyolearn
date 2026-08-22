/**
 * Eyelashes — doc 22 §4 row 13.
 *
 * Alpha-card ribbons along the baked lid margins. `tools/bake_lash_lines.py`
 * emits, per eye, the upper and lower lid-margin polylines as VERTEX INDICES
 * into the head's streamed position attribute (inner canthus → outer). Each
 * polyline becomes a 3-row ribbon strip — base row sitting on the margin verts,
 * mid and tip rows extruded away from the eyeball — cut out of a strand texture
 * with `alphaTest`, so it reads as a fringe rather than a flap.
 *
 * The ribbons FOLLOW BLINKS. `update()` rebuilds every ribbon from the current
 * margin-vert positions after each `computeVertices`, and recomputes the
 * directions too, so the fringe tilts with the lid instead of intersecting it.
 * A few hundred verts — the cost is noise next to the head evaluation.
 *
 * WHAT CHANGED IN THE PORT, AND WHAT DID NOT.
 * The geometry is typed-array arithmetic with no DOM and no WebGL dependency,
 * so it ports unchanged. The ONE blocker was the texture: the reference painted
 * it at startup with `document.createElement('canvas')` and 120 strokes, and
 * React Native has no DOM canvas. That paint is now baked offline by
 * `tools/bake_lash_texture.mjs` and shipped as a PNG on the CDN — see that
 * file's header for why baking beats a canvas polyfill. `createLashes` takes
 * the loaded texture; it no longer knows how the texture was made.
 *
 * ON `noUncheckedIndexedAccess`: this file stays strict. Every loop bound is
 * derived from a length that `assertMarginBounds` has already checked against
 * the position array, so `at()` narrows once, at one place, with that reason
 * written down — rather than the file buying a project-wide exemption the way
 * `src/gnm/model.ts` and `src/conform/driver.ts` had to.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 13
 * SOT-KEYWORDS: lashes lash ribbon lid margin blink alphatest texture bake canthus
 */
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  DynamicDrawUsage,
  Mesh,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
} from 'three';
import type { Texture } from 'three';

/** Parsed `gnm/lash-lines.json` (`tools/bake_lash_lines.py`). */
export interface LashLines {
  identitySha256: string;
  eyes: { side: 'left' | 'right'; upper: number[]; lower: number[] }[];
}

/** Upper lashes are twice the length of lower ones, as they are on a face. */
export const UPPER_LENGTH = 0.007;
export const LOWER_LENGTH = 0.0035;
/** Base, mid, tip. Three rows is the minimum that can curl. */
export const ROWS = 3;
/** One texture tile per 2.5 mm of lid margin. */
export const TILE_METRES = 0.0025;

/**
 * The single narrowing point. TypeScript's `noUncheckedIndexedAccess` cannot
 * see that a typed-array index is in range, and every index below is derived
 * from a length `assertMarginBounds` has already validated. Checking once and
 * then indexing freely is both faster and more readable than 40 `as number`s.
 */
const at = (array: Float32Array, index: number): number => array[index] as number;

/**
 * Fails loudly at construction if any margin index would read past the end of
 * the head's position array — which is what a stale `lash-lines.json` against a
 * rebaked identity looks like. Without this the ribbons would silently fill
 * with `NaN` and the lashes would vanish, which is a miserable bug to chase.
 */
export function assertMarginBounds(lines: LashLines, vertexCount: number): void {
  for (const eye of lines.eyes) {
    for (const line of [eye.upper, eye.lower]) {
      if (line.length < 2) {
        throw new Error(`lash line on the ${eye.side} eye has fewer than 2 points`);
      }
      for (const index of line) {
        if (!Number.isInteger(index) || index < 0 || index >= vertexCount) {
          throw new Error(
            `lash margin index ${index} is out of range for ${vertexCount} head vertices — ` +
              'lash-lines.json is stale against the baked identity'
          );
        }
      }
    }
  }
}

/**
 * Applies the settings the baked PNG expects. Kept here rather than at the load
 * site so there is exactly one place that knows the texture's contract.
 */
export function configureLashTexture(texture: Texture): Texture {
  texture.colorSpace = SRGBColorSpace;
  // The strand tile repeats along the lid margin; v never leaves [0,1].
  texture.wrapS = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createLashMaterial(texture: Texture): MeshStandardNodeMaterial {
  return new MeshStandardNodeMaterial({
    name: 'lashes',
    map: configureLashTexture(texture),
    transparent: true,
    // A CUTOUT, not blending. Alpha-blended lashes need a depth sort that a
    // hundred interleaved ribbons will lose; alphaTest is order-independent.
    alphaTest: 0.35,
    side: DoubleSide,
    roughness: 0.55,
    metalness: 0,
  });
}

interface Ribbon {
  mesh: Mesh;
  /** Margin vert indices, inner → outer. */
  line: Uint32Array;
  /** ALL margin verts of this eye — the centroid is the eyeball estimate. */
  eye: Uint32Array;
  /** Full strand length in metres before the corner taper. */
  length: number;
  position: BufferAttribute;
  geometry: BufferGeometry;
}

export interface Lashes {
  meshes: Mesh[];
  material: MeshStandardNodeMaterial;
  /** Call after every `computeVertices` — rebuilds the ribbons from the lids. */
  update(positions: Float32Array): void;
  dispose(): void;
}

export function createLashes(
  lines: LashLines,
  positions: Float32Array,
  texture: Texture
): Lashes {
  assertMarginBounds(lines, positions.length / 3);
  const material = createLashMaterial(texture);

  const ribbons: Ribbon[] = [];
  for (const eye of lines.eyes) {
    const all = Uint32Array.from([...eye.upper, ...eye.lower]);
    for (const [source, length] of [
      [eye.upper, UPPER_LENGTH],
      [eye.lower, LOWER_LENGTH],
    ] as [number[], number][]) {
      const line = Uint32Array.from(source);
      const n = line.length;
      const position = new BufferAttribute(new Float32Array(n * ROWS * 3), 3);
      position.setUsage(DynamicDrawUsage);

      // u = rest arc length / tile; v = 0 at the base row, 1 at the tip row.
      // u is baked from the REST pose so the strand density does not breathe
      // as the lid stretches during a blink.
      const uv = new Float32Array(n * ROWS * 2);
      let arc = 0;
      for (let i = 0; i < n; ++i) {
        if (i > 0) {
          const a = (line[i - 1] as number) * 3;
          const b = (line[i] as number) * 3;
          arc += Math.hypot(
            at(positions, b) - at(positions, a),
            at(positions, b + 1) - at(positions, a + 1),
            at(positions, b + 2) - at(positions, a + 2)
          );
        }
        const u = arc / TILE_METRES;
        for (let r = 0; r < ROWS; ++r) {
          uv[(r * n + i) * 2] = u;
          uv[(r * n + i) * 2 + 1] = r / (ROWS - 1);
        }
      }

      const index: number[] = [];
      for (let r = 0; r < ROWS - 1; ++r) {
        for (let i = 0; i < n - 1; ++i) {
          const a = r * n + i;
          index.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
        }
      }

      const geometry = new BufferGeometry();
      geometry.setAttribute('position', position);
      geometry.setAttribute('uv', new BufferAttribute(uv, 2));
      geometry.setIndex(index);
      const mesh = new Mesh(geometry, material);
      // The ribbons are rebuilt every frame; a bounding sphere would be stale
      // and the cost of culling four small strips is not worth paying.
      mesh.frustumCulled = false;
      ribbons.push({ mesh, line, eye: all, length, position, geometry });
    }
  }

  const p = new Vector3();
  const centre = new Vector3();
  const tangent = new Vector3();
  const away = new Vector3();
  const forward = new Vector3();
  const dirBase = new Vector3();
  const dirTip = new Vector3();
  const scratch = new Vector3();

  const update = (pos: Float32Array) => {
    for (const ribbon of ribbons) {
      const { line, length } = ribbon;
      const n = line.length;

      // The eyeball centre is the centroid of the FULL margin ring, upper plus
      // lower. That is stable under a blink; the upper line alone is not.
      centre.set(0, 0, 0);
      for (const v of ribbon.eye) {
        centre.x += at(pos, v * 3);
        centre.y += at(pos, v * 3 + 1);
        centre.z += at(pos, v * 3 + 2);
      }
      centre.divideScalar(ribbon.eye.length);
      const xSign = Math.sign(centre.x) || 1;
      const out = ribbon.position.array as Float32Array;

      for (let i = 0; i < n; ++i) {
        const v = (line[i] as number) * 3;
        p.set(at(pos, v), at(pos, v + 1), at(pos, v + 2));
        const ia = (line[Math.max(0, i - 1)] as number) * 3;
        const ib = (line[Math.min(n - 1, i + 1)] as number) * 3;
        tangent
          .set(
            at(pos, ib) - at(pos, ia),
            at(pos, ib + 1) - at(pos, ia + 1),
            at(pos, ib + 2) - at(pos, ia + 2)
          )
          .normalize();
        away.copy(p).sub(centre).normalize();

        // margin tangent × radial = the fan direction. Forced to +z so both
        // eyes fan forwards regardless of which way the margin was wound.
        forward.crossVectors(tangent, away);
        if (forward.z < 0) forward.negate();
        forward.normalize();

        const outer = n > 1 ? i / (n - 1) : 0;
        // Taper toward BOTH corners, so the fringe ends rather than stopping.
        const taper = Math.min(1, Math.min(i, n - 1 - i) / 3 + 0.15);
        const len = length * taper;

        dirBase.copy(forward).addScaledVector(away, 0.45).normalize();
        dirTip
          .copy(forward)
          .multiplyScalar(0.35)
          .addScaledVector(away, 1.0) // curl away from the eyeball
          .add(scratch.set(xSign * 0.4 * outer, 0, 0)) // and outward, toward the outer canthus
          .normalize();

        out[i * 3] = p.x;
        out[i * 3 + 1] = p.y;
        out[i * 3 + 2] = p.z;

        const mid = (n + i) * 3;
        out[mid] = p.x + dirBase.x * len * 0.55;
        out[mid + 1] = p.y + dirBase.y * len * 0.55;
        out[mid + 2] = p.z + dirBase.z * len * 0.55;

        const tip = (2 * n + i) * 3;
        out[tip] = at(out, mid) + dirTip.x * len * 0.5;
        out[tip + 1] = at(out, mid + 1) + dirTip.y * len * 0.5;
        out[tip + 2] = at(out, mid + 2) + dirTip.z * len * 0.5;
      }

      ribbon.position.needsUpdate = true;
      ribbon.geometry.computeVertexNormals();
    }
  };
  update(positions);

  return {
    meshes: ribbons.map((r) => r.mesh),
    material,
    update,
    dispose() {
      for (const ribbon of ribbons) ribbon.geometry.dispose();
      material.dispose();
      // The texture is owned by the asset manager, not by us — it is shared
      // with the golden harness and any second avatar. Do not dispose it here.
    },
  };
}

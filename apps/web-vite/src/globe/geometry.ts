/**
 * Turns a `public/globe/continents-*.bin` into one `BufferGeometry` per
 * continent. No parsing, no triangulation, no topojson — the file is already
 * the vertex buffer, and this is a typed-array copy plus a dequantise.
 *
 * WHY TWO MATERIAL GROUPS AND NOT TWO MESHES. Each region's index buffer is
 * written top-face-first by the pipeline, so `addGroup(0, topIndexCount, 0)`
 * and `addGroup(topIndexCount, …, 1)` split one upload into a fill and an
 * outline. Two meshes would mean two geometries, two draw-call sets and a
 * second copy of the shared coastline vertices — for a border that is, by
 * construction, welded to the face it borders.
 *
 * ── THE OUTLINE TECHNIQUE ──────────────────────────────────────────────────
 * The dark stroke around every landmass is EDGE GEOMETRY: the swept side wall
 * of the extruded slab, built at build time from each polygon's boundary ring
 * and filled with `moyoOutline`. Its apparent thickness is the extrusion depth
 * (3.5% of the globe radius), so it holds at every camera angle and at every
 * zoom without a second pass.
 *
 * The two techniques it replaces, and why each loses:
 *
 *   `EdgesGeometry` + `LineBasicMaterial` — the obvious answer, and it cannot
 *   be thick. three.js documents the limit outright on
 *   `LineBasicMaterial.linewidth`: "Due to limitations of the OpenGL Core
 *   Profile with the WebGL renderer on most platforms linewidth will always be
 *   1 regardless of the set value."
 *   (https://threejs.org/docs/#api/en/materials/LineBasicMaterial.linewidth)
 *   A one-pixel hairline is the opposite of the brief's thick printed border.
 *   `Line2`/`LineMaterial` from `three/addons/lines/` does give screen-space
 *   width, at the cost of an instanced quad per segment plus ~15 kB of addon
 *   in the island chunk — for an effect the extrusion already produces.
 *
 *   Inverted (backface) hull — render the slab again, scaled up, with
 *   `side: THREE.BackSide`
 *   (https://threejs.org/docs/#api/en/materials/Material.side). It works on a
 *   compact object and fails here for a geometric reason: these slabs are
 *   shells centred on the globe's origin, so scaling one about that origin
 *   displaces it RADIALLY — outward, above the top face — rather than
 *   laterally. The "outline" would appear as a dark disc floating over the
 *   continent instead of a ring around its coast.
 *
 * SOT: apps/web-vite/scripts/build-globe-geometry.mjs
 *      apps/web-vite/src/globe/generated/manifest.ts
 *      node_modules/@types/three/src/core/BufferGeometry.d.ts:addGroup,setIndex
 * SOT-KEYWORDS: globe geometry loader binary decode buffergeometry groups outline
 *               edge geometry side wall extrusion linewidth backside hull
 */
import { BufferAttribute, BufferGeometry, Uint16BufferAttribute } from 'three';
import {
  GLOBE_HEADER_BYTES,
  GLOBE_LODS,
  GLOBE_MAGIC,
  GLOBE_POSITION_SCALE,
  type GlobeLodId,
  type GlobeRegionSlice,
} from './generated/manifest';

export interface RegionGeometry {
  readonly slice: GlobeRegionSlice;
  readonly geometry: BufferGeometry;
}

/** Material slots, in the order the scene passes them to `<mesh material={…}>`. */
export const FILL_MATERIAL_INDEX = 0;
export const OUTLINE_MATERIAL_INDEX = 1;

export async function loadRegionGeometries(
  lodId: GlobeLodId,
  signal?: AbortSignal,
): Promise<readonly RegionGeometry[]> {
  const lod = GLOBE_LODS[lodId];
  const response = await fetch(lod.url, { signal });
  if (!response.ok) throw new Error(`globe: ${lod.url} responded ${response.status}`);
  const buffer = await response.arrayBuffer();

  const header = new DataView(buffer);
  // A host that serves an SPA fallback for a missing asset returns 200 with an
  // HTML body, which would otherwise decode as several thousand nonsense
  // vertices and render as a spray of triangles. The magic turns that into an
  // error the tier switch can fall back from.
  if (buffer.byteLength < GLOBE_HEADER_BYTES || header.getUint32(0, true) !== GLOBE_MAGIC) {
    throw new Error(`globe: ${lod.url} is not a globe binary`);
  }
  const positionCount = header.getUint32(4, true);
  const indexCount = header.getUint32(8, true);

  const quantised = new Int16Array(buffer, GLOBE_HEADER_BYTES, positionCount);
  const indices = new Uint16Array(buffer, GLOBE_HEADER_BYTES + positionCount * 2, indexCount);

  // Dequantised on the CPU rather than declared as a `normalized` attribute:
  // 75 k multiplications is well under a millisecond, and a normalised
  // attribute leaves the raw integer range in the buffer, which
  // `computeBoundingSphere` and any future raycast would read at face value.
  const positions = Float32Array.from(quantised, (value) => value * GLOBE_POSITION_SCALE);

  return lod.regions.map((slice) => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new BufferAttribute(
        positions.subarray(slice.positionOffset, slice.positionOffset + slice.vertexCount * 3),
        3,
      ),
    );
    geometry.setIndex(
      new Uint16BufferAttribute(
        // Copied, not viewed: `setIndex` keeps the array alive for the lifetime
        // of the geometry and a view would pin the whole multi-megabyte source
        // buffer for the sake of one continent.
        indices.slice(slice.indexOffset, slice.indexOffset + slice.indexCount),
        1,
      ),
    );
    geometry.addGroup(0, slice.topIndexCount, FILL_MATERIAL_INDEX);
    geometry.addGroup(
      slice.topIndexCount,
      slice.indexCount - slice.topIndexCount,
      OUTLINE_MATERIAL_INDEX,
    );
    // Computed once here rather than lazily on first render: the lazy path runs
    // inside the frame that mounts the scene, which is the frame the fps probe
    // is about to measure.
    geometry.computeBoundingSphere();
    return { slice, geometry };
  });
}

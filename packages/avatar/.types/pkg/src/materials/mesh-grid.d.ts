/**
 * A uniform grid over a mesh's triangles, and exact ray queries against it.
 *
 * Extracted rather than copied. The thickness bake needed "how far to the far
 * surface along -normal" and the cavity bake needs "is the +normal ray blocked
 * at all"; those are the same broad phase and the same intersection test, and a
 * second copy is a second place for the self-hit rule and the stride handling
 * to drift.
 *
 * BROAD PHASE ONLY. The grid narrows which triangles a ray might meet and never
 * decides a distance — that comes from Möller-Trumbore. The distinction is not
 * academic: a march that reports the first occupied CELL quantises its answer
 * to the cell size, which on a 1.657 m body is 12.95 mm and collapsed the whole
 * thickness field onto seven values.
 *
 * SOT: ./skin-aux.ts · ./mouth-cavity.ts
 * SOT-KEYWORDS: mesh grid broad phase ray triangle moller trumbore occupancy bucket avatar bake
 */
import type { Geometry } from './skin-aux.ts';
export interface MeshGrid {
    readonly cell: number;
    /**
     * Distance to the first triangle the ray meets, or `Infinity`. Triangles
     * nearer than `epsilon` are skipped — an outward ray leaves through the
     * vertex's own faces, and they are not what it is looking for.
     */
    nearestHit(origin: readonly [number, number, number], direction: readonly [number, number, number], reach: number, epsilon: number): number;
}
export declare function buildMeshGrid(g: Geometry): MeshGrid;

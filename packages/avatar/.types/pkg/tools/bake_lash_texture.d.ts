export declare const WIDTH = 256;
export declare const HEIGHT = 128;
export declare const STRAND_COUNT = 120;
export declare const SEED = 1337;
/** The reference's PRNG, ported exactly. Every constant matters. */
export declare function mulberry32(seed: number): () => number;
/**
 * The 120 strands, drawn in the reference's exact order and with its exact
 * `rand()` call sequence. The ORDER OF THE CALLS IS THE SPEC: move one `rand()`
 * and every strand after it changes.
 */
export interface Strand {
    x0: number;
    tilt: number;
    yTop: number;
    alpha: number;
    lineWidth: number;
}
export declare function planStrands(): Strand[];
export declare function paint(): Uint8Array;
/**
 * Minimal RGBA8 PNG. Filter type 0 on every row and `level: 9` deflate, both
 * fixed — a "smarter" filter heuristic would make the bytes depend on the zlib
 * build, which is exactly what we are avoiding.
 */
export declare function encodePng(rgba: Uint8Array, width: number, height: number): Buffer;
export interface LashTextureManifest {
    name: string;
    width: number;
    height: number;
    seed: number;
    strands: number;
    supersample: number;
    segments: number;
    colorSpace: string;
    sha256: string;
}
export declare function bake(): {
    png: Buffer;
    manifest: LashTextureManifest;
};

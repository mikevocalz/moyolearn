// Portraits for the mock cast — real photographs of real faces.
//
// This replaced a generated-illustration set (DiceBear avataaars) on an explicit
// call: demo screens read as a toy when the people in them are cartoons, and the
// product is sold to districts by showing it to adults.
//
// randomuser.me serves stable, deterministic portrait URLs — the same index is
// always the same face — which is what a fixture needs. They are photographs of
// real people, licensed through UI Faces rather than granted by randomuser.me
// itself, so they are appropriate for development and demos and NOT for
// advertising, App Store screenshots, or anything else a model release would be
// required for. Swap the constants below for licensed stock before any of that.
//
// Indices are hand-picked rather than sequential: the set skews heavily white,
// and a roster that samples it in order comes out looking like one. The faces
// here were chosen by eye so the cast reads like a real district's staff and
// families.
// SOT-KEYWORDS: avatar portrait fixtures mock roster faces photographs representation

const BASE = 'https://randomuser.me/api/portraits';

/** A stable portrait. `n` indexes randomuser.me's fixed set (0–99 per gallery). */
export const portrait = (gallery: 'men' | 'women', n: number) => `${BASE}/${gallery}/${n}.jpg`;

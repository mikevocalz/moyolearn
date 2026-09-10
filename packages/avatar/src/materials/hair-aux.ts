/**
 * The two per-vertex scalars `hairSwayNode` reads, computed from the geometry
 * at load: `aHairT`, the root-to-tip parameter, and `aHairPhase`, the per-card
 * offset that stops the braids moving together.
 *
 * Neither had a producer. `positionNode` binds both, so the braid sway could
 * not run on the real body at all — a bound name the geometry does not carry is
 * a bind failure, not a fallback. The only code that had ever set them was the
 * shader probe, with `(i % 64) / 63` and a golden-angle spin over the raw
 * vertex index, which is a plausible-looking ramp across whatever order the
 * exporter happened to write and has nothing to do with any braid.
 *
 * THE CARDS COME FROM THE INDEX BUFFER, not from a naming convention. Hair is
 * one primitive of 27,534 vertices; a card is a connected component of it.
 * Measured on the shipped asset: 379 components, 42 to 82 vertices each, which
 * is a groom of separate braids rather than one welded shell.
 *
 * THE STRAND PARAMETER IS `TEXCOORD_0.v`, and that is measured rather than
 * assumed. Across all 379 cards |corr(uv.v, worldY)| is 0.975 while
 * |corr(uv.u, worldY)| is 0.044, so v runs along the braid and u across it. The
 * root end is the scalp end: every card puts its v=1 end at mean Y 1.641 m
 * against a crown at 1.654 m, and its v=0 end at 1.350 m. So t is 1 - v, and
 * because a card's v does not quite span the full 0..1 (0.933 on average) it is
 * renormalised per card — the sway pins the root with `smoothstep(0.08, 1.0, t)`
 * and a root sitting at t = 0.03 is a root that moves.
 *
 * Orientation is derived per card from geometry rather than hardcoded, so a
 * re-export that flips a UV island does not invert that card's braid. Where a
 * card lies flat enough that its two ends have no meaningful height difference,
 * it follows the majority of the groom instead of a coin toss.
 *
 * Cost, measured on the shipped groom rather than estimated: 9.8 ms for 27,534
 * vertices on an M-series Mac, once, at load. 379 cards, 379 distinct phases —
 * no hash collisions — with 18.6% of the groom inside the sway's pinned root
 * band and a mean t of 0.450.
 *
 * SOT: ./hair.ts · docs/pack/22-embodied-tutor-avatar-spec.md §4 rows 4-5
 * SOT-KEYWORDS: hair aux bake card connected component strand root tip phase uv braid sway
 */

import type { Geometry, VectorAttribute } from './skin-aux.ts';

/** Cards below this are stray triangles, not braids; they get a pinned root. */
const MIN_CARD_VERTICES = 6;
/** Height difference, in metres, below which a card's ends are not distinguishable. */
const FLAT_CARD_M = 0.005;

export interface HairGeometry extends Geometry {
  /** `TEXCOORD_0`. Only `getY` is read — `u` runs across the braid. */
  readonly uv: Pick<VectorAttribute, 'count' | 'getX' | 'getY'>;
}

/** A vec4 tangent per vertex: xyz direction, w the bitangent handedness. */
export type HairTangents = Float32Array;

export interface HairAux {
  /** 0 at the root, 1 at the tip. */
  readonly t: Float32Array;
  /** Radians, 0..2π, constant within a card. */
  readonly phase: Float32Array;
  /** How many connected components the index buffer yielded. */
  readonly cardCount: number;
}

/** Union-find with path halving; the components are the cards. */
function components(g: HairGeometry, count: number): Map<number, number[]> {
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i += 1) parent[i] = i;
  const find = (x: number): number => {
    let node = x;
    while (parent[node] !== node) {
      parent[node] = parent[parent[node]!]!;
      node = parent[node]!;
    }
    return node;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  const index = g.index;
  const triangles = index ? index.count : count;
  for (let t = 0; t + 2 < triangles; t += 3) {
    const a = index ? index.getX(t) : t;
    const b = index ? index.getX(t + 1) : t + 1;
    const c = index ? index.getX(t + 2) : t + 2;
    union(a, b);
    union(b, c);
  }
  const cards = new Map<number, number[]>();
  for (let v = 0; v < count; v += 1) {
    const root = find(v);
    const bucket = cards.get(root);
    if (bucket) bucket.push(v);
    else cards.set(root, [v]);
  }
  return cards;
}

/**
 * A phase from the card's own CENTROID rather than its ordinal.
 *
 * The ordinal depends on the order the exporter wrote the vertices, so a
 * re-export that reorders them would reshuffle every braid's phase and change
 * how the whole groom moves for no reason a reviewer could see. A centroid is a
 * property of the shape: the same braid gets the same phase across exports, and
 * two braids a centimetre apart get unrelated ones.
 */
function phaseFor(x: number, y: number, z: number): number {
  let h = 0x811c9dc5;
  for (const v of [x, y, z]) {
    // Tenth-millimetre quantisation, so float noise between exports cannot
    // change the hash while genuinely different cards still separate.
    let bits = Math.round(v * 10000) | 0;
    for (let byte = 0; byte < 4; byte += 1) {
      h ^= bits & 0xff;
      h = Math.imul(h, 0x01000193) >>> 0;
      bits >>>= 8;
    }
  }
  return (h / 0x100000000) * Math.PI * 2;
}

/**
 * Per-vertex tangents, by the standard UV-gradient method (Lengyel), averaged
 * over each vertex's triangles and Gram-Schmidt orthogonalised against the
 * normal.
 *
 * `hair.ts` sets `anisotropy: 0.88`, which routes BRDF_GGX through its
 * anisotropic branch, and its header says "the groom must keep authoring
 * tangents". No shipped asset carries TANGENT, so three has been falling back
 * to the screen-derivative frame the same header calls "wrong for hair".
 *
 * THE DIRECTION THIS PRODUCES IS ACROSS THE BRAID, NOT ALONG IT, and that is
 * correct rather than a bug to work around. A UV tangent points along +u by
 * definition, and on this groom u runs across the strand while v runs along it.
 * Measured on the shipped groom rather than argued from convention: the baked
 * tangent sits 0.6 degrees from the across-card edge and 83.5 degrees from the
 * along-strand edge, against a folded-random baseline of 57.3.
 *
 * Hair is anisotropic ALONG the fibre, so the material rotates the frame a
 * quarter turn — `hair.ts` sets `anisotropyRotation` to PI/2 for exactly this.
 * Expressing the hair-specific fact as a rotation of a standard frame beats
 * baking a non-standard one that every other consumer would have to know about.
 */
export function bakeHairTangents(g: HairGeometry): HairTangents {
  const count = g.position.count;
  const tan = new Float64Array(count * 3);
  const bit = new Float64Array(count * 3);
  const index = g.index;
  const triangles = index ? index.count : count;

  for (let t = 0; t + 2 < triangles; t += 3) {
    const a = index ? index.getX(t) : t;
    const b = index ? index.getX(t + 1) : t + 1;
    const c = index ? index.getX(t + 2) : t + 2;
    const e1x = g.position.getX(b) - g.position.getX(a);
    const e1y = g.position.getY(b) - g.position.getY(a);
    const e1z = g.position.getZ(b) - g.position.getZ(a);
    const e2x = g.position.getX(c) - g.position.getX(a);
    const e2y = g.position.getY(c) - g.position.getY(a);
    const e2z = g.position.getZ(c) - g.position.getZ(a);
    const du1 = g.uv.getX(b) - g.uv.getX(a);
    const dv1 = g.uv.getY(b) - g.uv.getY(a);
    const du2 = g.uv.getX(c) - g.uv.getX(a);
    const dv2 = g.uv.getY(c) - g.uv.getY(a);
    const det = du1 * dv2 - du2 * dv1;
    // A degenerate UV triangle has no frame to give; skipping it leaves the
    // vertex to its other triangles rather than poisoning them with infinities.
    if (Math.abs(det) < 1e-12) continue;
    const r = 1 / det;
    const tx = (e1x * dv2 - e2x * dv1) * r;
    const ty = (e1y * dv2 - e2y * dv1) * r;
    const tz = (e1z * dv2 - e2z * dv1) * r;
    const bx = (e2x * du1 - e1x * du2) * r;
    const by = (e2y * du1 - e1y * du2) * r;
    const bz = (e2z * du1 - e1z * du2) * r;
    for (const v of [a, b, c]) {
      tan[v * 3] = tan[v * 3]! + tx;
      tan[v * 3 + 1] = tan[v * 3 + 1]! + ty;
      tan[v * 3 + 2] = tan[v * 3 + 2]! + tz;
      bit[v * 3] = bit[v * 3]! + bx;
      bit[v * 3 + 1] = bit[v * 3 + 1]! + by;
      bit[v * 3 + 2] = bit[v * 3 + 2]! + bz;
    }
  }

  const out = new Float32Array(count * 4);
  for (let v = 0; v < count; v += 1) {
    const nx = g.normal.getX(v);
    const ny = g.normal.getY(v);
    const nz = g.normal.getZ(v);
    let tx = tan[v * 3]!;
    let ty = tan[v * 3 + 1]!;
    let tz = tan[v * 3 + 2]!;
    // Gram-Schmidt: the tangent must lie in the surface, not merely near it.
    const dot = nx * tx + ny * ty + nz * tz;
    tx -= nx * dot;
    ty -= ny * dot;
    tz -= nz * dot;
    let length = Math.sqrt(tx * tx + ty * ty + tz * tz);
    if (!(length > 1e-9)) {
      /*
        No usable frame — every triangle round this vertex was UV-degenerate.
        Any unit vector perpendicular to the normal keeps the frame valid, and a
        wrong-but-valid tangent on a stray vertex is a highlight in the wrong
        place, where a zero tangent is a black fragment.
      */
      const ax = Math.abs(nx) < 0.9 ? 1 : 0;
      const ay = ax === 1 ? 0 : 1;
      const along = ax * nx + ay * ny;
      tx = ax - nx * along;
      ty = ay - ny * along;
      tz = -nz * along;
      length = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
    }
    out[v * 4] = tx / length;
    out[v * 4 + 1] = ty / length;
    out[v * 4 + 2] = tz / length;
    // Handedness: does N x T agree with the accumulated bitangent?
    const cx = ny * tz - nz * ty;
    const cy = nz * tx - nx * tz;
    const cz = nx * ty - ny * tx;
    out[v * 4 + 3] =
      cx * bit[v * 3]! + cy * bit[v * 3 + 1]! + cz * bit[v * 3 + 2]! < 0 ? -1 : 1;
  }
  return out;
}

export function bakeHairAux(g: HairGeometry): HairAux {
  const count = g.position.count;
  const t = new Float32Array(count);
  const phase = new Float32Array(count);
  const cards = [...components(g, count).values()];

  /*
    The groom's own orientation, established before any card is written. Each
    card votes with the height difference between its v=1 and v=0 ends; the
    majority decides the flat cards, which have no opinion of their own.
  */
  let vote = 0;
  const ends = cards.map((vertices) => {
    let lowV = Infinity;
    let highV = -Infinity;
    let lowY = 0;
    let highY = 0;
    for (const v of vertices) {
      const uvV = g.uv.getY(v);
      if (uvV < lowV) {
        lowV = uvV;
        lowY = g.position.getY(v);
      }
      if (uvV > highV) {
        highV = uvV;
        highY = g.position.getY(v);
      }
    }
    if (vertices.length >= MIN_CARD_VERTICES && Math.abs(highY - lowY) > FLAT_CARD_M) {
      vote += highY > lowY ? 1 : -1;
    }
    return { lowV, highV, lowY, highY };
  });
  // True when v=1 is the scalp end, which is what the shipped groom measures.
  const majorityHighVIsRoot = vote >= 0;

  for (let c = 0; c < cards.length; c += 1) {
    const vertices = cards[c]!;
    const { lowV, highV, lowY, highY } = ends[c]!;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const v of vertices) {
      cx += g.position.getX(v);
      cy += g.position.getY(v);
      cz += g.position.getZ(v);
    }
    const cardPhase = phaseFor(cx / vertices.length, cy / vertices.length, cz / vertices.length);

    const flat = Math.abs(highY - lowY) <= FLAT_CARD_M;
    const highVIsRoot = flat || vertices.length < MIN_CARD_VERTICES ? majorityHighVIsRoot : highY > lowY;
    const span = highV - lowV;

    for (const v of vertices) {
      phase[v] = cardPhase;
      /*
        A card with no v extent is a degenerate island. Pinned at the root
        rather than left at 0-is-tip: an unresolvable card that does not move is
        a card nobody notices, and one that swings from its tip is not.
      */
      if (!(span > 1e-6)) {
        t[v] = 0;
        continue;
      }
      const normalised = (g.uv.getY(v) - lowV) / span;
      t[v] = highVIsRoot ? 1 - normalised : normalised;
    }
  }

  return { t, phase, cardCount: cards.length };
}

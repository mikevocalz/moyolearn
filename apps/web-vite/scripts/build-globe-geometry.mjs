#!/usr/bin/env node
/**
 * The globe geometry pipeline. Natural Earth 110m (via world-atlas topojson) →
 * flat-shaded, slightly extruded continent slabs on a sphere, written as two
 * LOD binaries plus a generated TypeScript manifest and a WebGL-free SVG
 * silhouette.
 *
 * This runs at BUILD TIME and never in a browser. The client fetches
 * `public/globe/*.bin` and uploads it straight to a BufferGeometry: no
 * topojson, no triangulation, no earcut and no 107 kB of source JSON ever
 * reaches a bundle. That is the decision ADR-002 records.
 *
 * Four non-obvious things happen here, each because the naive version is wrong:
 *
 * 1. ANTIMERIDIAN UNWRAP. Four rings in this file (Fiji, two Russian parts,
 *    Antarctica) step ±360° in longitude mid-ring. Triangulating them as-is
 *    produces a polygon that folds across the whole map. Unwrapping the ring
 *    into a continuous extended-longitude plane fixes it for free on a sphere,
 *    because lon → position is periodic: no splitting is needed, unlike on a
 *    flat projection.
 * 2. POLAR CLIP REPAIR. world-atlas is clipped at lat -85.609° (the Web
 *    Mercator limit, visible as `transform.translate[1]`). Left alone, the
 *    South Pole is a hole with ocean showing through the middle of Antarctica.
 *    Vertices at the clip latitude are snapped to -90°, closing the cap.
 * 3. DENSIFY → TRIANGULATE → REFINE. A triangle spanning 30° of arc chords
 *    ~3.4% of the radius below the sphere, which is comparable to the whole
 *    extrusion — the Sahara would sink into the ocean. Rings are densified
 *    first, then refined with a marked-edge (red/green) scheme whose midpoints
 *    come from a shared cache, so neighbouring triangles agree and no T-junction
 *    cracks appear.
 * 4. AUTO-ORIENTED TOP FACES. `ShapeUtils.triangulateShape` inherits the
 *    contour's winding, and Natural Earth is shapefile-derived (clockwise outer
 *    rings), not GeoJSON right-hand-rule. Each projected triangle is tested
 *    against its own outward radial and flipped if it faces inward, so
 *    backface culling can stay on for the fills.
 *
 * Colours are NOT emitted. Each region carries a token NAME (`moyoSun`,
 * `moyoLeaf`, …) and the scene resolves it from the live CSS custom property at
 * runtime, so the globe cannot drift from packages/theme/tokens.ts.
 *
 * Usage:
 *   node scripts/build-globe-geometry.mjs            write artefacts
 *   node scripts/build-globe-geometry.mjs --check    fail if artefacts are stale
 *
 * SOT: apps/web-vite/data/PROVENANCE.md · docs/site/adr-002-globe-geometry.md
 *      node_modules/@types/three/src/extras/ShapeUtils.d.ts:triangulateShape
 *      node_modules/topojson-client/src/feature.js:feature
 * SOT-KEYWORDS: globe geometry pipeline build-time topojson natural earth continents
 *               extrude triangulate refine antimeridian lod manifest silhouette tier
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ShapeUtils, Vector2 } from 'three';
import { feature } from 'topojson-client';

const APP = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(APP, 'data/world-atlas-countries-110m.json');
const OUT_BIN = join(APP, 'public/globe');
const OUT_TS = join(APP, 'src/globe/generated');

const CHECK = process.argv.includes('--check');

// ---------------------------------------------------------------------------
// Geometry constants. These are art direction, not tuning knobs — the ocean
// sphere is the unit sphere and every other radius is expressed against it.
// ---------------------------------------------------------------------------

/** The ocean sphere. Everything else is relative to this. */
const OCEAN_RADIUS = 1;
/**
 * How far a continent slab stands proud of the ocean. 3.5% of the radius reads
 * as a printed puzzle piece at the framing this chapter uses; below ~2% the
 * side wall stops being visible as a stroke and the outline disappears.
 */
const EXTRUDE = 0.035;
/**
 * The slab's underside, sunk BELOW the ocean rather than flush with it. Flush
 * would z-fight along every coastline, which on a flat-colour globe reads as
 * a shimmering fringe rather than as a bug.
 */
const INNER_RADIUS = 0.985;

const TOP_RADIUS = OCEAN_RADIUS + EXTRUDE;

/**
 * How far the slab's underside splays outward past its coastline, in degrees.
 * See the bevel note in `buildRegionMesh`: this is the width of the dark border
 * stroke, and it is the reason the outline reads on coasts facing away from the
 * camera. Only the part above OCEAN_RADIUS is visible — the rest is inside the
 * ocean sphere — so the band on screen is about 70% of this, ~0.55° or 60 km,
 * three or four pixels at the size the globe renders.
 */
const BEVEL_DEG = 0.8;

/** Web Mercator's clip latitude, which world-atlas inherits. See note 2 above. */
const CLIP_LAT = -85.60903777459771;

const DEG = Math.PI / 180;

/**
 * The two LODs. `hi` backs Tier A, `lo` backs Tier B — the tier system's
 * "reduced segment counts" is this table, resolved at build time, not a runtime
 * decimation pass.
 *
 * `simplify` is a Ramer–Douglas–Peucker tolerance in degrees: it removes real
 * coastline detail, which is the only thing that actually reduces triangle
 * count — densification alone cannot, and quantisation only halves the bytes.
 * `densify` then guarantees no ring segment is longer than that many degrees,
 * and `refine` splits interior edges until no chord exceeds the same arc; the
 * two have to agree or boundary edges get split and the side walls stop
 * matching the top face.
 *
 * The `hi` numbers are where the budget landed, not where fidelity did: 0.35°
 * is ~39 km of coastline tolerance, which is one to two pixels at the size this
 * globe renders and reads as deliberate stamping on a printed map. Halving it
 * to 0.15° adds 78 % more triangles and 74 kB gzipped for detail that is below
 * a pixel — measured, both renders compared side by side, recorded in ADR-002.
 */
const LODS = [
  { id: 'hi', simplify: 0.35, densify: 7, maxPasses: 8 },
  { id: 'lo', simplify: 0.9, densify: 11, maxPasses: 5 },
];

/**
 * Positions are quantised to Int16 over [-TOP_RADIUS, TOP_RADIUS] and indices
 * to Uint16, halving both blocks. The position error is TOP_RADIUS / 32767 ≈
 * 3.2e-5 of a unit sphere — at the ~600 px the globe renders, 0.01 of a pixel,
 * two orders of magnitude below anything visible. Coastline vertices shared
 * between a top face and its side wall come from the same `toSphere()` call, so
 * they quantise to the same integer and no hairline crack can open along a
 * coast.
 *
 * Uint16 indices are safe because indices are region-local and the largest
 * region is asserted below to stay under 65 536 vertices.
 */
const POSITION_QUANT = 32767;

// ---------------------------------------------------------------------------
// Region assignment.
// ---------------------------------------------------------------------------

/**
 * Country → continental region, by ISO 3166-1 numeric code (world-atlas puts it
 * on `geometry.id`), following the UN M49 continental regions: 002 Africa,
 * 019 Americas, 142 Asia, 150 Europe, 009 Oceania, plus Antarctica.
 *
 * Split into six regions and not four, even though Europe and Asia share a
 * fill: `focusRegion('europe')` has to be able to mean something different from
 * `focusRegion('asia')` for the motion agent, and merging them at build time
 * would make that unrecoverable.
 *
 * M49 files Russia under Europe, Turkey and Cyprus under Asia, Greenland under
 * Americas, and Kazakhstan under Asia. Those are the four assignments people
 * query; they are deliberate, and they are the standard's, not ours.
 *
 * The three `null`-id geometries (Kosovo, N. Cyprus, Somaliland) are
 * unrecognised-status territories with no ISO numeric code, so they are matched
 * by name.
 */
const REGIONS = [
  {
    id: 'africa',
    label: 'Africa',
    // Fixed publicly by docs/site/tokens.md: "moyoSun … Fixed publicly by the
    // globe chapter as the Africa block."
    fillToken: 'moyoSun',
    codes: [
      12, 24, 72, 108, 120, 140, 148, 178, 180, 204, 226, 231, 232, 262, 266, 270, 288, 324, 384,
      404, 426, 430, 434, 450, 454, 466, 478, 504, 508, 516, 562, 566, 624, 646, 686, 694, 706, 710,
      716, 728, 729, 732, 748, 768, 788, 800, 818, 834, 854, 894,
    ],
    names: ['Somaliland'],
  },
  {
    id: 'americas',
    label: 'North and Central America',
    fillToken: 'moyoEarth',
    codes: [
      44, 84, 188, 192, 214, 222, 304, 320, 332, 340, 388, 484, 558, 591, 630, 780, 840,
    ],
    names: [],
  },
  {
    /*
      South America and Canada are split out of `americas` to carry the identity
      pair — the Moyo mark's own teal and plum (`packages/theme/tokens.ts`). They
      are regions and not a special case in the material code because a region is
      already the unit of BOTH fill and `focusRegion()`; an exception list would
      have been a second way to colour a landmass.

      Their codes are UN M49 005 (South America) and 124, so the split follows the
      same standard the rest of the table does.
    */
    id: 'south-america',
    label: 'South America',
    fillToken: 'moyoMark',
    codes: [32, 68, 76, 152, 170, 218, 238, 328, 600, 604, 740, 858, 862],
    names: [],
  },
  {
    id: 'canada',
    label: 'Canada',
    fillToken: 'moyoMarkDeep',
    codes: [124],
    names: [],
  },
  {
    id: 'europe',
    label: 'Europe',
    fillToken: 'moyoLeaf',
    codes: [
      8, 40, 56, 70, 100, 112, 191, 203, 208, 233, 246, 250, 276, 300, 348, 352, 372, 380, 428, 440,
      442, 498, 499, 528, 578, 616, 620, 642, 643, 688, 703, 705, 724, 752, 756, 804, 807, 826,
    ],
    names: ['Kosovo'],
  },
  {
    id: 'asia',
    label: 'Asia',
    fillToken: 'moyoAsia',
    codes: [
      4, 31, 50, 51, 64, 96, 104, 116, 144, 156, 158, 196, 268, 275, 356, 360, 364, 368, 376, 392,
      398, 400, 408, 410, 414, 417, 418, 422, 458, 496, 512, 524, 586, 608, 626, 634, 682, 704, 760,
      762, 764, 784, 792, 795, 860, 887,
    ],
    names: ['N. Cyprus'],
  },
  {
    id: 'oceania',
    label: 'Oceania',
    fillToken: 'moyoEarth',
    codes: [36, 90, 242, 540, 548, 554, 598],
    names: [],
  },
  {
    // Cream, not a hue: the one landmass the composition reads as unmarked, and
    // the "cream inversion" the art direction allows. 15:1 against the outline
    // (docs/site/tokens.md contrast table), so the slab edge still reads.
    id: 'antarctica',
    label: 'Antarctica',
    fillToken: 'moyoPaperSunken',
    codes: [10, 260],
    names: [],
  },
];

/**
 * Polygon parts that sit on a different landmass from the country M49 files
 * them under. Keyed by a lon/lat box rather than by part index, because part
 * order is an artefact of the source file and would silently point at the wrong
 * island after a data update — a box either still contains a part or it does
 * not, and this script fails if it matches anything other than exactly one.
 *
 * Only one part at 110 m resolution is genuinely misplaced. Hawaii and Alaska
 * are far from the contiguous US but are still Americas; the Canary Islands are
 * below the 110 m threshold.
 */
const PART_OVERRIDES = [
  {
    country: 250,
    region: 'south-america',
    box: [-56, 1, -50, 7],
    reason: 'French Guiana — M49 files it under France (Europe); it renders on South America',
  },
];

// ---------------------------------------------------------------------------
// Small vector helpers. Plain arrays: this runs once, at build time, and a
// class hierarchy here would only make the algorithm harder to read.
// ---------------------------------------------------------------------------

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);

/**
 * lon/lat degrees → a point on a sphere of `radius`.
 *
 * The convention is fixed here and repeated in src/globe/projection.ts, which
 * must stay identical: +Y is north, and lon 0° faces +Z. That is what lets the
 * DOM node layer and the Tier C SVG project anchors without loading three.
 */
function toSphere(lon, lat, radius) {
  const phi = lat * DEG;
  const theta = lon * DEG;
  const c = Math.cos(phi);
  return [radius * c * Math.sin(theta), radius * Math.sin(phi), radius * c * Math.cos(theta)];
}

// ---------------------------------------------------------------------------
// Ring preparation.
// ---------------------------------------------------------------------------

/**
 * Remove the ±360° steps a ring takes when it crosses the antimeridian, leaving
 * a continuous polygon in an extended-longitude plane. Valid because the
 * projection is periodic in longitude — the extra turn disappears the moment
 * the ring is mapped onto a sphere.
 */
function unwrapLongitude(ring) {
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    const prev = out[i - 1][0];
    let lon = ring[i][0];
    while (lon - prev > 180) lon -= 360;
    while (lon - prev < -180) lon += 360;
    out.push([lon, ring[i][1]]);
  }
  return out;
}

/** Close the polar hole left by the source's Web Mercator clip. */
function repairPolarClip(ring) {
  let touched = 0;
  const out = ring.map(([lon, lat]) => {
    if (lat <= CLIP_LAT + 1e-6) {
      touched++;
      return [lon, -90];
    }
    return [lon, lat];
  });
  return { ring: out, touched };
}

/**
 * Ramer–Douglas–Peucker, iterative so a 554-point Antarctic ring cannot blow
 * the stack. Operates on the lon/lat plane; at these tolerances the difference
 * from a great-circle measure is far below the vertex spacing.
 *
 * The closing vertex is dropped before simplification and restored after, so
 * the ring stays closed and the first/last vertex can never be removed.
 */
function simplifyRing(ring, tolerance) {
  if (tolerance <= 0) return ring;
  const open = ring.slice(0, -1);
  if (open.length <= 4) return ring;

  const keep = new Uint8Array(open.length);
  keep[0] = 1;
  keep[open.length - 1] = 1;
  const stack = [[0, open.length - 1]];

  while (stack.length) {
    const [first, last] = stack.pop();
    if (last <= first + 1) continue;
    const [ax, ay] = open[first];
    const [bx, by] = open[last];
    const dx = bx - ax;
    const dy = by - ay;
    const norm = Math.hypot(dx, dy) || 1;
    let worst = -1;
    let worstAt = -1;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = open[i];
      const d = Math.abs(dy * (px - ax) - dx * (py - ay)) / norm;
      if (d > worst) {
        worst = d;
        worstAt = i;
      }
    }
    if (worst > tolerance) {
      keep[worstAt] = 1;
      stack.push([first, worstAt], [worstAt, last]);
    }
  }

  const kept = open.filter((_, i) => keep[i]);
  // A ring that collapses below a triangle is not a polygon any more; keep the
  // unsimplified version rather than emit degenerate geometry.
  if (kept.length < 3) return ring;
  return [...kept, kept[0]];
}

/**
 * Insert vertices so no segment exceeds `maxDeg` in the lon/lat plane. This is
 * what bounds the chord error of the side walls and, because planar distance
 * bounds angular distance, of every boundary edge in the triangulation too.
 */
function densifyRing(ring, maxDeg) {
  const out = [ring[0]];
  for (let i = 1; i < ring.length; i++) {
    const [ax, ay] = ring[i - 1];
    const [bx, by] = ring[i];
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / maxDeg);
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  }
  return out;
}

/** Twice the signed area of a lon/lat ring. Positive is counter-clockwise. */
function ringSignedArea(ring) {
  let acc = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    acc += a.x * b.y - b.x * a.y;
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Refinement.
// ---------------------------------------------------------------------------

/**
 * Marked-edge refinement on the sphere. Every edge longer than `maxChord` is
 * marked; a triangle with 1, 2 or 3 marked edges is split into 2, 3 or 4. The
 * midpoint of an edge comes from a cache keyed on its (sorted) endpoint
 * indices, so the two triangles sharing an edge place the midpoint at the same
 * vertex and no T-junction — and therefore no crack — can appear.
 *
 * Midpoints are normalised back onto the sphere, so refinement is what turns a
 * chorded polygon into a curved shell rather than just adding vertices.
 */
function refine(positions, tris, maxChord, radius, maxPasses) {
  const maxChordSq = maxChord * maxChord;
  const chordSq = (a, b) => {
    const ax = positions[a * 3];
    const ay = positions[a * 3 + 1];
    const az = positions[a * 3 + 2];
    return (
      (positions[b * 3] - ax) ** 2 +
      (positions[b * 3 + 1] - ay) ** 2 +
      (positions[b * 3 + 2] - az) ** 2
    );
  };

  for (let pass = 0; pass < maxPasses; pass++) {
    const cache = new Map();
    const midpoint = (a, b) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const x = (positions[a * 3] + positions[b * 3]) / 2;
      const y = (positions[a * 3 + 1] + positions[b * 3 + 1]) / 2;
      const z = (positions[a * 3 + 2] + positions[b * 3 + 2]) / 2;
      const s = radius / (Math.hypot(x, y, z) || 1);
      const index = positions.length / 3;
      positions.push(x * s, y * s, z * s);
      cache.set(key, index);
      return index;
    };

    const next = [];
    let split = false;

    for (let t = 0; t < tris.length; t += 3) {
      const v = [tris[t], tris[t + 1], tris[t + 2]];
      const marked = [
        chordSq(v[0], v[1]) > maxChordSq,
        chordSq(v[1], v[2]) > maxChordSq,
        chordSq(v[2], v[0]) > maxChordSq,
      ];
      const count = marked.reduce((n, m) => n + (m ? 1 : 0), 0);
      if (count === 0) {
        next.push(v[0], v[1], v[2]);
        continue;
      }
      split = true;

      // Rotate the triangle into the one canonical layout each case expects.
      // count === 1: the marked edge becomes (a, b).
      // count === 2: the UNMARKED edge becomes (c, a), so the marked pair is
      //              (a, b) and (b, c).
      let rot = 0;
      if (count === 1) rot = marked.indexOf(true);
      else if (count === 2) rot = (marked.indexOf(false) + 1) % 3;
      const a = v[rot];
      const b = v[(rot + 1) % 3];
      const c = v[(rot + 2) % 3];

      if (count === 1) {
        const m = midpoint(a, b);
        next.push(a, m, c, m, b, c);
      } else if (count === 2) {
        const m0 = midpoint(a, b);
        const m1 = midpoint(b, c);
        next.push(a, m0, c, m0, b, m1, m0, m1, c);
      } else {
        const m0 = midpoint(a, b);
        const m1 = midpoint(b, c);
        const m2 = midpoint(c, a);
        next.push(a, m0, m2, m0, b, m1, m2, m1, c, m0, m1, m2);
      }
    }

    tris = next;
    if (!split) break;
  }

  return tris;
}

// ---------------------------------------------------------------------------
// Mesh construction.
// ---------------------------------------------------------------------------

/**
 * One region's slab: a refined spherical top face plus a swept side wall per
 * ring, packed so that every top-face index precedes every side-wall index.
 * That ordering is the whole point — it lets the runtime declare two
 * BufferGeometry groups (fill, outline) over one index buffer instead of
 * uploading the slab twice.
 */
function buildRegionMesh(polygons, lod) {
  const positions = [];
  const topIndices = [];
  const sideIndices = [];

  // Boundary edges are already <= `densify` degrees, so the refinement
  // threshold must be the chord of that same angle: any looser and interior
  // edges stay too long, any tighter and the refiner starts splitting boundary
  // edges the side walls were built from.
  const maxChord = 2 * Math.sin((lod.densify * DEG) / 2) * 1.001;

  for (const polygon of polygons) {
    const rings = polygon.map((raw) => {
      const { ring } = repairPolarClip(unwrapLongitude(raw));
      return densifyRing(simplifyRing(ring, lod.simplify), lod.densify);
    });

    // --- top face -------------------------------------------------------
    // `triangulateShape` wants the contour open (no repeated closing vertex)
    // and returns index triples into contour ++ holes, in that order.
    // Real Vector2 instances, not the structural `Vector2Like` the .d.ts
    // advertises: `removeDupEndPts` inside `triangulateShape` calls `.equals()`
    // on the last point, so a plain `{x, y}` throws.
    const contour = rings[0].slice(0, -1).map(([x, y]) => new Vector2(x, y));
    const holes = rings.slice(1).map((r) => r.slice(0, -1).map(([x, y]) => new Vector2(x, y)));
    if (contour.length < 3) continue;

    const faces = ShapeUtils.triangulateShape(contour, holes);
    const flat = [...contour, ...holes.flat()];

    const localPositions = [];
    for (const p of flat) {
      localPositions.push(...toSphere(p.x, p.y, TOP_RADIUS));
    }

    const localTris = [];
    for (const [i, j, k] of faces) {
      // See note 4: Natural Earth's winding is not GeoJSON's, so orientation is
      // measured rather than assumed. The face normal must agree with the
      // outward radial at the face centre.
      const a = localPositions.slice(i * 3, i * 3 + 3);
      const b = localPositions.slice(j * 3, j * 3 + 3);
      const c = localPositions.slice(k * 3, k * 3 + 3);
      const n = cross(sub(b, a), sub(c, a));
      if (dot(n, a) < 0) localTris.push(i, k, j);
      else localTris.push(i, j, k);
    }

    const refined = refine(localPositions, localTris, maxChord, TOP_RADIUS, lod.maxPasses);

    // --- side walls -----------------------------------------------------
    // The extruded wall IS the outline (see the runtime material comment).
    // Every ring contributes one closed quad strip between TOP_RADIUS and
    // INNER_RADIUS. Rendered DoubleSide, so ring winding is irrelevant — which
    // is the second half of the same Natural-Earth-winding problem.
    //
    // The wall's TOP row is not stored: it reuses the triangulation's own
    // boundary vertices, which `triangulateShape` lays out as contour ++ holes
    // in ring order, so ring `r`'s vertex `i` is at `ringOffset[r] + i`. Only
    // the inner row is new. That removes a third of the vertex buffer (the
    // source is almost entirely coastline) and — the reason it is worth doing
    // at all — makes a crack between a slab's face and its own border
    // geometrically impossible rather than merely unlikely.
    //
    // Lengths come from the arrays AFTER `triangulateShape`, not from the
    // rings: `removeDupEndPts` pops a trailing duplicate in place, and an
    // offset computed from the ring would then be one out for every hole.
    const openRings = [contour, ...holes];
    const ringOffsets = [];
    let cursor = 0;
    for (const ring of openRings) {
      ringOffsets.push(cursor);
      cursor += ring.length;
    }

    const localSides = [];
    openRings.forEach((ring, r) => {
      const n = ring.length;
      if (n < 3) return;
      const top = ringOffsets[r];
      const inner = localPositions.length / 3;

      /*
        THE BEVEL — this is what turns the side wall into a border stroke.

        A straight vertical wall is only visible on the coasts whose wall faces
        the camera; a south-facing coast in the middle of the disc is hidden by
        the slab's own top face, so half of every continent renders with no
        outline. Splaying the BOTTOM row outward makes the slab a frustum, so a
        band of wall shows around the whole coastline from every angle — which
        is the "thick dark outline stroke" the brief asks for, at zero extra
        vertices, because these vertices already exist.

        `outward` needs the ring's orientation, which Natural Earth does not
        guarantee, so it is measured: the shoelace sign says which side of the
        direction of travel the interior lies on, and a hole's interior is the
        other way round from a contour's.

        The longitude component is divided by cos(lat) so the band has constant
        width on the sphere instead of pinching to nothing near the poles.
      */
      const sign = ringSignedArea(ring) >= 0 ? 1 : -1;
      const orient = (r === 0 ? 1 : -1) * sign;

      for (let i = 0; i < n; i++) {
        const prev = ring[(i - 1 + n) % n];
        const next = ring[(i + 1) % n];
        const lat = ring[i].y;
        const cosLat = Math.max(Math.cos(lat * DEG), 0.05);
        // Tangent across the vertex, measured on the sphere's surface rather
        // than in the lon/lat plane, so the normal is perpendicular to the
        // coastline and not to its projection.
        let tx = (next.x - prev.x) * cosLat;
        let ty = next.y - prev.y;
        const m = Math.hypot(tx, ty);
        if (m > 0) {
          tx /= m;
          ty /= m;
        }
        // Right-hand normal of the direction of travel, flipped by `orient`.
        const nx = (ty * orient * BEVEL_DEG) / cosLat;
        const ny = -tx * orient * BEVEL_DEG;
        localPositions.push(...toSphere(ring[i].x + nx, ring[i].y + ny, INNER_RADIUS));
      }

      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        localSides.push(top + i, inner + i, top + j, inner + i, inner + j, top + j);
      }
    });

    const base = positions.length / 3;
    positions.push(...localPositions);
    for (const idx of refined) topIndices.push(base + idx);
    for (const idx of localSides) sideIndices.push(base + idx);
  }

  return {
    positions: Float32Array.from(positions),
    indices: Uint32Array.from([...topIndices, ...sideIndices]),
    topIndexCount: topIndices.length,
  };
}

// ---------------------------------------------------------------------------
// Tier C silhouette: the same data, projected once, as SVG path data.
// ---------------------------------------------------------------------------

/**
 * Where the static composition sits. `YAW` is applied to the globe, so the
 * meridian that ends up facing the viewer is `-YAW` — 20°E, Africa, filling the
 * disc.
 *
 * `TILT` is positive (north tipped toward the viewer) and not negative, for a
 * concrete reason: at a southern tilt the South Pole sits fractionally in FRONT
 * of the horizon, inside the thin strip between Antarctica's visible coastline
 * and the disc edge that this projection closes with an arc. The pole then
 * renders as a small hole of ocean. Tipping north by 8° puts it behind the
 * horizon, where it costs nothing — and it is the conventional globe framing
 * anyway. The WebGL tiers do not share the problem (they carry real geometry),
 * but they share the angles so the three tiers are the same composition.
 */
const SILHOUETTE_YAW = 25;
const SILHOUETTE_TILT = 8;
/**
 * A round number the SVG viewBox is built from; nothing downstream reads px.
 * 1000 with integer coordinates gives 0.1% positional precision — finer than a
 * pixel at any size this renders, and roughly half the bytes of a one-decimal
 * path at 500.
 */
const SILHOUETTE_R = 1000;
/**
 * The silhouette is coarser than either WebGL LOD on purpose. It is an
 * art-directed print of the same composition, not a fallback that has to pass
 * for the real thing, and every degree of tolerance here is bytes in the
 * FIRST-PAINT chunk: Tier C is what the server renders, so this path data ships
 * twice — once in the prerendered HTML and once in the hydration bundle.
 */
const SILHOUETTE_SIMPLIFY = 1;
const SILHOUETTE_DENSIFY = 4;

/** lon/lat → the orthographic disc, mirroring src/globe/projection.ts exactly. */
function orthographic(lon, lat) {
  const [x, y, z] = toSphere(lon, lat, 1);
  // Yaw first, then tilt — the same order the scene applies to the globe group.
  const cy = Math.cos(SILHOUETTE_YAW * DEG);
  const sy = Math.sin(SILHOUETTE_YAW * DEG);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const ct = Math.cos(SILHOUETTE_TILT * DEG);
  const st = Math.sin(SILHOUETTE_TILT * DEG);
  const y2 = y * ct - z1 * st;
  const z2 = y * st + z1 * ct;
  return { x: x1, y: y2, z: z2 };
}

/**
 * Project one ring to the visible hemisphere. Vertices behind the horizon are
 * dropped, leaving one or more visible runs; each run is closed along the
 * horizon with an SVG elliptical arc, which in an orthographic projection is
 * exactly the disc edge rather than an approximation of it.
 *
 * Ring vertices are already <= `densify` degrees apart, so snapping a run's
 * endpoint to the horizon costs at most half that in angular error — invisible
 * at the size this asset renders, and cheaper than a great-circle intersection
 * solve for every crossing.
 */
function ringToPath(ring) {
  const pts = ring.map(([lon, lat]) => orthographic(lon, lat));
  const visible = pts.map((p) => p.z > 0);
  if (!visible.some(Boolean)) return '';

  const n = pts.length - 1; // the ring repeats its first vertex
  if (visible.every(Boolean)) {
    return `M${pts
      .slice(0, n)
      .map((p) => `${fmt(p.x * SILHOUETTE_R)},${fmt(-p.y * SILHOUETTE_R)}`)
      .join('L')}Z`;
  }

  // Rotate so the walk starts at the first vertex of a visible run.
  let start = -1;
  for (let i = 0; i < n; i++) {
    if (visible[i] && !visible[(i - 1 + n) % n]) {
      start = i;
      break;
    }
  }
  if (start === -1) return '';

  const runs = [];
  let current = null;
  for (let s = 0; s < n; s++) {
    const i = (start + s) % n;
    if (visible[i]) {
      if (!current) {
        current = [];
        runs.push(current);
      }
      current.push(pts[i]);
    } else {
      current = null;
    }
  }

  let d = '';
  for (const run of runs) {
    if (run.length < 2) continue;
    const first = run[0];
    const last = run[run.length - 1];
    // Push the endpoints out to the horizon so the closing arc starts and ends
    // on the disc; the arc command requires its endpoints to be on the ellipse.
    const a = onHorizon(first);
    const b = onHorizon(last);
    d += `M${fmt(a.x)},${fmt(a.y)}`;
    for (const p of run) d += `L${fmt(p.x * SILHOUETTE_R)},${fmt(-p.y * SILHOUETTE_R)}`;
    d += `L${fmt(b.x)},${fmt(b.y)}`;
    // Sweep 1 is the clockwise arc in SVG's y-down space. Runs are emitted in
    // ring order and ring order is normalised to outward-facing above, so the
    // hidden portion is always the clockwise side from `b` back to `a`.
    d += `A${SILHOUETTE_R},${SILHOUETTE_R} 0 0 1 ${fmt(a.x)},${fmt(a.y)}Z`;
  }
  return d;
}

function onHorizon(p) {
  const m = Math.hypot(p.x, p.y) || 1;
  return { x: (p.x / m) * SILHOUETTE_R, y: (-p.y / m) * SILHOUETTE_R };
}

const fmt = (n) => Math.round(n).toString();

// ---------------------------------------------------------------------------
// Drive.
// ---------------------------------------------------------------------------

const topology = JSON.parse(readFileSync(SOURCE, 'utf8'));
const collection = feature(topology, topology.objects.countries);

const regionOf = new Map();
for (const region of REGIONS) {
  for (const code of region.codes) regionOf.set(String(code), region.id);
  for (const name of region.names) regionOf.set(`name:${name}`, region.id);
}

/** region id → array of polygons, each polygon an array of lon/lat rings. */
const byRegion = new Map(REGIONS.map((r) => [r.id, []]));
const overrideHits = PART_OVERRIDES.map(() => []);
const unassigned = [];

for (const f of collection.features) {
  const key = f.id !== undefined && f.id !== null ? String(Number(f.id)) : `name:${f.properties.name}`;
  const home = regionOf.get(key);
  if (!home) {
    unassigned.push(`${f.id ?? '—'} ${f.properties.name}`);
    continue;
  }
  const parts = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const part of parts) {
    const outer = part[0];
    const lon = outer.reduce((s, c) => s + c[0], 0) / outer.length;
    const lat = outer.reduce((s, c) => s + c[1], 0) / outer.length;
    let target = home;
    PART_OVERRIDES.forEach((o, i) => {
      const [x0, y0, x1, y1] = o.box;
      if (Number(f.id) === o.country && lon >= x0 && lon <= x1 && lat >= y0 && lat <= y1) {
        target = o.region;
        overrideHits[i].push(`${f.properties.name} @ ${lon.toFixed(1)},${lat.toFixed(1)}`);
      }
    });
    byRegion.get(target).push(part);
  }
}

if (unassigned.length) {
  console.error(
    `build-globe-geometry: ${unassigned.length} countries have no region — the source data changed shape.\n  ${unassigned.join('\n  ')}`,
  );
  process.exit(1);
}
PART_OVERRIDES.forEach((o, i) => {
  if (overrideHits[i].length !== 1) {
    console.error(
      `build-globe-geometry: PART_OVERRIDES[${i}] (${o.reason}) matched ${overrideHits[i].length} parts, expected exactly 1.`,
    );
    process.exit(1);
  }
});

/** Area-weighted centroid on the sphere, used as the camera target for focusRegion(). */
function regionCentroid(polygons) {
  let acc = [0, 0, 0];
  let weight = 0;
  for (const polygon of polygons) {
    const ring = unwrapLongitude(polygon[0]);
    for (let i = 1; i < ring.length; i++) {
      const w = Math.abs(
        ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1],
      );
      const mid = toSphere((ring[i - 1][0] + ring[i][0]) / 2, (ring[i - 1][1] + ring[i][1]) / 2, 1);
      acc = [acc[0] + mid[0] * w, acc[1] + mid[1] * w, acc[2] + mid[2] * w];
      weight += w;
    }
  }
  if (weight === 0) return [0, 0];
  const v = [acc[0] / weight, acc[1] / weight, acc[2] / weight];
  const m = len(v) || 1;
  const lat = Math.asin(v[1] / m) / DEG;
  const lon = Math.atan2(v[0] / m, v[2] / m) / DEG;
  return [Math.round(lon * 10) / 10, Math.round(lat * 10) / 10];
}

const HEADER_BYTES = 16;
const MAGIC = 0x314c474d; // 'MGL1', little-endian

const artefacts = new Map();
const lodManifests = [];
const stats = [];

for (const lod of LODS) {
  const slices = [];
  const chunks = { positions: [], indices: [] };
  let vertexCursor = 0;
  let indexCursor = 0;

  for (const region of REGIONS) {
    const polygons = byRegion.get(region.id);
    const mesh = buildRegionMesh(polygons, lod);
    slices.push({
      id: region.id,
      label: region.label,
      fillToken: region.fillToken,
      centroid: regionCentroid(polygons),
      positionOffset: vertexCursor * 3,
      vertexCount: mesh.positions.length / 3,
      indexOffset: indexCursor,
      indexCount: mesh.indices.length,
      topIndexCount: mesh.topIndexCount,
    });
    // Indices stay LOCAL to their region so each slice can become its own
    // BufferGeometry without a rebasing pass on the main thread.
    chunks.positions.push(mesh.positions);
    chunks.indices.push(mesh.indices);
    vertexCursor += mesh.positions.length / 3;
    indexCursor += mesh.indices.length;
  }

  const widest = slices.reduce((n, s) => Math.max(n, s.vertexCount), 0);
  if (widest > 65535) {
    console.error(
      `build-globe-geometry: LOD "${lod.id}" has a region with ${widest} vertices; Uint16 indices top out at 65 535. Raise \`simplify\` or widen the index type.`,
    );
    process.exit(1);
  }

  const positionCount = vertexCursor * 3;
  const indexCount = indexCursor;
  const buffer = new ArrayBuffer(HEADER_BYTES + positionCount * 2 + indexCount * 2);
  const header = new DataView(buffer);
  header.setUint32(0, MAGIC, true);
  header.setUint32(4, positionCount, true);
  header.setUint32(8, indexCount, true);
  header.setUint32(12, 2, true); // format version — 2 is the quantised layout
  const positions = new Int16Array(buffer, HEADER_BYTES, positionCount);
  const indices = new Uint16Array(buffer, HEADER_BYTES + positionCount * 2, indexCount);
  const quant = POSITION_QUANT / TOP_RADIUS;
  let p = 0;
  let q = 0;
  for (const chunk of chunks.positions) {
    for (let i = 0; i < chunk.length; i++) positions[p + i] = Math.round(chunk[i] * quant);
    p += chunk.length;
  }
  for (const chunk of chunks.indices) {
    indices.set(chunk, q);
    q += chunk.length;
  }

  const bytes = new Uint8Array(buffer);
  artefacts.set(join(OUT_BIN, `continents-${lod.id}.bin`), bytes);
  lodManifests.push({ lod, slices, bytes: bytes.byteLength, positionCount, indexCount });
  stats.push({
    lod: lod.id,
    vertices: vertexCursor,
    triangles: indexCount / 3,
    kb: (bytes.byteLength / 1024).toFixed(1),
  });
}

// --- the Tier C silhouette, built from the `lo` LOD's ring preparation ------
const silhouette = REGIONS.map((region) => {
  let d = '';
  for (const polygon of byRegion.get(region.id)) {
    for (const raw of polygon) {
      const { ring } = repairPolarClip(unwrapLongitude(raw));
      d += ringToPath(densifyRing(simplifyRing(ring, SILHOUETTE_SIMPLIFY), SILHOUETTE_DENSIFY));
    }
  }
  return { id: region.id, fillToken: region.fillToken, d };
});

// --- generated TypeScript --------------------------------------------------

const header = (what, keywords) => `/**
 * ${what}
 *
 * GENERATED by apps/web-vite/scripts/build-globe-geometry.mjs — do not edit.
 * Re-run \`pnpm --filter web-vite globe:geometry\` after changing the source
 * data or the pipeline; \`pnpm --filter web-vite globe:check\` fails the build
 * if this file and the pipeline have drifted apart.
 *
 * SOT: apps/web-vite/scripts/build-globe-geometry.mjs · docs/site/adr-002-globe-geometry.md
 * SOT-KEYWORDS: ${keywords}
 */
`;

const manifestTs =
  header(
    'The globe geometry manifest: where each continent lives inside the LOD binaries, which theme token fills it, and where its camera target is.',
    'globe manifest generated lod region slice centroid token offsets',
  ) +
  `
/** Ocean sphere radius. Every other radius in the scene is relative to this. */
export const GLOBE_OCEAN_RADIUS = ${OCEAN_RADIUS};
/** How far a continent slab stands proud of the ocean. */
export const GLOBE_EXTRUDE = ${EXTRUDE};
/** The slab underside, deliberately sunk below the ocean to avoid coastline z-fighting. */
export const GLOBE_INNER_RADIUS = ${INNER_RADIUS};
/** Byte offset of the position block inside a \`.bin\`; the first 16 bytes are a header. */
export const GLOBE_HEADER_BYTES = ${HEADER_BYTES};
/** Little-endian magic at byte 0. A 404 page decodes to something else and is rejected. */
export const GLOBE_MAGIC = ${MAGIC};
/** Binary layout version at byte 12. 2 = Int16 positions + Uint16 region-local indices. */
export const GLOBE_FORMAT_VERSION = 2;
/**
 * Dequantisation factor: \`world = int16 * GLOBE_POSITION_SCALE\`. Positions are
 * stored as Int16 over [-TOP_RADIUS, TOP_RADIUS], which halves the asset for a
 * position error of ~3.2e-5 radii.
 */
export const GLOBE_POSITION_SCALE = ${TOP_RADIUS / POSITION_QUANT};

export type GlobeRegionId = ${REGIONS.map((r) => `'${r.id}'`).join(' | ')};
/**
 * The theme tokens the regions are filled with, as a closed union. Subset of
 * \`MoyoSceneToken\` in src/globe/theme-tokens.ts, and TypeScript proves it every
 * time \`colors[slice.fillToken]\` is written — a region whose token nobody reads
 * fails the build instead of rendering black.
 */
export type GlobeFillToken = ${[...new Set(REGIONS.map((r) => r.fillToken))].map((t) => `'${t}'`).join(' | ')};
export type GlobeLodId = ${LODS.map((l) => `'${l.id}'`).join(' | ')};

export interface GlobeRegionSlice {
  readonly id: GlobeRegionId;
  readonly label: string;
  /** A packages/theme token NAME. Resolved from live CSS at runtime, never baked. */
  readonly fillToken: GlobeFillToken;
  /** [lon, lat] in degrees — the point \`focusRegion()\` brings to the centre. */
  readonly centroid: readonly [number, number];
  readonly positionOffset: number;
  readonly vertexCount: number;
  readonly indexOffset: number;
  readonly indexCount: number;
  /** Indices [0, topIndexCount) are the fill; the remainder is the outline wall. */
  readonly topIndexCount: number;
}

export interface GlobeLod {
  readonly id: GlobeLodId;
  readonly url: string;
  readonly bytes: number;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly regions: readonly GlobeRegionSlice[];
}

export const GLOBE_LODS = {
${lodManifests
  .map(
    ({ lod, slices, bytes, positionCount, indexCount }) => `  ${lod.id}: {
    id: '${lod.id}',
    url: '/globe/continents-${lod.id}.bin',
    bytes: ${bytes},
    vertexCount: ${positionCount / 3},
    triangleCount: ${indexCount / 3},
    regions: [
${slices
  .map(
    (s) => `      {
        id: '${s.id}',
        label: '${s.label}',
        fillToken: '${s.fillToken}',
        centroid: [${s.centroid[0]}, ${s.centroid[1]}],
        positionOffset: ${s.positionOffset},
        vertexCount: ${s.vertexCount},
        indexOffset: ${s.indexOffset},
        indexCount: ${s.indexCount},
        topIndexCount: ${s.topIndexCount},
      },`,
  )
  .join('\n')}
    ],
  },`,
  )
  .join('\n')}
} as const satisfies Record<GlobeLodId, GlobeLod>;

/** Every region, in draw order, independent of which LOD is loaded. */
export const GLOBE_REGIONS = GLOBE_LODS.hi.regions;
`;

const silhouetteTs =
  header(
    'The Tier C globe: the same continents, projected orthographically once at build time, as SVG path data. No WebGL, no three, no geometry decode — the composition of the WebGL scene reduced to roughly 20 kB of `d` attributes.',
    'globe silhouette tier c static svg orthographic generated no-webgl fallback',
  ) +
  `
import type { GlobeFillToken, GlobeRegionId } from './manifest';

/** Globe yaw of the static composition, in degrees. The meridian facing the viewer is \`-SILHOUETTE_YAW\`. */
export const SILHOUETTE_YAW = ${SILHOUETTE_YAW};
/** Camera tilt of the static composition, in degrees. */
export const SILHOUETTE_TILT = ${SILHOUETTE_TILT};
/** Disc radius the path data is drawn against; the viewBox is derived from it. */
export const SILHOUETTE_RADIUS = ${SILHOUETTE_R};

export interface SilhouettePath {
  readonly id: GlobeRegionId;
  readonly fillToken: GlobeFillToken;
  readonly d: string;
}

export const SILHOUETTE_PATHS = [
${silhouette
  .map((s) => `  { id: '${s.id}', fillToken: '${s.fillToken}', d: '${s.d}' },`)
  .join('\n')}
] as const satisfies readonly SilhouettePath[];
`;

// Encoded rather than `Buffer.from`: this file is linted with the app's browser
// globals, where `Buffer` is undefined, and `TextEncoder` is the spelling both
// environments agree on.
const utf8 = new TextEncoder();
artefacts.set(join(OUT_TS, 'manifest.ts'), utf8.encode(manifestTs));
artefacts.set(join(OUT_TS, 'silhouette.ts'), utf8.encode(silhouetteTs));

// --- write or verify -------------------------------------------------------

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex').slice(0, 12);

if (CHECK) {
  const stale = [];
  for (const [path, bytes] of artefacts) {
    let onDisk;
    try {
      onDisk = readFileSync(path);
    } catch {
      stale.push(`${relative(APP, path)} — missing`);
      continue;
    }
    if (sha(onDisk) !== sha(bytes)) stale.push(`${relative(APP, path)} — ${sha(onDisk)} ≠ ${sha(bytes)}`);
  }
  if (stale.length) {
    console.error(
      `globe:check — ${stale.length} artefact(s) do not match a fresh conversion. Run \`pnpm --filter web-vite globe:geometry\`.\n  ${stale.join('\n  ')}`,
    );
    process.exit(1);
  }
  console.log(`globe:check — ${artefacts.size} artefacts match the pipeline.`);
} else {
  mkdirSync(OUT_BIN, { recursive: true });
  mkdirSync(OUT_TS, { recursive: true });
  for (const [path, bytes] of artefacts) writeFileSync(path, bytes);
  const svgBytes = silhouette.reduce((n, s) => n + s.d.length, 0);
  console.log('build-globe-geometry —');
  for (const s of stats) {
    console.log(`  ${s.lod}: ${s.vertices} vertices, ${s.triangles} triangles, ${s.kb} kB`);
  }
  console.log(`  silhouette: ${silhouette.length} paths, ${(svgBytes / 1024).toFixed(1)} kB of path data`);
  console.log(`  override applied: ${overrideHits.flat().join(', ')}`);
  for (const [path] of artefacts) console.log(`  wrote ${relative(APP, path)}`);
}

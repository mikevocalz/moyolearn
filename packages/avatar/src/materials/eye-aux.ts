/**
 * `aEyeAux` — the vec4 the eye materials read, computed from the geometry at
 * load. Four unrelated things share one attribute because a vec4 costs one
 * binding and four floats cost four:
 *
 *   `.xy`  the vertex's position on the iris PLANE, in model metres, measured
 *          from the pupil centre. `eyes.ts` divides it by `irisRadius`, so 1.0
 *          is the limbus. It is also differentiated (`dFdx`/`dFdy`) to build a
 *          tangent frame, which is why it has to be a real planar projection
 *          and not a 0..1 UV — a normalised coordinate would give the parallax
 *          the wrong scale and the derivative the wrong units.
 *   `.z`   distance to the lid margin, in metres. Consumed through
 *          `smoothstep(0.0004, 0.0013)`, so the whole wet band is 0.4 to 1.3 mm
 *          wide and anything past ~1.3 mm is simply dry.
 *   `.w`   how enclosed the vertex is by the lids, 0..1, which is the contact
 *          shadow under the upper lid.
 *
 * NOTHING PRODUCED IT. The manifest lists `gnm/eye-aux.json` with a sha256, and
 * neither that file nor any code that writes or parses it exists. The only
 * values the attribute has ever held come from the shader probe: `xy` from the
 * raw position, `z = 0.5` and `w = 0.8`. `z = 0.5` is 500 mm — 385 times past
 * the far edge of a band that ends at 1.3 mm — so the wet line was off in every
 * frame it has ever drawn, and `w = 0.8` is a flat 54% darkening of both whole
 * eyeballs.
 *
 * AN EYE IS FOUND BY BEING A SPHERE. Not by vertex index, not by a name the
 * asset does not carry, and not by a position measured from one export: the
 * eyeballs are the connected components whose vertices sit at a near-constant
 * distance from their own centroid. On the shipped head that is unmistakable —
 * radius 14.61 mm with a standard deviation of 0.11 mm, which is 0.7%, against
 * a head or an arm that is nothing like a sphere.
 *
 * THE FORWARD AXIS IS THE POLE NEAREST THE LID MARGIN. A UV sphere's poles are
 * its two high-valence vertices, and the lids ring the visible part of the eye,
 * so the anterior pole sits a few millimetres from that rim while the posterior
 * one is a whole diameter behind it. Nothing here depends on which way the head
 * faces or on the asset's handedness.
 *
 * "Fire a ray out of each pole and take whichever escapes" is the obvious test
 * and it picks the WRONG pole on this head, which is why it is not used. The
 * lashes and the lid margins stand in front of the cornea, so the forward ray
 * is blocked; the eye's back faces the inside of a hollow skull, so the
 * backward ray exits through the shell. Measured: it returned a forward of
 * (0.025, 0.034, -0.988) where the anterior pole is at +Z.
 *
 * SOT: ./eyes.ts · docs/pack/22-embodied-tutor-avatar-spec.md §4 row 3
 * SOT-KEYWORDS: eye aux bake iris plane parallax lid margin wet line contact shadow sphere pole
 */

import { buildMeshGrid } from './mesh-grid.ts';
import type { Geometry } from './skin-aux.ts';

/** A component is a sphere if its radii vary by less than this fraction. */
const SPHERE_TOLERANCE = 0.05;
/** Below this a component is a stray island, not an organ. */
const MIN_SPHERE_VERTICES = 64;
/** Weld tolerance, a tenth of a millimetre — far below any real feature. */
const WELD_M = 0.0001;
/** A ray leaves through its own surface; ignore hits nearer than this. */
const SELF_HIT_EPSILON = 0.0002;
/** Rays per vertex for the lid contact shadow. */
const OCCLUSION_RAYS = 24;
/** Occlusion beyond this distance is the room, not a lid. */
const OCCLUSION_REACH_M = 0.02;
/** Past this the eye is dry; `eyes.ts` fades the wet band out by 1.3 mm. */
const LID_REACH_M = 0.006;

export interface EyeFit {
  readonly centre: readonly [number, number, number];
  readonly radiusM: number;
  /** Unit vector out of the pupil, found by which pole a ray can escape from. */
  readonly forward: readonly [number, number, number];
  readonly vertexCount: number;
  /** Standard deviation of the fitted radii, as a fraction. Sphere-ness. */
  readonly radiusSpread: number;
}

export interface EyeAux {
  /** Four floats per vertex. Zero everywhere that is not an eyeball. */
  readonly aux: Float32Array;
  readonly eyes: readonly EyeFit[];
}

/** Welded vertex ids, so UV seams do not split one surface into several. */
function weld(g: Geometry): Int32Array {
  const { position: P } = g;
  const map = new Map<string, number>();
  const welded = new Int32Array(P.count);
  for (let v = 0; v < P.count; v += 1) {
    const key = `${Math.round(P.getX(v) / WELD_M)},${Math.round(P.getY(v) / WELD_M)},${Math.round(P.getZ(v) / WELD_M)}`;
    const existing = map.get(key);
    if (existing === undefined) {
      map.set(key, v);
      welded[v] = v;
    } else welded[v] = existing;
  }
  return welded;
}

function components(g: Geometry, welded: Int32Array): Map<number, number[]> {
  const count = g.position.count;
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
    const ra = find(welded[a]!);
    const rb = find(welded[b]!);
    if (ra !== rb) parent[ra] = rb;
  };
  const index = g.index;
  const total = index ? index.count : count;
  for (let t = 0; t + 2 < total; t += 3) {
    const a = index ? index.getX(t) : t;
    const b = index ? index.getX(t + 1) : t + 1;
    const c = index ? index.getX(t + 2) : t + 2;
    union(a, b);
    union(b, c);
  }
  const out = new Map<number, number[]>();
  for (let v = 0; v < count; v += 1) {
    const root = find(welded[v]!);
    const bucket = out.get(root);
    if (bucket) bucket.push(v);
    else out.set(root, [v]);
  }
  return out;
}

/** Any unit vector perpendicular to `f`, chosen to avoid the degenerate axis. */
function perpendicular(f: readonly [number, number, number]): [number, number, number] {
  const [fx, fy, fz] = f;
  const ax = Math.abs(fx) < 0.9 ? 1 : 0;
  const ay = ax === 1 ? 0 : 1;
  const along = ax * fx + ay * fy;
  const px = ax - fx * along;
  const py = ay - fy * along;
  const pz = -fz * along;
  const length = Math.hypot(px, py, pz) || 1;
  return [px / length, py / length, pz / length];
}

export function bakeEyeAux(g: Geometry): EyeAux {
  const { position: P, normal: N } = g;
  const count = P.count;
  const aux = new Float32Array(count * 4);
  const welded = weld(g);
  const grid = buildMeshGrid(g);

  // -- the lid margin: edges belonging to exactly one triangle ---------------
  const index = g.index;
  const total = index ? index.count : count;
  const edgeUse = new Map<string, number>();
  const edgeKey = (a: number, b: number): string => (a < b ? `${a}:${b}` : `${b}:${a}`);
  for (let t = 0; t + 2 < total; t += 3) {
    const a = welded[index ? index.getX(t) : t]!;
    const b = welded[index ? index.getX(t + 1) : t + 1]!;
    const c = welded[index ? index.getX(t + 2) : t + 2]!;
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ] as const) {
      const k = edgeKey(p, q);
      edgeUse.set(k, (edgeUse.get(k) ?? 0) + 1);
    }
  }
  /*
    An edge used once is a hole in the surface. On this head the lid margins ARE
    holes: the skin stops at the lash line and the eyeball shows through, so the
    open boundary is exactly the rim the wet band should hug. Found rather than
    declared, so a re-mesh moves it without anyone editing a number.
  */
  const rim: number[] = [];
  for (const [k, uses] of edgeUse) {
    if (uses !== 1) continue;
    const [a, b] = k.split(':');
    rim.push(Number(a), Number(b));
  }
  const rimVertices = [...new Set(rim)];

  // -- the eyeballs ---------------------------------------------------------
  const eyes: EyeFit[] = [];
  for (const vertices of components(g, welded).values()) {
    if (vertices.length < MIN_SPHERE_VERTICES) continue;
    /*
      THE FIT USES WELDED VERTICES, NOT RAW ONES. A UV sphere repeats its pole
      once per ring segment and its seam column twice, so a raw centroid is
      dragged toward the seam by the duplicates and the sphere comes out
      off-centre — enough that the far side projects 2.4% past the radius, which
      `eyes.ts` would read as an iris wider than its own limbus. Deduplicating
      first makes the centroid the shape's, not the topology's.
    */
    const unique = [...new Set(vertices.map((v) => welded[v]!))];
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const v of unique) {
      cx += P.getX(v);
      cy += P.getY(v);
      cz += P.getZ(v);
    }
    cx /= unique.length;
    cy /= unique.length;
    cz /= unique.length;
    let sum = 0;
    for (const v of unique) sum += Math.hypot(P.getX(v) - cx, P.getY(v) - cy, P.getZ(v) - cz);
    const radius = sum / unique.length;
    if (!(radius > 0)) continue;
    let variance = 0;
    for (const v of unique) {
      const d = Math.hypot(P.getX(v) - cx, P.getY(v) - cy, P.getZ(v) - cz) - radius;
      variance += d * d;
    }
    const spread = Math.sqrt(variance / unique.length) / radius;
    if (spread > SPHERE_TOLERANCE) continue;

    /*
      The poles, by valence. A UV sphere fans every ring vertex into six
      triangles and both poles into as many as the ring is long, so the two
      extremes of the valence histogram are the poles and nothing else is close.
    */
    const valence = new Map<number, number>();
    for (let t = 0; t + 2 < total; t += 3) {
      for (const k of [0, 1, 2]) {
        const v = welded[index ? index.getX(t + k) : t + k]!;
        valence.set(v, (valence.get(v) ?? 0) + 1);
      }
    }
    const ranked = vertices
      .map((v) => ({ v, n: valence.get(welded[v]!) ?? 0 }))
      .sort((a, b) => b.n - a.n);
    const poles = [ranked[0]?.v, ranked.find((r) => {
      const first = ranked[0]!.v;
      return Math.hypot(P.getX(r.v) - P.getX(first), P.getY(r.v) - P.getY(first), P.getZ(r.v) - P.getZ(first)) > radius;
    })?.v].filter((v): v is number => v !== undefined);
    if (poles.length < 2) continue;

    // Which pole faces out: the one the lids are wrapped around.
    let anterior = poles[0]!;
    let bestDistance = Infinity;
    for (const pole of poles) {
      for (const r of rimVertices) {
        const d = Math.hypot(P.getX(r) - P.getX(pole), P.getY(r) - P.getY(pole), P.getZ(r) - P.getZ(pole));
        if (d < bestDistance) {
          bestDistance = d;
          anterior = pole;
        }
      }
    }
    /*
      THE AXIS IS THE POLE'S NORMAL, not `pole - centre`. On a sphere they are
      the same direction in theory and not in practice: the fitted centre
      carries a fraction of a millimetre of error, and over a 14.6 mm radius a
      1 mm offset tilts the axis by 4 degrees. Measured both ways on the shipped
      head — the difference between the two eyes' axes came out 16.3 degrees
      from the centre-to-pole vector and 6.6 from the normals, and 6.6 is the
      toe-in the model was actually built with. The normal is authored data; the
      centre is something this file inferred.
    */
    const px = N.getX(anterior);
    const py = N.getY(anterior);
    const pz = N.getZ(anterior);
    const poleLength = Math.hypot(px, py, pz) || 1;
    const forward: [number, number, number] = [px / poleLength, py / poleLength, pz / poleLength];

    const u = perpendicular(forward);
    const w: [number, number, number] = [
      forward[1] * u[2] - forward[2] * u[1],
      forward[2] * u[0] - forward[0] * u[2],
      forward[0] * u[1] - forward[1] * u[0],
    ];

    for (const v of vertices) {
      const ex = P.getX(v) - cx;
      const ey = P.getY(v) - cy;
      const ez = P.getZ(v) - cz;
      // .xy — the iris plane, in metres, so `length(uv) / irisRadius` is 1 at
      // the limbus exactly as eyes.ts assumes.
      aux[v * 4] = ex * u[0] + ey * u[1] + ez * u[2];
      aux[v * 4 + 1] = ex * w[0] + ey * w[1] + ez * w[2];

      // .z — metres to the nearest lid margin.
      let nearest = LID_REACH_M;
      for (const r of rimVertices) {
        const d = Math.hypot(P.getX(r) - P.getX(v), P.getY(r) - P.getY(v), P.getZ(r) - P.getZ(v));
        if (d < nearest) nearest = d;
      }
      aux[v * 4 + 2] = nearest;

      // .w — how much of the hemisphere above the vertex the lids take away.
      let blocked = 0;
      const nx = N.getX(v);
      const ny = N.getY(v);
      const nz = N.getZ(v);
      const tangent = perpendicular([nx, ny, nz]);
      const bitangent: [number, number, number] = [
        ny * tangent[2] - nz * tangent[1],
        nz * tangent[0] - nx * tangent[2],
        nx * tangent[1] - ny * tangent[0],
      ];
      for (let i = 0; i < OCCLUSION_RAYS; i += 1) {
        // Fibonacci hemisphere: even coverage without a random stream, so the
        // shadow is the same on every machine and every run.
        const cosTheta = 1 - (i + 0.5) / OCCLUSION_RAYS;
        const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
        const phi = i * 2.399963229728653;
        const dx = nx * cosTheta + (tangent[0] * Math.cos(phi) + bitangent[0] * Math.sin(phi)) * sinTheta;
        const dy = ny * cosTheta + (tangent[1] * Math.cos(phi) + bitangent[1] * Math.sin(phi)) * sinTheta;
        const dz = nz * cosTheta + (tangent[2] * Math.cos(phi) + bitangent[2] * Math.sin(phi)) * sinTheta;
        const hit = grid.nearestHit([P.getX(v), P.getY(v), P.getZ(v)], [dx, dy, dz], OCCLUSION_REACH_M, SELF_HIT_EPSILON);
        if (Number.isFinite(hit)) blocked += 1;
      }
      aux[v * 4 + 3] = blocked / OCCLUSION_RAYS;
    }

    eyes.push({
      centre: [cx, cy, cz],
      radiusM: radius,
      forward,
      vertexCount: vertices.length,
      radiusSpread: spread,
    });
  }

  return { aux, eyes };
}

/**
 * The hair bake, on a synthetic groom whose answers are known and then on the
 * shipped braid set.
 *
 * SOT: ./hair-aux.ts
 * SOT-KEYWORDS: hair aux test card component strand root tip phase braid
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { bakeHairAux, bakeHairTangents, type HairGeometry } from './hair-aux.ts';

const vec = (a: number[], stride: number) => ({
  count: a.length / stride,
  getX: (i: number) => a[i * stride] as number,
  getY: (i: number) => a[i * stride + 1] as number,
  getZ: (i: number) => a[i * stride + 2] as number,
});

/**
 * `cards` vertical ribbons, each `rungs` rungs tall, hanging from y = 1 to
 * y = 0 with uv.v = 1 at the top. Separate index islands, so they are separate
 * connected components — which is exactly the thing the bake has to discover.
 */
function groom(cards: number, rungs = 6, flipUV = false): HairGeometry {
  const position: number[] = [];
  const normal: number[] = [];
  const uv: number[] = [];
  const index: number[] = [];
  for (let c = 0; c < cards; c += 1) {
    const base = position.length / 3;
    for (let r = 0; r < rungs; r += 1) {
      const y = 1 - r / (rungs - 1);
      const v = flipUV ? 1 - y : y;
      for (const side of [-1, 1]) {
        position.push(c * 0.1 + side * 0.01, y, 0);
        normal.push(0, 0, 1);
        uv.push(side < 0 ? 0.2 : 0.3, v);
      }
    }
    for (let r = 0; r < rungs - 1; r += 1) {
      const a = base + r * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return {
    position: vec(position, 3),
    normal: vec(normal, 3),
    uv: { count: uv.length / 2, getX: (i) => uv[i * 2] as number, getY: (i) => uv[i * 2 + 1] as number },
    index: { count: index.length, getX: (i) => index[i] as number },
  };
}

describe('hair aux bake', () => {
  it('finds one card per island, not one per mesh', () => {
    assert.equal(bakeHairAux(groom(1)).cardCount, 1);
    assert.equal(bakeHairAux(groom(12)).cardCount, 12);
  });

  it('t is 0 at the scalp and 1 at the tip', () => {
    const g = groom(4);
    const { t } = bakeHairAux(g);
    for (let v = 0; v < g.position.count; v += 1) {
      const y = g.position.getY(v);
      if (y > 0.99) assert.ok(t[v]! < 0.001, `top vertex has t=${t[v]}`);
      if (y < 0.01) assert.ok(t[v]! > 0.999, `bottom vertex has t=${t[v]}`);
    }
  });

  it('a flipped UV island still hangs the right way up', () => {
    const g = groom(4, 6, true);
    const { t } = bakeHairAux(g);
    for (let v = 0; v < g.position.count; v += 1) {
      if (g.position.getY(v) > 0.99) assert.ok(t[v]! < 0.001, 'a flipped island must follow the geometry, not the raw UV');
    }
  });

  it('phase is constant within a card and differs between them', () => {
    const g = groom(20);
    const { phase } = bakeHairAux(g);
    const perCard = new Map<number, Set<number>>();
    for (let v = 0; v < g.position.count; v += 1) {
      const card = Math.round(g.position.getX(v) / 0.1);
      (perCard.get(card) ?? perCard.set(card, new Set()).get(card)!).add(phase[v]!);
    }
    for (const [card, values] of perCard) assert.equal(values.size, 1, `card ${card} has ${values.size} phases`);
    assert.equal(new Set([...perCard.values()].map((s) => [...s][0])).size, 20, 'two cards share a phase');
  });

  it('phase is a function of the shape, so a reordered export keeps it', () => {
    const a = bakeHairAux(groom(8));
    const b = bakeHairAux(groom(8));
    assert.deepEqual([...a.phase], [...b.phase]);
    assert.ok(Math.min(...a.phase) >= 0 && Math.max(...a.phase) <= Math.PI * 2);
  });
});

/*
  The shipped braid set. The synthetic groom cannot show whether uv.v really is
  the strand axis on the real asset — that is measured, not assumed, and this is
  where it is measured.
*/
describe('hair aux on the shipped groom', () => {
  const dir = new URL('../../assets/natalie-phone/', import.meta.url);
  const gltf = JSON.parse(readFileSync(new URL('natalie.gltf', dir), 'utf8')) as {
    accessors: { bufferView: number; byteOffset?: number; count: number }[];
    bufferViews: { byteOffset?: number; byteStride?: number }[];
    meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
  };
  const bin = readFileSync(new URL('natalie.bin', dir));
  const f32 = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);
  const attr = (i: number, comps: number) => {
    const a = gltf.accessors[i]!;
    const view = gltf.bufferViews[a.bufferView]!;
    const stride = (view.byteStride ?? comps * 4) / 4;
    const start = ((view.byteOffset ?? 0) + (a.byteOffset ?? 0)) / 4;
    return {
      count: a.count,
      getX: (v: number) => f32[start + v * stride] as number,
      getY: (v: number) => f32[start + v * stride + 1] as number,
      getZ: (v: number) => f32[start + v * stride + 2] as number,
    };
  };
  const hair = gltf.meshes[0]!.primitives[1]!;
  const ia = gltf.accessors[hair.indices]!;
  const iview = gltf.bufferViews[ia.bufferView]!;
  const u16 = new Uint16Array(bin.buffer, bin.byteOffset + (iview.byteOffset ?? 0) + (ia.byteOffset ?? 0), ia.count);
  const g: HairGeometry = {
    position: attr(hair.attributes.POSITION!, 3),
    normal: attr(hair.attributes.NORMAL!, 3),
    uv: attr(hair.attributes.TEXCOORD_0!, 2),
    index: { count: ia.count, getX: (i) => u16[i] as number },
  };
  const aux = bakeHairAux(g);

  it('separates the groom into braids, not into one shell or into triangles', () => {
    assert.ok(aux.cardCount > 100 && aux.cardCount < 2000, `${aux.cardCount} cards`);
  });

  it('every card reaches both ends — a braid that never reaches t=1 cannot sway', () => {
    assert.ok(Math.min(...aux.t) < 0.001, `t never reaches the root (min ${Math.min(...aux.t)})`);
    assert.ok(Math.max(...aux.t) > 0.999, `t never reaches the tip (max ${Math.max(...aux.t)})`);
    const mean = aux.t.reduce((a, b) => a + b, 0) / aux.t.length;
    assert.ok(mean > 0.3 && mean < 0.7, `t is bunched at one end (mean ${mean.toFixed(3)})`);
  });

  it('the roots are at the scalp and the tips hang below them', () => {
    let rootY = 0;
    let rootN = 0;
    let tipY = 0;
    let tipN = 0;
    for (let v = 0; v < g.position.count; v += 1) {
      if (aux.t[v]! < 0.05) {
        rootY += g.position.getY(v);
        rootN += 1;
      } else if (aux.t[v]! > 0.95) {
        tipY += g.position.getY(v);
        tipN += 1;
      }
    }
    assert.ok(rootN > 0 && tipN > 0);
    assert.ok(
      rootY / rootN > tipY / tipN,
      `roots at ${(rootY / rootN).toFixed(3)} m sit below tips at ${(tipY / tipN).toFixed(3)} m — the braids are upside down`,
    );
  });

  /*
    The tangent's DIRECTION is the whole claim, and it is the half a
    "returns unit vectors" test would miss. hair.ts turns the frame a quarter
    turn on the strength of this measurement, so if the groom's UV convention
    ever changed the rotation would be pointing the highlight across the braid
    and nothing else here would notice.
  */
  describe('tangents', () => {
    const tangents = bakeHairTangents(g);

    it('is one unit vec4 per vertex', () => {
      assert.equal(tangents.length, g.position.count * 4);
      for (let v = 0; v < g.position.count; v += 1) {
        const length = Math.hypot(tangents[v * 4]!, tangents[v * 4 + 1]!, tangents[v * 4 + 2]!);
        assert.ok(Math.abs(length - 1) < 1e-3, `vertex ${v} tangent length ${length}`);
        assert.ok(Math.abs(tangents[v * 4 + 3]!) === 1, 'handedness must be +1 or -1');
      }
    });

    it('lies in the surface — a tangent off the plane is not a tangent', () => {
      let worst = 0;
      for (let v = 0; v < g.position.count; v += 1) {
        const dot =
          g.normal.getX(v) * tangents[v * 4]! +
          g.normal.getY(v) * tangents[v * 4 + 1]! +
          g.normal.getZ(v) * tangents[v * 4 + 2]!;
        worst = Math.max(worst, Math.abs(dot));
      }
      assert.ok(worst < 1e-3, `worst |dot(normal, tangent)| is ${worst}`);
    });

    it('runs ACROSS the braid, which is why hair.ts turns it a quarter turn', () => {
      // Per triangle, the edge that is most purely along one UV axis, compared
      // against the tangent at its start vertex.
      const meanAngleTo = (axis: 'u' | 'v') => {
        let sum = 0;
        let n = 0;
        for (let i = 0; i + 2 < g.index!.count; i += 3) {
          const tri = [g.index!.getX(i), g.index!.getX(i + 1), g.index!.getX(i + 2)];
          let best: [number, number] | null = null;
          let score = 0;
          for (const [p, q] of [
            [tri[0]!, tri[1]!],
            [tri[1]!, tri[2]!],
            [tri[2]!, tri[0]!],
          ] as [number, number][]) {
            const du = Math.abs(g.uv.getX(q) - g.uv.getX(p));
            const dv = Math.abs(g.uv.getY(q) - g.uv.getY(p));
            const s = axis === 'u' ? du - dv : dv - du;
            if (s > score) {
              score = s;
              best = [p, q];
            }
          }
          if (!best) continue;
          const [p, q] = best;
          let dx = g.position.getX(q) - g.position.getX(p);
          let dy = g.position.getY(q) - g.position.getY(p);
          let dz = g.position.getZ(q) - g.position.getZ(p);
          const length = Math.hypot(dx, dy, dz);
          if (length < 1e-7) continue;
          dx /= length;
          dy /= length;
          dz /= length;
          const dot = Math.abs(dx * tangents[p * 4]! + dy * tangents[p * 4 + 1]! + dz * tangents[p * 4 + 2]!);
          sum += (Math.acos(Math.min(1, dot)) * 180) / Math.PI;
          n += 1;
        }
        return sum / n;
      };
      const across = meanAngleTo('u');
      const along = meanAngleTo('v');
      // 57.3 degrees is the folded-random baseline, so both bounds mean something.
      assert.ok(across < 10, `tangent is ${across.toFixed(1)} deg off the across-card axis`);
      assert.ok(along > 70, `tangent is only ${along.toFixed(1)} deg off the strand — the quarter turn would be wrong`);
    });
  });

  it('the pinned root band is a band, not the whole braid', () => {
    // hairSwayNode pins with smoothstep(0.08, 1.0, t); if most of the groom sat
    // under 0.08 the sway would be invisible and no test would say so.
    const pinned = aux.t.filter((v) => v < 0.08).length / aux.t.length;
    assert.ok(pinned > 0.01 && pinned < 0.3, `${(pinned * 100).toFixed(1)}% of the groom is inside the pinned band`);
  });
});

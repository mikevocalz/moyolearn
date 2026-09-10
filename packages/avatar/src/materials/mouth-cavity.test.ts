/**
 * The cavity bake, on a slot whose depth is known by construction and then on
 * the shipped head.
 *
 * SOT: ./mouth-cavity.ts
 * SOT-KEYWORDS: mouth cavity test depth geodesic aperture jawOpen slot lining
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { bakeMouthCavity, type MouthGeometry } from './mouth-cavity.ts';

const vec3 = (a: number[]) => ({
  count: a.length / 3,
  getX: (i: number) => a[i * 3] as number,
  getY: (i: number) => a[i * 3 + 1] as number,
  getZ: (i: number) => a[i * 3 + 2] as number,
});

/**
 * Two plates 1 cm apart facing each other, `rungs` rungs long. Their outward
 * normals point across the gap, so every vertex's +normal ray is blocked — the
 * occlusion half is satisfied everywhere, which is deliberate: it leaves
 * `jawOpen` as the only thing deciding where the lining starts, so the aperture
 * this produces is the one the boundary rule found and not one the fixture
 * handed over.
 */
function slot(rungs = 20, openRungs = 5): MouthGeometry {
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  const jawOpen: number[] = [];
  for (const [z, nz] of [
    [0, 1],
    [0.01, -1],
  ] as const) {
    const base = position.length / 3;
    for (let r = 0; r < rungs; r += 1) {
      for (const side of [-0.02, 0.02]) {
        position.push(side, r * 0.005, z);
        normal.push(0, 0, nz);
        jawOpen.push(r < openRungs ? 0 : 0.01);
      }
    }
    for (let r = 0; r < rungs - 1; r += 1) {
      const a = base + r * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  return {
    position: vec3(position),
    normal: vec3(normal),
    index: { count: index.length, getX: (i) => index[i] as number },
    jawOpen,
  };
}

describe('mouth cavity bake', () => {
  it('finds the aperture where the lining ends, without being told where it is', () => {
    const g = slot();
    const { apertureCount, liningCount } = bakeMouthCavity(g);
    // 15 lining rungs x 2 sides x 2 plates, welded (nothing coincides here).
    assert.equal(liningCount, 60);
    // The boundary rung of each plate: 2 vertices x 2 plates.
    assert.equal(apertureCount, 4);
  });

  it('depth grows away from the aperture and reaches 1 at the far end', () => {
    const g = slot();
    const { depth } = bakeMouthCavity(g);
    let atAperture = 0;
    let atFarEnd = 0;
    for (let v = 0; v < g.position.count; v += 1) {
      if (g.jawOpen[v]! === 0) continue;
      if (g.position.getY(v) < 0.026) atAperture = Math.max(atAperture, depth[v]!);
      else if (g.position.getY(v) > 0.094) atFarEnd = Math.max(atFarEnd, depth[v]!);
    }
    assert.ok(atAperture < 0.05, `aperture depth ${atAperture}`);
    assert.equal(atFarEnd, 1);
  });

  /*
    Every vertex in this fixture is enclosed — the two plates face each other
    down their whole length — so the rungs the jaw does not move are exactly the
    case the adoption rule exists for: enclosed, outside the lining, and needing
    a depth they cannot walk to. Teeth and the tongue are that case on the real
    head, being their own shells.

    What must hold is that adoption cannot make an outsider look DEEP. It
    borrows from the nearest lining vertex, and the nearest lining vertex to
    something outside the mouth is at the aperture, where depth is ~0.
  */
  it('what the walk cannot reach borrows a shallow depth, never a deep one', () => {
    const g = slot();
    const { depth } = bakeMouthCavity(g);
    let deepest = 0;
    let adopted = 0;
    for (let v = 0; v < g.position.count; v += 1) {
      if (g.jawOpen[v]! !== 0) continue;
      if (depth[v]! > 0) adopted += 1;
      deepest = Math.max(deepest, depth[v]!);
    }
    assert.ok(adopted > 0, 'the enclosed non-lining rungs should have adopted something');
    assert.ok(deepest < 0.15, `an outside vertex claimed depth ${deepest.toFixed(3)}`);
  });

  it('a jaw that moves nothing leaves the whole mesh lit', () => {
    const g = slot();
    const flat: MouthGeometry = { ...g, jawOpen: new Float32Array(g.position.count) };
    const { depth, liningCount } = bakeMouthCavity(flat);
    assert.equal(liningCount, 0);
    assert.ok(depth.every((v) => v === 0));
  });

  /*
    A pocket with no boundary has no opening to measure from. Seeding it
    anywhere would produce a smooth, entirely fictional gradient, so it produces
    nothing instead — the failure has to be visible as an unshaded mouth rather
    than as a plausible one.
  */
  it('a sealed pocket writes nothing rather than inventing a gradient', () => {
    const g = slot(20, 0);
    const { depth, apertureCount } = bakeMouthCavity(g);
    assert.equal(apertureCount, 0);
    assert.ok(depth.every((v) => v === 0));
  });
});

describe('mouth cavity on the shipped head', () => {
  const dir = new URL('../../assets/natalie-phone/', import.meta.url);
  const gltf = JSON.parse(readFileSync(new URL('natalie.gltf', dir), 'utf8')) as {
    accessors: Record<string, never>[] & {
      bufferView?: number;
      byteOffset?: number;
      count: number;
      sparse?: { count: number; indices: { bufferView: number; byteOffset: number }; values: { bufferView: number; byteOffset: number } };
    }[];
    bufferViews: { byteOffset?: number; byteStride?: number }[];
    meshes: { primitives: { attributes: Record<string, number>; indices: number; targets: Record<string, number>[] }[]; extras: { targetNames: string[] } }[];
  };
  const bin = readFileSync(new URL('natalie.bin', dir));
  const f32 = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);
  const attr = (i: number, comps: number) => {
    const a = gltf.accessors[i]!;
    const view = gltf.bufferViews[a.bufferView!]!;
    const stride = (view.byteStride ?? comps * 4) / 4;
    const start = ((view.byteOffset ?? 0) + (a.byteOffset ?? 0)) / 4;
    return {
      count: a.count,
      getX: (v: number) => f32[start + v * stride] as number,
      getY: (v: number) => f32[start + v * stride + 1] as number,
      getZ: (v: number) => f32[start + v * stride + 2] as number,
    };
  };
  const body = gltf.meshes[0]!.primitives[0]!;
  const ia = gltf.accessors[body.indices]!;
  const iview = gltf.bufferViews[ia.bufferView!]!;
  const u16 = new Uint16Array(bin.buffer, bin.byteOffset + (iview.byteOffset ?? 0) + (ia.byteOffset ?? 0), ia.count);

  /*
    The morph target is SPARSE — only the ~3200 vertices the jaw actually moves
    are stored — so it is expanded to a dense magnitude array. Reading it as a
    plain accessor would find no bufferView at all.
  */
  const jawIndex = gltf.meshes[0]!.extras.targetNames.indexOf('jawOpen');
  const target = gltf.accessors[body.targets[jawIndex]!.POSITION!]!;
  const sparse = target.sparse!;
  const sIdxView = gltf.bufferViews[sparse.indices.bufferView]!;
  const sValView = gltf.bufferViews[sparse.values.bufferView]!;
  const sIdx = new Uint16Array(bin.buffer, bin.byteOffset + (sIdxView.byteOffset ?? 0) + sparse.indices.byteOffset, sparse.count);
  const sVal = new Float32Array(bin.buffer, bin.byteOffset + (sValView.byteOffset ?? 0) + sparse.values.byteOffset, sparse.count * 3);
  const jawOpen = new Float32Array(target.count);
  for (let i = 0; i < sparse.count; i += 1) {
    jawOpen[sIdx[i]!] = Math.hypot(sVal[i * 3]!, sVal[i * 3 + 1]!, sVal[i * 3 + 2]!);
  }

  const g: MouthGeometry = {
    position: attr(body.attributes.POSITION!, 3),
    normal: attr(body.attributes.NORMAL!, 3),
    index: { count: ia.count, getX: (i) => u16[i] as number },
    jawOpen,
  };
  const cavity = bakeMouthCavity(g);

  it('finds a mouth-sized lining with a mouth-sized opening', () => {
    assert.ok(cavity.liningCount > 200 && cavity.liningCount < 2000, `${cavity.liningCount} lining vertices`);
    assert.ok(cavity.apertureCount > 10, `${cavity.apertureCount} aperture vertices`);
    assert.ok(
      cavity.maxDepthM > 0.03 && cavity.maxDepthM < 0.12,
      `deepest point is ${(cavity.maxDepthM * 1000).toFixed(0)} mm from the lips`,
    );
  });

  it('the gradient runs backwards into the head, not forwards out of it', () => {
    let deep = 0;
    let deepN = 0;
    let shallow = 0;
    let shallowN = 0;
    for (let v = 0; v < g.position.count; v += 1) {
      if (cavity.depth[v]! > 0.9) {
        deep += g.position.getZ(v);
        deepN += 1;
      } else if (cavity.depth[v]! > 0 && cavity.depth[v]! < 0.1) {
        shallow += g.position.getZ(v);
        shallowN += 1;
      }
    }
    assert.ok(deepN > 0 && shallowN > 0);
    assert.ok(
      deep / deepN < shallow / shallowN,
      `deep vertices sit at z ${(deep / deepN).toFixed(4)}, shallow at ${(shallow / shallowN).toFixed(4)} — the mouth is inside out`,
    );
  });

  it('is a gradient, not a mask — a two-valued field would darken flat', () => {
    const distinct = new Set(Array.from(cavity.depth).map((v) => v.toFixed(4)));
    assert.ok(distinct.size > 100, `only ${distinct.size} distinct depths`);
  });

  it('reaches the teeth and tongue, which the walk cannot cross to', () => {
    // They are separate shells, so every one of them is adopted rather than
    // walked. Zero adopted would mean the teeth light like a cheek.
    assert.ok(cavity.adoptedCount > 20, `only ${cavity.adoptedCount} vertices adopted a depth`);
  });

  it('leaves the face alone — only the mouth is darkened', () => {
    const touched = cavity.depth.filter((v) => v > 0).length;
    assert.ok(touched < g.position.count * 0.1, `${touched} of ${g.position.count} vertices darkened`);
  });
});

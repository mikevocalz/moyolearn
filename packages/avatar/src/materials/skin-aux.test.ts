/**
 * The bake, on shapes whose answers are known analytically, and then on the
 * real body for cost.
 *
 * A sphere is the useful fixture: its curvature is 1/r everywhere and its
 * thickness along −normal is exactly the diameter, so both halves have a number
 * to be wrong against rather than only a range to sit inside. A slab gives the
 * second: thickness must follow the thin axis, not the bounding box.
 *
 * SOT: ./skin-aux.ts
 * SOT-KEYWORDS: skin aux test curvature thickness sphere slab float32 bake
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { CURVATURE_REFERENCE, THICKNESS_REFERENCE, bakeSkinAux } from './skin-aux.ts';
import type { Geometry } from './skin-aux.ts';

/**
 * The accessor shape three's attributes expose. Tight packing here on purpose —
 * the interleaved case is what the real asset exercises, and it is covered by
 * the asset test rather than by pretending a Float32Array can be interleaved.
 */
const vec3 = (a: ArrayLike<number>) => ({
  count: a.length / 3,
  getX: (i: number) => a[i * 3] as number,
  getY: (i: number) => a[i * 3 + 1] as number,
  getZ: (i: number) => a[i * 3 + 2] as number,
});
const scalar = (a: ArrayLike<number>) => ({ count: a.length, getX: (i: number) => a[i] as number });
const geo = (position: ArrayLike<number>, normal: ArrayLike<number>, index: ArrayLike<number>): Geometry => ({
  position: vec3(position),
  normal: vec3(normal),
  index: scalar(index),
});

/** A UV sphere of radius `r`, with exact analytic normals. */
function sphere(r: number, segments = 48): Geometry {
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  for (let y = 0; y <= segments; y += 1) {
    const phi = (y / segments) * Math.PI;
    for (let x = 0; x <= segments; x += 1) {
      const theta = (x / segments) * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      normal.push(nx, ny, nz);
      position.push(nx * r, ny * r, nz * r);
    }
  }
  const row = segments + 1;
  for (let y = 0; y < segments; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const a = y * row + x;
      index.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
    }
  }
  return geo(position, normal, index);
}

describe('skin aux bake', () => {
  it('returns Float32Array — three r185 cannot bind an 8-bit itemSize-1 attribute', () => {
    const aux = bakeSkinAux(sphere(0.1));
    assert.ok(aux.curvature instanceof Float32Array);
    assert.ok(aux.thickness instanceof Float32Array);
  });

  it('curvature is 1/r, anchored to a real length rather than the mesh maximum', () => {
    for (const r of [0.025, 0.05, 0.1]) {
      const { curvature } = bakeSkinAux(sphere(r));
      const mean = curvature.reduce((a, b) => a + b, 0) / curvature.length;
      const expected = Math.min(1, 1 / r / CURVATURE_REFERENCE);
      assert.ok(
        Math.abs(mean - expected) < 0.06,
        `r=${r}: expected ~${expected.toFixed(3)}, got ${mean.toFixed(3)}`,
      );
    }
  });

  it('a tighter sphere reads as more curved — the ordering is what the term is for', () => {
    const mean = (r: number) => {
      const { curvature } = bakeSkinAux(sphere(r));
      return curvature.reduce((a, b) => a + b, 0) / curvature.length;
    };
    assert.ok(mean(0.03) > mean(0.09), 'a nostril must scatter more than a cheek');
  });

  it('thickness on a sphere is its diameter, normalised', () => {
    const r = 0.03;
    const { thickness } = bakeSkinAux(sphere(r));
    const mean = thickness.reduce((a, b) => a + b, 0) / thickness.length;
    const expected = Math.min(1, (2 * r) / THICKNESS_REFERENCE);
    assert.ok(Math.abs(mean - expected) < 0.12, `expected ~${expected.toFixed(2)}, got ${mean.toFixed(2)}`);
  });

  it('a thin slab is thin, and the bounding box does not decide it', () => {
    // 0.4 x 0.4 x 0.01 m: thin in z, large in x and y.
    const position: number[] = [];
    const normal: number[] = [];
    const index: number[] = [];
    const n = 40;
    for (const [z, nz] of [
      [0.005, 1],
      [-0.005, -1],
    ] as const) {
      const base = position.length / 3;
      for (let y = 0; y <= n; y += 1) {
        for (let x = 0; x <= n; x += 1) {
          position.push((x / n - 0.5) * 0.4, (y / n - 0.5) * 0.4, z);
          normal.push(0, 0, nz);
        }
      }
      for (let y = 0; y < n; y += 1) {
        for (let x = 0; x < n; x += 1) {
          const a = base + y * (n + 1) + x;
          index.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2);
        }
      }
    }
    const { thickness } = bakeSkinAux(geo(position, normal, index));
    const mean = thickness.reduce((a, b) => a + b, 0) / thickness.length;
    assert.ok(mean < 0.25, `a 1 cm slab must read thin, got ${mean.toFixed(2)}`);
  });

  it('an unmet ray is opaque, not infinitely thin', () => {
    // A single open sheet: nothing is behind it, so nothing may claim to glow.
    const { thickness } = bakeSkinAux(
      geo([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 0, 1, 0, 0, 1, 0, 0, 1], [0, 1, 2]),
    );
    for (const t of thickness) assert.equal(t, 1);
  });
});

/*
  The shipped body, INTERLEAVED as it actually is. This is the case the
  synthetic fixtures cannot reach and the one that went wrong: reading a
  `byteStride` 64 attribute as though it were tightly packed produced `NaN`
  curvature and 100% opaque thickness, and neither a shader nor a typecheck
  objects to either. The accessors below are stride-aware exactly as three's
  `InterleavedBufferAttribute` is.
*/
describe('skin aux on the shipped body', () => {
  const dir = new URL('../../assets/natalie-phone/', import.meta.url);
  const gltf = JSON.parse(readFileSync(new URL('natalie.gltf', dir), 'utf8')) as {
    accessors: { bufferView: number; byteOffset?: number; count: number }[];
    bufferViews: { byteOffset?: number; byteStride?: number }[];
    meshes: { primitives: { attributes: Record<string, number>; indices: number }[] }[];
  };
  const bin = readFileSync(new URL('natalie.bin', dir));

  const vec3 = (i: number) => {
    const a = gltf.accessors[i]!;
    const view = gltf.bufferViews[a.bufferView]!;
    const stride = (view.byteStride ?? 12) / 4;
    const start = ((view.byteOffset ?? 0) + (a.byteOffset ?? 0)) / 4;
    const f = new Float32Array(bin.buffer, bin.byteOffset, bin.byteLength / 4);
    return {
      count: a.count,
      getX: (v: number) => f[start + v * stride] as number,
      getY: (v: number) => f[start + v * stride + 1] as number,
      getZ: (v: number) => f[start + v * stride + 2] as number,
    };
  };
  const indices = (i: number) => {
    const a = gltf.accessors[i]!;
    const view = gltf.bufferViews[a.bufferView]!;
    const u = new Uint16Array(bin.buffer, bin.byteOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0), a.count);
    return { count: a.count, getX: (v: number) => u[v] as number };
  };

  const body = gltf.meshes[0]!.primitives[0]!;
  const aux = bakeSkinAux({
    position: vec3(body.attributes.POSITION!),
    normal: vec3(body.attributes.NORMAL!),
    index: indices(body.indices),
  });

  it('produces a number for every vertex — NaN is what a misread stride looks like', () => {
    assert.ok(aux.curvature.every(Number.isFinite), 'curvature has non-finite entries');
    assert.ok(aux.thickness.every(Number.isFinite), 'thickness has non-finite entries');
  });

  it('curvature varies across the body — a constant means the one-ring was not walked', () => {
    const min = Math.min(...aux.curvature);
    const max = Math.max(...aux.curvature);
    assert.ok(max - min > 0.5, `curvature spans only ${min.toFixed(3)}..${max.toFixed(3)}`);
  });

  it('the body is not uniformly opaque — that is the other face of a bad read', () => {
    const opaque = aux.thickness.filter((t) => t === 1).length / aux.thickness.length;
    assert.ok(opaque < 0.9, `${(opaque * 100).toFixed(0)}% of vertices found no far surface`);
    assert.ok(opaque > 0.05, `${(opaque * 100).toFixed(0)}% opaque — a torso is thicker than 10 cm`);
  });

  /*
    The regression this guards is a silent one. A march that reports the cell
    index of the first occupied cell rather than an exact ray-triangle distance
    quantises the whole body onto SEVEN values with a 25.9 mm floor, and every
    thin feature — ears, eyelids, lips, nostril wings, fingers — reads the same
    number. Nothing in the earlier assertions moved when that was true.
  */
  it('resolves thin features — cell quantisation gives seven values, not thousands', () => {
    const distinct = new Set(Array.from(aux.thickness).map((v) => v.toFixed(4)));
    assert.ok(distinct.size > 1000, `only ${distinct.size} distinct thicknesses — the march is quantised`);
    const thinnest = Math.min(...aux.thickness) * 100; // metres -> cm
    assert.ok(thinnest < 0.5, `thinnest vertex is ${thinnest.toFixed(2)} cm — an eyelid is thinner than that`);
  });

  it('stays in 0..1, which is the range the shader assumes', () => {
    for (const a of [aux.curvature, aux.thickness]) {
      assert.ok(Math.min(...a) >= 0 && Math.max(...a) <= 1);
    }
  });
});

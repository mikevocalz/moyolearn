/**
 * The eye bake, on a sphere with a known axis and then on the shipped head.
 *
 * SOT: ./eye-aux.ts
 * SOT-KEYWORDS: eye aux test sphere pole iris plane lid margin occlusion bake
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { bakeEyeAux } from './eye-aux.ts';
import type { Geometry } from './skin-aux.ts';

const vec3 = (a: number[]) => ({
  count: a.length / 3,
  getX: (i: number) => a[i * 3] as number,
  getY: (i: number) => a[i * 3 + 1] as number,
  getZ: (i: number) => a[i * 3 + 2] as number,
});

/**
 * A closed UV sphere of radius `r`, plus an open ring of quads standing in
 * front of its +Z pole. The ring is the fixture's lid margin: its edges belong
 * to one triangle each, which is what the bake looks for, and it is the only
 * thing telling the bake which pole is the front.
 */
function eyeball(r = 0.015, segments = 24): Geometry {
  const position: number[] = [];
  const normal: number[] = [];
  const index: number[] = [];
  for (let y = 0; y <= segments; y += 1) {
    const phi = (y / segments) * Math.PI;
    for (let x = 0; x <= segments; x += 1) {
      const theta = (x / segments) * Math.PI * 2;
      // +Z pole at phi = 0.
      const nz = Math.cos(phi);
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.sin(phi) * Math.sin(theta);
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
  // The open ring, a band at z = r * 1.1 between radii 1.1r and 1.3r.
  const base = position.length / 3;
  const ringSegments = 16;
  for (let i = 0; i <= ringSegments; i += 1) {
    const theta = (i / ringSegments) * Math.PI * 2;
    for (const radius of [r * 1.1, r * 1.3]) {
      position.push(Math.cos(theta) * radius, Math.sin(theta) * radius, r * 1.1);
      normal.push(0, 0, 1);
    }
  }
  for (let i = 0; i < ringSegments; i += 1) {
    const a = base + i * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return { position: vec3(position), normal: vec3(normal), index: { count: index.length, getX: (i) => index[i] as number } };
}

describe('eye aux bake', () => {
  const r = 0.015;
  const g = eyeball(r);
  const { aux, eyes } = bakeEyeAux(g);

  it('finds the eyeball by its sphere-ness, and finds only it', () => {
    assert.equal(eyes.length, 1, `${eyes.length} spheres — the flat ring is not one`);
    assert.ok(Math.abs(eyes[0]!.radiusM - r) < r * 0.02);
    assert.ok(eyes[0]!.radiusSpread < 0.02, `radius spread ${eyes[0]!.radiusSpread}`);
  });

  it('the forward axis is the pole the lid margin surrounds', () => {
    // The ring sits in front of +Z, so +Z is the front.
    assert.ok(eyes[0]!.forward[2]! > 0.95, `forward is ${eyes[0]!.forward.join(', ')}`);
  });

  it('xy is a plane in METRES, zero at the pupil and the radius at the limbus', () => {
    let atPole = Infinity;
    let widest = 0;
    for (let v = 0; v < g.position.count; v += 1) {
      const radial = Math.hypot(aux[v * 4]!, aux[v * 4 + 1]!);
      if (aux[v * 4] === 0 && aux[v * 4 + 1] === 0 && aux[v * 4 + 3] === 0) continue;
      if (g.position.getZ(v) > r * 0.99) atPole = Math.min(atPole, radial);
      widest = Math.max(widest, radial);
    }
    assert.ok(atPole < r * 0.02, `the pupil centre is ${atPole} from the axis, not 0`);
    // eyes.ts divides by irisRadius and calls 1.0 the limbus; a 0..1 UV here
    // would make that division meaningless.
    assert.ok(Math.abs(widest - r) < r * 0.02, `widest |xy| is ${widest}, expected the radius ${r}`);
  });

  it('z is a distance to the lid, bounded, and w is a fraction', () => {
    for (let v = 0; v < g.position.count; v += 1) {
      // The cap is 6 mm; stored as float32 it reads back as 0.006000000052.
      assert.ok(aux[v * 4 + 2]! >= 0 && aux[v * 4 + 2]! <= 0.006 + 1e-7);
      assert.ok(aux[v * 4 + 3]! >= 0 && aux[v * 4 + 3]! <= 1);
    }
  });
});

describe('eye aux on the shipped head', () => {
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
  const body = gltf.meshes[0]!.primitives[0]!;
  const ia = gltf.accessors[body.indices]!;
  const iview = gltf.bufferViews[ia.bufferView]!;
  const u16 = new Uint16Array(bin.buffer, bin.byteOffset + (iview.byteOffset ?? 0) + (ia.byteOffset ?? 0), ia.count);
  const g: Geometry = {
    position: attr(body.attributes.POSITION!, 3),
    normal: attr(body.attributes.NORMAL!, 3),
    index: { count: ia.count, getX: (i) => u16[i] as number },
  };
  const { aux, eyes } = bakeEyeAux(g);

  it('finds exactly two eyeballs in a body of 18,104 vertices', () => {
    assert.equal(eyes.length, 2, `found ${eyes.length}`);
    for (const eye of eyes) {
      assert.equal(eye.vertexCount, 514);
      assert.ok(Math.abs(eye.radiusM - 0.0146) < 0.001, `radius ${eye.radiusM}`);
      assert.ok(eye.radiusSpread < 0.01, `spread ${eye.radiusSpread} — that is not a sphere`);
    }
  });

  it('both eyes look the same way, and it is out of the face', () => {
    const [left, right] = eyes;
    assert.ok(left && right);
    const dot =
      left.forward[0]! * right.forward[0]! + left.forward[1]! * right.forward[1]! + left.forward[2]! * right.forward[2]!;
    assert.ok(dot > 0.97, `the two eyes disagree by ${((Math.acos(dot) * 180) / Math.PI).toFixed(1)} degrees`);
    /*
      A ray test on the poles is the obvious way to find the front and it picks
      the WRONG one here: the lashes stand in front of the cornea so the forward
      ray is blocked, while the eye's back faces a hollow skull so the backward
      ray escapes. It returned z = -0.988 where the anterior pole is at +Z.
    */
    for (const eye of eyes) assert.ok(eye.forward[2]! > 0.9, `forward is ${eye.forward.join(', ')} — inside out`);
  });

  it('touches the eyes and nothing else', () => {
    let touched = 0;
    for (let v = 0; v < g.position.count; v += 1) {
      if (aux[v * 4] !== 0 || aux[v * 4 + 1] !== 0 || aux[v * 4 + 2] !== 0 || aux[v * 4 + 3] !== 0) touched += 1;
    }
    assert.equal(touched, 1028, `${touched} vertices carry eye data`);
  });

  it('the wet band has something to work with', () => {
    // eyes.ts fades it out by 1.3 mm, so vertices inside that band must exist
    // or the wet line never draws. The probe's constant 0.5 was 500 mm.
    let inBand = 0;
    for (let v = 0; v < g.position.count; v += 1) {
      const z = aux[v * 4 + 2]!;
      if (z > 0 && z < 0.0013) inBand += 1;
    }
    assert.ok(inBand > 10, `only ${inBand} vertices sit inside the 1.3 mm wet band`);
  });
});

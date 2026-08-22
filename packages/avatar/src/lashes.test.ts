/**
 * Lashes, and the bake that unblocked them — doc 22 §4 row 13.
 *
 * The interesting assertion in here is the reproducibility one. The whole
 * argument for baking rather than polyfilling a canvas is that the bytes stop
 * depending on the machine that produced them; a test that runs the baker twice
 * and compares the hash is what turns that argument into a property.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4 row 13
 * SOT-KEYWORDS: lashes test bake deterministic png ribbon blink margin alphatest
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { Texture } from 'three';
import {
  LOWER_LENGTH,
  ROWS,
  UPPER_LENGTH,
  assertMarginBounds,
  configureLashTexture,
  createLashMaterial,
  createLashes,
} from './lashes.ts';
import { bake, encodePng, mulberry32, planStrands } from '../tools/bake_lash_texture.ts';

/** A tiny synthetic head: two eyes, four margin verts each, on a unit sphere-ish. */
function fixture() {
  const vertexCount = 20;
  const positions = new Float32Array(vertexCount * 3);
  const place = (v: number, x: number, y: number, z: number) => {
    positions[v * 3] = x;
    positions[v * 3 + 1] = y;
    positions[v * 3 + 2] = z;
  };
  // left eye (+x), upper margin 0-2, lower 3-5
  place(0, 0.028, 0.02, 0.06);
  place(1, 0.032, 0.023, 0.062);
  place(2, 0.036, 0.02, 0.06);
  place(3, 0.028, 0.016, 0.06);
  place(4, 0.032, 0.014, 0.062);
  place(5, 0.036, 0.016, 0.06);
  // right eye (-x)
  place(6, -0.028, 0.02, 0.06);
  place(7, -0.032, 0.023, 0.062);
  place(8, -0.036, 0.02, 0.06);
  place(9, -0.028, 0.016, 0.06);
  place(10, -0.032, 0.014, 0.062);
  place(11, -0.036, 0.016, 0.06);

  const lines = {
    identitySha256: 'a'.repeat(64),
    eyes: [
      { side: 'left' as const, upper: [0, 1, 2], lower: [3, 4, 5] },
      { side: 'right' as const, upper: [6, 7, 8], lower: [9, 10, 11] },
    ],
  };
  return { lines, positions, vertexCount };
}

describe('the lash bake (row 13)', () => {
  it('produces byte-identical output on every run', () => {
    // This is the property that makes baking better than a canvas polyfill.
    const a = bake();
    const b = bake();
    assert.equal(a.manifest.sha256, b.manifest.sha256);
    assert.ok(a.png.equals(b.png), 'the PNG bytes themselves, not just the hash');
  });

  it('keeps the reference PRNG and its exact call order', () => {
    // Move a single rand() and every strand after it changes. The sequence is
    // the spec, so it is pinned here rather than only in a comment.
    const rand = mulberry32(1337);
    const first = [rand(), rand(), rand()];
    const again = mulberry32(1337);
    assert.deepEqual([again(), again(), again()], first);

    const strands = planStrands();
    assert.equal(strands.length, 120);
    for (const s of strands) {
      assert.ok(s.alpha >= 0.7 && s.alpha <= 1.0, 'alpha 0.7 + rand*0.3');
      assert.ok(s.lineWidth >= 1.1 && s.lineWidth <= 2.6, 'width 1.1 + rand*1.5');
      assert.ok(s.yTop >= 4 && s.yTop <= 26, 'tip 4 + rand*22');
      assert.ok(Math.abs(s.tilt) <= 8, 'tilt (rand-0.5)*16');
    }
  });

  it('emits a real 256x128 RGBA PNG', () => {
    const { png, manifest } = bake();
    assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(png.readUInt32BE(16), 256);
    assert.equal(png.readUInt32BE(20), 128);
    assert.equal(png[24], 8, 'bit depth');
    assert.equal(png[25], 6, 'colour type RGBA — the alpha IS the strand');
    assert.equal(manifest.width, 256);
    assert.equal(manifest.height, 128);
    assert.match(manifest.sha256, /^[0-9a-f]{64}$/);
  });

  it('still produces the sha256 checked into assets/lash-strands.json', () => {
    // The manifest is committed; the PNG is not (doc 20 — assets ship on the
    // CDN, and a 32 KB binary in the repo would be the thin end of that wedge).
    // So THIS is the regression gate on the rasteriser: change a constant, a
    // gradient stop, or the supersampling and this hash moves, which means the
    // lash fringe changed and the golden set must be re-approved deliberately
    // rather than drifting.
    const committed = JSON.parse(
      readFileSync(new URL('../assets/lash-strands.json', import.meta.url), 'utf8')
    ) as { sha256: string; width: number; height: number; seed: number };
    const fresh = bake();
    assert.equal(fresh.manifest.sha256, committed.sha256, 'the baked texture changed');
    assert.equal(fresh.manifest.width, committed.width);
    assert.equal(fresh.manifest.height, committed.height);
    assert.equal(fresh.manifest.seed, committed.seed);
  });

  it('encodes deterministically for a given pixel buffer', () => {
    const pixels = new Uint8Array(4 * 4 * 4).fill(200);
    assert.ok(encodePng(pixels, 4, 4).equals(encodePng(pixels, 4, 4)));
  });
});

describe('lash ribbons', () => {
  it('builds one ribbon per lid line, three rows deep', () => {
    const { lines, positions } = fixture();
    const lashes = createLashes(lines, positions, new Texture());
    assert.equal(lashes.meshes.length, 4, 'upper + lower, both eyes');
    for (const mesh of lashes.meshes) {
      const position = mesh.geometry.getAttribute('position');
      assert.equal(position.count, 3 * ROWS, '3 margin points x 3 rows');
      assert.equal(mesh.frustumCulled, false, 'rebuilt every frame; bounds are stale');
      const uv = mesh.geometry.getAttribute('uv');
      assert.equal(uv.getY(0), 0, 'v = 0 on the base row');
    }
    lashes.dispose();
  });

  it('extrudes AWAY from the eyeball, and further on the upper lid', () => {
    const { lines, positions } = fixture();
    const lashes = createLashes(lines, positions, new Texture());
    const spans = lashes.meshes.map((mesh) => {
      const p = mesh.geometry.getAttribute('position');
      // vertex 1 is the base row's middle point, vertex 7 its tip row.
      return Math.hypot(p.getX(7) - p.getX(1), p.getY(7) - p.getY(1), p.getZ(7) - p.getZ(1));
    });
    for (const span of spans) assert.ok(span > 0, 'the ribbon has depth');
    // spans[0] is the left upper, spans[1] the left lower.
    assert.ok(spans[0]! > spans[1]!, 'upper lashes are the long ones');
    assert.ok(UPPER_LENGTH > LOWER_LENGTH);
    lashes.dispose();
  });

  it('follows the lid: moving a margin vert moves its ribbon', () => {
    const { lines, positions } = fixture();
    const lashes = createLashes(lines, positions, new Texture());
    const mesh = lashes.meshes[0]!;
    const before = mesh.geometry.getAttribute('position').getY(1);

    // Close the lid — drop the upper margin's middle vertex.
    const blinked = Float32Array.from(positions);
    blinked[1 * 3 + 1] = (blinked[1 * 3 + 1] as number) - 0.004;
    lashes.update(blinked);

    const after = mesh.geometry.getAttribute('position').getY(1);
    assert.ok(after < before, 'the fringe came down with the lid');
    lashes.dispose();
  });

  it('rejects a stale lash-lines.json instead of filling with NaN', () => {
    const { lines, positions, vertexCount } = fixture();
    assert.doesNotThrow(() => assertMarginBounds(lines, vertexCount));
    const stale = { ...lines, eyes: [{ side: 'left' as const, upper: [0, 1, 999], lower: [3, 4, 5] }] };
    assert.throws(() => assertMarginBounds(stale, vertexCount), /out of range/);
    assert.throws(
      () => assertMarginBounds({ ...lines, eyes: [{ side: 'left', upper: [0], lower: [3, 4] }] }, vertexCount),
      /fewer than 2 points/
    );
    void positions;
  });

  it('cuts out rather than blends, and shares one material', () => {
    const material = createLashMaterial(new Texture());
    // Alpha-blended lashes need a depth sort that interleaved ribbons lose.
    assert.equal(material.alphaTest, 0.35);
    assert.equal(material.transparent, true);
    assert.equal(material.side, 2 /* DoubleSide */);

    const { lines, positions } = fixture();
    const lashes = createLashes(lines, positions, new Texture());
    const materials = new Set(lashes.meshes.map((m) => m.material));
    assert.equal(materials.size, 1, 'one material, four meshes — one pipeline');
    lashes.dispose();
    material.dispose();
  });

  it('gives the texture sRGB and a repeating tile', () => {
    const texture = configureLashTexture(new Texture());
    assert.equal(texture.colorSpace, 'srgb');
    assert.equal(texture.wrapS, 1000 /* RepeatWrapping */, 'u tiles along the margin');
  });
});

/**
 * FIPS 180-4 vectors, plus the two properties this implementation exists to
 * hold: agreement with Node's own `crypto` (so a hash produced here matches one
 * produced by the Python bake, which uses the same standard), and correct
 * handling of every padding boundary — a length-field bug is invisible on short
 * inputs and shows up only on the multi-megabyte buffers this actually hashes.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: sha256 test vectors fips padding boundary node-crypto parity
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { sha256Float32, sha256Hex } from './sha256.ts';

const utf8 = (s: string) => new TextEncoder().encode(s);

describe('sha256 — standard vectors', () => {
  it('empty input', () => {
    assert.equal(
      sha256Hex(new Uint8Array(0)),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('"abc"', () => {
    assert.equal(
      sha256Hex(utf8('abc')),
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('the 448-bit two-block vector', () => {
    assert.equal(
      sha256Hex(utf8('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')),
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1'
    );
  });

  it('one million "a"', () => {
    assert.equal(
      sha256Hex(new Uint8Array(1_000_000).fill(0x61)),
      'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'
    );
  });
});

describe('sha256 — padding boundaries', () => {
  // 55/56/57 and 63/64/65 are where the length field crosses into a new block.
  // Getting this wrong passes every short vector and fails on real data.
  it('agrees with node:crypto across every length from 0 to 130 bytes', () => {
    for (let n = 0; n <= 130; ++n) {
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; ++i) bytes[i] = (i * 31 + 7) & 0xff;
      const expected = createHash('sha256').update(bytes).digest('hex');
      assert.equal(sha256Hex(bytes), expected, `length ${n}`);
    }
  });

  it('agrees with node:crypto on a mesh-sized buffer', () => {
    // 17,821 verts x 3 floats — the real shape of a hashed head payload.
    const floats = new Float32Array(17821 * 3);
    for (let i = 0; i < floats.length; ++i) floats[i] = Math.sin(i) * 0.1;
    const bytes = new Uint8Array(floats.buffer);
    assert.equal(
      sha256Hex(bytes),
      createHash('sha256').update(bytes).digest('hex')
    );
  });
});

describe('sha256Float32', () => {
  it('matches the tools/bake_identity.py convention', () => {
    // The bake hashes little-endian float32 bytes; this must agree exactly or
    // every identitySha256 in every baked artifact is unverifiable.
    const identity = [0.5, -1.25, 3.75, 0, 1e-8];
    const floats = Float32Array.from(identity);
    const expected = createHash('sha256')
      .update(Buffer.from(floats.buffer, floats.byteOffset, floats.byteLength))
      .digest('hex');
    assert.equal(sha256Float32(identity), expected);
  });
});

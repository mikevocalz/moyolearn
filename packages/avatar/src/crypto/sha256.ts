/**
 * SHA-256 over bytes, with no dependency and no platform API.
 *
 * Why not `crypto.subtle`: the reference renderer used it, and Hermes does not
 * provide it. Why not `expo-crypto`: it is a dependency, it is async, it is
 * Expo-only, and it would not run under `node --test` — so the provenance
 * checks that matter most would become the checks that never run in CI.
 *
 * What this guards is real. Every baked avatar artifact — the neck-align
 * transform, the skirt conform, the aux attribute sets — is valid only for the
 * exact head identity and body rig it was baked against, and the capability
 * manager caches those artifacts independently. A mismatched pair does not
 * crash; it renders a head floating slightly off a neck, which is the kind of
 * bug that gets argued about in screenshots for a week. Hashing the live
 * skeleton and comparing turns that into an exception at load.
 *
 * ~70 lines of FIPS 180-4, verified against the standard vectors in the
 * neighbouring test. Not for passwords, not for anything adversarial — this is
 * an integrity check on our own build output.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: sha256 hash digest provenance integrity baked artifact hermes no-crypto-subtle
 */

// FIPS 180-4 §4.2.2: first 32 bits of the fractional parts of the cube roots
// of the first 64 primes.
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** Raw digest: 32 bytes. */
export function sha256(input: Uint8Array): Uint8Array {
  // Initial hash: fractional parts of the square roots of the first 8 primes.
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  // Pad to a multiple of 64 bytes: 0x80, then zeroes, then the message length
  // in BITS as a big-endian u64. The length is written as two 32-bit halves
  // because a JS number cannot hold a 64-bit bit-count exactly — and inputs
  // here are meshes, so the high half is not hypothetical.
  const byteLength = input.length;
  const bitLengthHi = Math.floor(byteLength / 0x20000000);
  const bitLengthLo = (byteLength << 3) >>> 0;
  const padded = new Uint8Array((((byteLength + 8) >> 6) + 1) << 6);
  padded.set(input);
  padded[byteLength] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLengthHi, false);
  view.setUint32(padded.length - 4, bitLengthLo, false);

  const w = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; ++i) w[i] = view.getUint32(offset + i * 4, false);
    for (let i = 16; i < 64; ++i) {
      const a = w[i - 15]!;
      const b = w[i - 2]!;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = (w[i - 16]! + s0 + w[i - 7]! + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; ++i) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i]! + w[i]!) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  const digest = [h0, h1, h2, h3, h4, h5, h6, h7];
  for (let i = 0; i < 8; ++i) outView.setUint32(i * 4, digest[i]!, false);
  return out;
}

/** Lower-case hex digest — the form every baked artifact records. */
export function sha256Hex(input: Uint8Array): string {
  const bytes = sha256(input);
  let hex = '';
  for (let i = 0; i < bytes.length; ++i) {
    hex += (bytes[i]! >>> 4).toString(16) + (bytes[i]! & 0xf).toString(16);
  }
  return hex;
}

/**
 * sha-256 hex of values as little-endian float32 bytes — the convention
 * `tools/bake_identity.py` uses, and therefore the convention every
 * `identitySha256` in a baked artifact is expressed in.
 */
export function sha256Float32(values: ArrayLike<number>): string {
  const floats = Float32Array.from(values);
  return sha256Hex(new Uint8Array(floats.buffer, floats.byteOffset, floats.byteLength));
}

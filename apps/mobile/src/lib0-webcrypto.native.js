// `lib0/webcrypto` for Hermes, so the tutor board's CRDT can bundle on native.
//
// WHY THIS FILE EXISTS AT ALL. `board-doc.ts` pulls yjs -> lib0/random ->
// lib0/webcrypto. lib0 ships a `react-native` export condition, and that build
// requires `isomorphic-webcrypto`, which this repo does not install — so the
// Android bundle died at resolution the moment the board became a real pane.
// lib0's browser build is no help either: it reads `crypto.getRandomValues`
// off the global, and Hermes has no `crypto` global. React Native core and
// expo's winter runtime do not install one (both greped, both empty).
//
// WHY EXPO'S UUID AND NOT A CRYPTO PACKAGE. `expo-crypto` and
// `react-native-get-random-values` both solve this, and both are native
// modules — adding either means a rebuild of every installed dev build for a
// function this app already has. `expo-modules-core` is already linked into
// the binary and exposes `globalThis.expo.uuidv4`, which is
// `UUID.randomUUID()` on Android and `UUID()` on iOS. Both are specified to
// draw from the platform CSPRNG, so this is real entropy, not `Math.random`
// wearing a hat. That mattered enough to check the Kotlin and the Swift rather
// than trust the name.
//
// A v4 UUID carries 122 random bits in 128, so the six fixed bits are dropped
// rather than passed off as random: the version nibble is a constant '4' and
// the variant nibble holds only two random bits, so both nibbles are discarded
// whole and 15 whole bytes survive per call.
//
// SOT: node_modules/lib0/webcrypto.js (the two-export surface this matches)
// SOT-KEYWORDS: lib0 webcrypto yjs crdt board hermes getRandomValues entropy uuid native

/** Whole bytes of retained entropy per `uuidv4()` call. See the header. */
const BYTES_PER_UUID = 15;

function randomNibbles() {
  const uuidv4 = globalThis?.expo?.uuidv4;
  if (!uuidv4) {
    throw new Error(
      'lib0/webcrypto: expo-modules-core did not install `globalThis.expo.uuidv4`, ' +
        'so there is no entropy source on this runtime. The tutor board cannot ' +
        'generate a client id without one.',
    );
  }
  const hex = uuidv4().replace(/-/g, '');
  // Drop index 12 (version, always '4') and index 16 (variant, 2 fixed bits).
  return hex.slice(0, 12) + hex.slice(13, 16) + hex.slice(17);
}

/**
 * Fill any integer TypedArray with CSPRNG bytes, as the Web Crypto method of
 * the same name does. Returns the array it was handed, again like the original.
 */
export function getRandomValues(typedArray) {
  const bytes = new Uint8Array(
    typedArray.buffer,
    typedArray.byteOffset,
    typedArray.byteLength,
  );
  for (let offset = 0; offset < bytes.length; offset += BYTES_PER_UUID) {
    const nibbles = randomNibbles();
    const span = Math.min(BYTES_PER_UUID, bytes.length - offset);
    for (let i = 0; i < span; i += 1) {
      bytes[offset + i] = parseInt(nibbles.substr(i * 2, 2), 16);
    }
  }
  return typedArray;
}

/**
 * lib0's other export. Nothing in the board's path touches it — yjs needs
 * randomness, not hashing — but leaving it `undefined` would turn a future
 * caller into a bare "property of undefined" read somewhere inside lib0. It
 * names itself instead.
 */
export const subtle = new Proxy(
  {},
  {
    get(_target, property) {
      throw new Error(
        `lib0/webcrypto: SubtleCrypto.${String(property)} is not available on native. ` +
          'This shim provides getRandomValues only; add a real WebCrypto ' +
          'implementation if a caller needs digest or sign.',
      );
    },
  },
);

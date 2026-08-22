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
/** Raw digest: 32 bytes. */
export declare function sha256(input: Uint8Array): Uint8Array;
/** Lower-case hex digest — the form every baked artifact records. */
export declare function sha256Hex(input: Uint8Array): string;
/**
 * sha-256 hex of values as little-endian float32 bytes — the convention
 * `tools/bake_identity.py` uses, and therefore the convention every
 * `identitySha256` in a baked artifact is expressed in.
 */
export declare function sha256Float32(values: ArrayLike<number>): string;

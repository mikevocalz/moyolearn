// What may be uploaded, and where it lands. Pure, and deliberately outside
// `presign.service.ts` for the reason `lead-stats.ts` sits outside its service:
// this is the part with branches a user can hit, and a module the test runner
// cannot import (because of `server-only`) is a module nobody checks.
// SOT: docs/decisions/bunny-storage-presign-spike.md
// SOT-KEYWORDS: presign rules media upload validation key ownership pure
import { MAX_BYTES, MEDIA_KINDS, type MediaKind } from './media.types.ts';

const ALLOWED: Record<MediaKind, readonly RegExp[]> = {
  image: [/^image\/(jpeg|png|webp|heic|heif|gif)$/],
  audio: [/^audio\/(m4a|mp4|mpeg|aac|wav|webm|ogg)$/, /^video\/mp4$/],
  document: [/^application\/pdf$/, /^text\/plain$/, /^application\/vnd\.openxmlformats-.+$/],
};

export class PresignRejected extends Error {}

/*
  A filename is user input that becomes part of a URL path, so it is REBUILT
  rather than sanitised — the safe set is spelled out and everything else
  collapses to a dash. Stripping "bad characters" from an attacker-supplied
  string is a denylist, and denylists are how `..%2f` gets through.
*/
export const safeName = (filename: string): string => {
  const dot = filename.lastIndexOf('.');
  const stem = (dot > 0 ? filename.slice(0, dot) : filename).toLowerCase();
  const ext = (dot > 0 ? filename.slice(dot + 1) : '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleaned = stem.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return ext ? `${cleaned || 'file'}.${ext}` : cleaned || 'file';
};

/** Throws `PresignRejected` with a sentence the user can act on. */
export function assertUploadable(kind: MediaKind, contentType: string, size: number): void {
  if (!ALLOWED[kind]?.some((re) => re.test(contentType))) {
    throw new PresignRejected(`${contentType || 'That file type'} can’t be uploaded here.`);
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw new PresignRejected('That file appears to be empty.');
  }
  if (size > MAX_BYTES[kind]) {
    throw new PresignRejected(
      `That file is larger than the ${Math.round(MAX_BYTES[kind] / (1024 * 1024))} MB limit.`,
    );
  }
}

/**
 * Whose folder an upload lands in, decided in ONE place.
 *
 * An org shares a folder: a school's uploads are the school's, and `ctx.orgId`
 * is what a district's media is filed under. A family account has no org, so the
 * learner is the owner.
 *
 * Extracted from `presign.service.ts` rather than left inline because erasure
 * has to answer the same question in reverse — "which objects are this
 * learner's" — and two copies of this expression is how a forget-everything
 * ends up deleting a prefix nobody writes to.
 */
export const mediaOwner = (learnerId: string, orgId: string | undefined): string =>
  orgId ?? learnerId;

/**
 * Which storage prefixes hold THIS learner's uploads and nobody else's — or the
 * reason there is no such answer.
 *
 * A discriminated union rather than an empty array, because "delete nothing" and
 * "we cannot tell whose these are" are opposite facts that an empty list spells
 * identically, and the second one has to reach a guardian's screen.
 *
 * WHEN THERE IS NO ANSWER. `mediaOwner` files an org's uploads under the ORG, so
 * a school learner's photograph sits at `image/<orgId>/<date>/<id>/…` beside
 * every classmate's, with no learner segment anywhere in the key. There is no
 * prefix that selects one child's objects, and the only enumeration that would
 * is the org's whole folder — i.e. deleting other children's bytes to satisfy
 * one family's request. So this refuses, and `forgetLearnerRecord` reports the
 * refusal instead of guessing. Fixing it means putting the learner in the key,
 * which is a migration of existing objects and not a branch in an eraser.
 */
export type LearnerMediaScope =
  | { readonly scoped: true; readonly prefixes: readonly string[] }
  | { readonly scoped: false; readonly reason: string };

export const learnerMediaScope = (
  learnerId: string,
  orgId: string | undefined,
): LearnerMediaScope =>
  orgId === undefined
    ? {
        scoped: true,
        // `${kind}/${owner}` is `buildKey`'s first two segments, and
        // `buildVoiceNoteKeys` writes its pair under `audio/${owner}` — so these
        // prefixes cover every object either function can mint, and no other
        // function mints one.
        prefixes: MEDIA_KINDS.map((kind) => `${kind}/${learnerId}`),
      }
    : {
        scoped: false,
        reason:
          'Uploads on a school account are stored under the school, not the child, ' +
          'so we cannot tell which files are hers without touching other children’s. ' +
          'They are deleted on their own seven-day schedule.',
      };

/**
 * The object key, built from the caller's identity rather than their request.
 *
 * `owner` comes from `ctx` so nobody can write into another learner's folder by
 * asking. The date and per-upload id mean two uploads of the same filename are
 * two objects — which is what makes replace-keeps-history possible instead of
 * the CDN serving stale bytes from a reused path.
 */
export const buildKey = (
  kind: MediaKind,
  owner: string,
  filename: string,
  id: string,
  now: Date,
): string => `${kind}/${owner}/${now.toISOString().slice(0, 10)}/${id}/${safeName(filename)}`;

/**
 * The two keys a voice note needs, in ONE folder.
 *
 * `features/editor/upload.ts` requires the waveform image to sit beside the
 * audio — `<base>/waveform.png` next to `<base>/audio.m4a` — because the inline
 * editor node carries only the image URL and the audio URL has to be
 * recoverable from it (`audioUrlFromWaveform`).
 *
 * They are minted TOGETHER rather than by two calls, and that is the security
 * point as much as the convenience one: two independent presigns would land in
 * two different folders, and the only way to make them agree would be to let the
 * client name the second key — which is exactly the thing the rest of this file
 * refuses to allow.
 */
export const buildVoiceNoteKeys = (
  owner: string,
  audioExtension: string,
  id: string,
  now: Date,
): { audio: string; waveform: string } => {
  const ext = audioExtension.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'm4a';
  const base = `audio/${owner}/${now.toISOString().slice(0, 10)}/${id}`;
  return { audio: `${base}/audio.${ext}`, waveform: `${base}/waveform.png` };
};

// ── Reading side: whose object is this? ──────────────────────────────────────

/**
 * The storage key a CDN URL names, or null when the URL is not under `base`.
 *
 * `signCdnUrl` already refuses to sign a URL outside the zone; this answers the
 * question BEFORE that, for the ownership check, and it answers it on the
 * DECODED path. Bunny decodes before it serves, so `image/%6Fwner/...` and
 * `image/owner/...` are the same object to the CDN, and an ownership check on
 * the raw string would compare the caller against a spelling of the owner the
 * server never sees. Anything that does not decode cleanly, or decodes to a
 * path with an empty, `.` or `..` segment, is not a key this product mints.
 */
export const storageKeyFromCdnUrl = (url: string, base: string): string | null => {
  if (!base || !url.startsWith(base)) return null;
  const raw = (url.slice(base.length).split(/[?#]/)[0] ?? '').replace(/^\/+/, '');
  if (raw === '') return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const segments = decoded.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return null;
  }
  if (/[\\\u0000-\u001f]/.test(decoded)) return null;
  return decoded;
};

/**
 * `BUNNY_MEDIA_PREFIX` as the upload adapter applies it: no leading or trailing
 * slash, empty when unset. One normaliser, because the write side
 * (`bunny.repository.ts:signUpload`) and the ownership checks below must agree
 * on the exact namespace — a second spelling is how a prefixed deployment ends
 * up refusing every key it just minted.
 */
export const normalizeMediaPrefix = (raw: string | undefined): string =>
  (raw ?? '').replace(/^\/+|\/+$/g, '');

/**
 * The owner segment of a storage key — `[<prefix>/]<kind>/<owner>/…`, the shape
 * `buildKey` and `buildVoiceNoteKeys` mint, under the namespace `signUpload`
 * prepends. Null for a key of any other shape, which the callers treat as "not
 * ours" rather than "anyone's".
 *
 * `prefix` is REQUIRED and EXACT: with a namespace configured, a key outside it
 * is not one this deployment wrote, and stripping "whatever comes first" would
 * let `image/<victim>/…` and `<anything>/image/<victim>/…` both resolve. Only the
 * owner is read from the stripped form; callers compare and sign the full key.
 */
export const mediaKeyOwner = (key: string, prefix: string): string | null => {
  const namespace = normalizeMediaPrefix(prefix);
  let local = key;
  if (namespace !== '') {
    if (!key.startsWith(`${namespace}/`)) return null;
    local = key.slice(namespace.length + 1);
  }
  const [kind, owner, ...rest] = local.split('/');
  if (kind === undefined || owner === undefined || rest.length === 0) return null;
  if (!(MEDIA_KINDS as readonly string[]).includes(kind)) return null;
  return owner === '' ? null : owner;
};

export class MediaKeyRejected extends Error {}

/**
 * A client-reported upload must sit in the CALLER'S folder, at the CDN URL that
 * folder implies. The attachment route used to store whatever `url` and
 * `storageKey` arrived, which let a learner attach any address at all — an
 * image of somebody else's homework, or a page off the open web — and have it
 * rendered to their guardian as their own. The key is checked against
 * `mediaOwner(ctx)`, the same function that chose the folder at presign time,
 * and the URL is checked against the key, so neither can name a third thing.
 */
export function assertOwnMediaKey(
  owner: string,
  storageKey: string,
  url: string,
  cdnBase: string,
  mediaPrefix: string,
): void {
  if (mediaKeyOwner(storageKey, mediaPrefix) !== owner) {
    throw new MediaKeyRejected('storageKey is not under this account’s media folder');
  }
  if (storageKeyFromCdnUrl(url, cdnBase) !== storageKey) {
    throw new MediaKeyRejected('url does not name storageKey on this product’s CDN');
  }
}

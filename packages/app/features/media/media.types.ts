// Shapes both sides of the upload boundary need. Kept out of the service so a
// client can import them without pulling `server-only` in behind them.
// SOT-KEYWORDS: media types upload presign kind limits shared
/**
 * Every kind there is, as a value — because erasure has to ENUMERATE them.
 *
 * `buildKey` puts the kind first in the object key, so "everything this learner
 * uploaded" is one prefix per kind and nothing else. A hand-written union plus a
 * separately hand-written list is how a fourth kind ships with a folder no
 * forget-everything ever walks, so the type is derived from the list rather than
 * declared beside it (CLAUDE.md §Types).
 */
export const MEDIA_KINDS = ['image', 'audio', 'document'] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export interface PresignResult {
  /** PUT the bytes here. Carries its own signature; send no credentials. */
  uploadUrl: string;
  /** Where the object will be readable once the PUT succeeds. */
  publicUrl: string;
  /** The object key, so a caller can derive siblings — e.g. a waveform. */
  key: string;
  /** Seconds until `uploadUrl` stops working. */
  expiresIn: number;
}

/**
 * Ceilings per kind, stated here so the UI can print them BEFORE the picker
 * opens. A limit a user meets as a rejection is a limit they meet too late.
 */
export const MAX_BYTES: Record<MediaKind, number> = {
  image: 20 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  document: 25 * 1024 * 1024,
};

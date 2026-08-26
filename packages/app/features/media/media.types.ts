// Shapes both sides of the upload boundary need. Kept out of the service so a
// client can import them without pulling `server-only` in behind them.
// SOT-KEYWORDS: media types upload presign kind limits shared
export type MediaKind = 'image' | 'audio' | 'document';

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

// The pure half of doc 30's upload surfaces: per-file verdicts at drop time,
// the count-accurate primary button, and the transfer-row state machine the
// tray renders. Pure — no storage, no fetch, no platform imports — so the
// behaviours that only show up on a bad network are testable without one.
//
// Validation delegates to `assertUploadable`, the same rule the presign route
// enforces, so the zone can never accept a file the server will reject: one
// rulebook, read twice (doc 30 §3 — problems surface on drop, not on upload).
// SOT: docs/pack/30-upload-surfaces-spec.md §3–§5 · docs/pack/29-bunny-media-spec.md §4
// SOT-KEYWORDS: upload surfaces validation verdict transfer row reducer tabs tray pure
import { MAX_BYTES, type MediaKind } from './media.types.ts';
import { assertUploadable, PresignRejected } from './presign.rules.ts';

/** A file as the picker or the drop hands it over, before any verdict. */
export interface CandidateFile {
  uri: string;
  name: string;
  type: string;
  size: number;
}

/**
 * MediaKind from the MIME type — moved here from `queued-uploader` so the
 * dropzone and the queue read the same routing. `video/mp4` is audio on
 * purpose: a recorder writing an .mp4 container is still a voice note, and the
 * presign rules already say so.
 */
export function kindForMime(mimeType: string): MediaKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/') || mimeType === 'video/mp4') return 'audio';
  return 'document';
}

/**
 * One verdict per file. A discriminated union rather than an errors array,
 * so a row cannot simultaneously claim a kind and a rejection — the invalid
 * combination is unrepresentable (CLAUDE.md §Types).
 */
export type FileVerdict =
  | { readonly ok: true; readonly file: CandidateFile; readonly kind: MediaKind }
  | { readonly ok: false; readonly file: CandidateFile; readonly reason: string };

/**
 * Every file gets its own verdict — one bad file never poisons the batch
 * (doc 30 §3, the Whop pattern). The reason is the server's own sentence,
 * because `assertUploadable` is the rule the presign route will apply anyway.
 */
export function validateCandidates(files: readonly CandidateFile[]): FileVerdict[] {
  return files.map((file) => {
    const kind = kindForMime(file.type);
    try {
      assertUploadable(kind, file.type, file.size);
      return { ok: true, file, kind };
    } catch (error) {
      if (error instanceof PresignRejected) return { ok: false, file, reason: error.message };
      throw error;
    }
  });
}

/**
 * The primary button reflects reality: `Upload 0 files`, disabled, rather than
 * an enabled button that will fail (doc 30 §3).
 */
export function primaryAction(verdicts: readonly FileVerdict[]): {
  label: string;
  enabled: boolean;
  count: number;
} {
  const count = verdicts.filter((v) => v.ok).length;
  return {
    label: `Upload ${count} ${count === 1 ? 'file' : 'files'}`,
    enabled: count > 0,
    count,
  };
}

/** The footer's honest count of what will NOT upload. Null when all is well. */
export function verdictSummary(verdicts: readonly FileVerdict[]): string | null {
  const invalid = verdicts.filter((v) => !v.ok).length;
  if (invalid === 0) return null;
  return `${invalid} invalid ${invalid === 1 ? 'file' : 'files'}`;
}

/**
 * What the web `<input accept>` should offer per kind. Broader than the
 * allowlist on purpose — the picker filters for convenience, the verdict
 * (`validateCandidates`) is the rule; a file smuggled past `accept` still
 * meets `assertUploadable` on drop.
 */
const ACCEPT: Record<MediaKind, string> = {
  image: 'image/*',
  audio: 'audio/*,video/mp4',
  document: 'application/pdf,text/plain,.pdf,.txt,.docx,.xlsx,.pptx',
};

export const acceptForKinds = (kinds: readonly MediaKind[]): string =>
  kinds.map((kind) => ACCEPT[kind]).join(',');

/** The ceilings, phrased for printing INSIDE the zone before first interaction (doc 30 §2). */
export function zoneRules(kinds: readonly MediaKind[]): string {
  const names: Record<MediaKind, string> = {
    image: 'Images',
    audio: 'Audio',
    document: 'Documents',
  };
  return kinds
    .map((kind) => `${names[kind]} up to ${Math.round(MAX_BYTES[kind] / (1024 * 1024))} MB`)
    .join(' · ');
}

/**
 * Bytes for the `data` mono column. KB floor (a 512-byte file reading "1 KB"
 * beats "512 B" jitter in a column meant for comparison), one decimal only
 * below 10 of a unit — precision the eye can actually use.
 */
export function formatBytes(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.ceil(kb)} KB`;
  const mb = kb / 1024;
  return mb < 10 ? `${Math.round(mb * 10) / 10} MB` : `${Math.round(mb)} MB`;
}

// ---------------------------------------------------------------------------
// The transfer rows the tray renders (doc 29 §4's two-phase model).
// ---------------------------------------------------------------------------

/**
 * queued → uploading → (processing →) done, or → failed → queued again on
 * retry. `processing` exists because a video is NOT done when bytes hit 100% —
 * it is Bunny transcoding, with no honest percentage.
 */
export type TransferStatus = 'queued' | 'uploading' | 'processing' | 'done' | 'failed';

export interface TransferRow {
  id: string;
  name: string;
  mimeType: string;
  status: TransferStatus;
  bytesSent: number;
  /** Null while the total is unknown — an indeterminate bar. */
  bytesTotal: number | null;
  error: string | null;
}

export type TransferEvent =
  | { type: 'queued'; id: string; name: string; mimeType: string; bytesTotal: number | null }
  | { type: 'begin'; id: string }
  | { type: 'progress'; id: string; bytesSent: number; bytesTotal: number }
  | { type: 'processing'; id: string }
  | { type: 'done'; id: string }
  | { type: 'failed'; id: string; error: string }
  | { type: 'retried'; id: string }
  | { type: 'removed'; id: string }
  | { type: 'cleared' };

/** Statuses a transfer can still leave on its own. Terminal ones need an event with intent. */
const ACTIVE: readonly TransferStatus[] = ['queued', 'uploading', 'processing'];

/**
 * The reducer the tray store applies. Events for unknown ids are no-ops rather
 * than errors: a background drain can finish minutes after the user cleared the
 * tray, and its late report must not resurrect a row nobody is waiting on.
 * Likewise a late `progress` cannot demote a row that already finished.
 */
export function applyTransfer(
  rows: readonly TransferRow[],
  event: TransferEvent,
): TransferRow[] {
  switch (event.type) {
    case 'queued':
      if (rows.some((r) => r.id === event.id)) return [...rows];
      return [
        ...rows,
        {
          id: event.id,
          name: event.name,
          mimeType: event.mimeType,
          status: 'queued',
          bytesSent: 0,
          bytesTotal: event.bytesTotal,
          error: null,
        },
      ];
    case 'cleared':
      return rows.filter((r) => r.status !== 'done');
    case 'removed':
      return rows.filter((r) => r.id !== event.id);
    default:
      return rows.map((row) => {
        if (row.id !== event.id) return row;
        switch (event.type) {
          case 'begin':
            return ACTIVE.includes(row.status) ? { ...row, status: 'uploading' } : row;
          case 'progress':
            // Bytes at 100% stays `uploading` — `done` is an event, never an
            // inference from a byte count (doc 29 §4).
            return ACTIVE.includes(row.status)
              ? { ...row, status: 'uploading', bytesSent: event.bytesSent, bytesTotal: event.bytesTotal }
              : row;
          case 'processing':
            return ACTIVE.includes(row.status) ? { ...row, status: 'processing' } : row;
          case 'done':
            return { ...row, status: 'done', bytesSent: row.bytesTotal ?? row.bytesSent, error: null };
          case 'failed':
            // Bytes are KEPT: TUS retains its fingerprint, so retry resumes
            // from here rather than from zero (doc 30 §4).
            return { ...row, status: 'failed', error: event.error };
          case 'retried':
            return row.status === 'failed' ? { ...row, status: 'queued', error: null } : row;
        }
      });
  }
}

export type TrayTab = 'all' | 'active' | 'completed' | 'failed';

export const TRAY_TABS: readonly TrayTab[] = ['all', 'active', 'completed', 'failed'];

export function rowsForTab(rows: readonly TransferRow[], tab: TrayTab): TransferRow[] {
  switch (tab) {
    case 'all':
      return [...rows];
    case 'active':
      return rows.filter((r) => ACTIVE.includes(r.status));
    case 'completed':
      return rows.filter((r) => r.status === 'done');
    case 'failed':
      return rows.filter((r) => r.status === 'failed');
  }
}

/**
 * The minimized tray's one line — `2 uploading (25%)`, the Proton Drive shape.
 * Null when there is nothing to say, which is the signal to render no tray.
 */
export function trayTitle(rows: readonly TransferRow[]): string | null {
  if (rows.length === 0) return null;
  const active = rowsForTab(rows, 'active');
  if (active.length > 0) {
    const total = active.reduce((sum, r) => sum + (r.bytesTotal ?? 0), 0);
    const sent = active.reduce((sum, r) => sum + r.bytesSent, 0);
    const pct = total > 0 ? Math.round((sent / total) * 100) : 0;
    return `${active.length} uploading (${pct}%)`;
  }
  const failed = rowsForTab(rows, 'failed');
  if (failed.length > 0) return `${failed.length} failed`;
  return 'Done';
}

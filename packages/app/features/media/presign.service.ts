import 'server-only';
// Minting a short-lived upload credential (doc 29 §3).
//
// The bytes never touch our server. The client asks for permission to write ONE
// object, gets a URL that expires in minutes, and uploads straight to Bunny.
// That is not a performance trick — a 200MB video proxied through a serverless
// function is a timeout, a memory ceiling and a bill, three ways of failing at
// the same job.
//
// WHAT THE CLIENT MAY DECIDE, and what it may not: it names the file and its
// type, because only it knows those. It does NOT choose where the object lands.
// The key is built here from `ctx`, so a caller cannot write into another
// learner's folder by asking nicely — the same reason `orgId` is never a
// parameter anywhere else in this codebase.
// SOT: docs/decisions/bunny-storage-presign-spike.md · CLAUDE.md §The block
// SOT-KEYWORDS: presign upload media bunny storage service short-lived credential
import type { ProtectedCtx } from '../../core/protected-operation.ts';
import { MAX_BYTES, type MediaKind, type PresignResult } from './media.types.ts';
// Pure, and therefore testable — see the header of that file.
import {
  assertUploadable,
  buildKey,
  buildVoiceNoteKeys,
  PresignRejected,
} from './presign.rules.ts';

export { PresignRejected };

export { MAX_BYTES, type MediaKind, type PresignResult };

/** What a caller is allowed to ask for. */
export interface PresignRequest {
  filename: string;
  contentType: string;
  /** Bytes. Checked against the ceiling before a URL is minted, not after. */
  size: number;
  kind: MediaKind;
}

/*
  Audio is its own kind rather than folded into `document`, because it is the one
  that has to land beside a sibling: a voice note's waveform image lives at
  `<base>/<id>/waveform.png` next to `<base>/<id>/audio.m4a`, and the inline
  editor node carries only the waveform URL (features/editor/upload.ts).
*/

/** Repository port — the caller provides the Bunny adapter. */
export type SignUpload = (key: string, contentType: string) => PresignResult;

export function presignUpload(
  ctx: ProtectedCtx,
  request: PresignRequest,
  signUpload: SignUpload,
  now: () => Date = () => new Date(),
): PresignResult {
  const { kind, contentType, size, filename } = request;
  assertUploadable(kind, contentType, size);


  /*
    Identity from ctx, and the learner's own folder — so an erasure request is a
    prefix delete rather than a search (doc 19's retention rules), and so two
    people cannot collide on a filename.

    `randomUUID` per upload, not per file name: the same photo picked twice is
    two objects, which is what makes replace-keeps-history possible instead of
    the CDN serving stale bytes from a reused path.
  */
  const owner = ctx.orgId ?? ctx.learnerId;
  const id = globalThis.crypto.randomUUID();
  const key = buildKey(kind, owner, filename, id, now());

  return signUpload(key, contentType);
}

export interface VoiceNotePresign {
  audio: PresignResult;
  waveform: PresignResult;
}

/**
 * A voice note is two objects that must share a folder, so it gets one call.
 *
 * The waveform is rendered on the device from the levels captured while
 * recording, then uploaded beside the audio. Rendering it server-side would mean
 * shipping the audio to us first, which is the one thing this architecture
 * exists to avoid.
 */
export function presignVoiceNote(
  ctx: ProtectedCtx,
  request: { contentType: string; size: number; audioExtension: string },
  signUpload: SignUpload,
  now: () => Date = () => new Date(),
): VoiceNotePresign {
  assertUploadable('audio', request.contentType, request.size);

  const owner = ctx.orgId ?? ctx.learnerId;
  const id = globalThis.crypto.randomUUID();
  const keys = buildVoiceNoteKeys(owner, request.audioExtension, id, now());

  return {
    audio: signUpload(keys.audio, request.contentType),
    waveform: signUpload(keys.waveform, 'image/png'),
  };
}

'use client';
// The implementation `features/editor/upload.ts` has been describing and waiting
// for. Until now `uploadVoiceNote` was a type nobody supplied, so the editor took
// its fallback branch and wrote a `file://` link into the note — a link that is
// dead the moment the recording is cleaned up or the app is reinstalled.
//
// Order matters and is not arbitrary: BOTH objects are uploaded before anything
// is returned. The editor inserts the waveform image and derives the audio URL
// from it, so a note holding a waveform whose sibling audio never landed is a
// player that 404s forever.
// SOT: packages/app/features/editor/upload.ts
// SOT-KEYWORDS: voice note upload audio waveform bunny presign editor inline
import { uploadTransport } from './transport';
import type { PresignResult } from './media.types.ts';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

export interface VoiceNoteSources {
  /** Local recording URI. */
  uri: string;
  /** Seconds, measured at record time. */
  duration: number;
  /** e.g. `audio/m4a`. Signed by the server, so it must be sent verbatim. */
  contentType: string;
  size: number;
  /** PNG bytes of the rendered waveform, and its own size. */
  waveform: { uri: string; size: number };
}

export interface UploadedVoiceNote {
  audioUrl: string;
  waveformUrl: string;
  duration: number;
}

const extensionOf = (contentType: string, uri: string): string => {
  const fromUri = uri.split('?')[0]?.split('.').pop() ?? '';
  if (/^[a-z0-9]{2,5}$/i.test(fromUri)) return fromUri.toLowerCase();
  return contentType.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'm4a';
};

/**
 * Uploads a recording and its waveform, and returns the URLs a note may keep.
 *
 * `onProgress` reports the AUDIO only. The waveform is a few kilobytes next to
 * megabytes of audio, so folding it into one percentage would make the bar
 * stall at 99% for the part nobody is waiting on.
 */
export async function uploadVoiceNote(
  sources: VoiceNoteSources,
  onProgress?: (sent: number, total: number) => void,
  signal?: AbortSignal,
): Promise<UploadedVoiceNote> {
  const res = await fetch(`${API_URL}/api/media/voice-note`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contentType: sources.contentType,
      size: sources.size,
      audioExtension: extensionOf(sources.contentType, sources.uri),
    }),
    signal,
  });
  const body = (await res.json()) as
    | { ok: true; audio: PresignResult; waveform: PresignResult }
    | { ok: false; error: string };
  if (!res.ok || body.ok !== true) {
    throw new Error(body.ok === false ? body.error : `Could not start the upload (${res.status})`);
  }

  await uploadTransport({
    file: { uri: sources.uri, name: 'audio', type: sources.contentType, size: sources.size },
    url: body.audio.uploadUrl,
    contentType: sources.contentType,
    onProgress: (sent, total) => onProgress?.(sent, total),
    signal,
  });

  await uploadTransport({
    file: { uri: sources.waveform.uri, name: 'waveform.png', type: 'image/png', size: sources.waveform.size },
    url: body.waveform.uploadUrl,
    contentType: 'image/png',
    onProgress: () => {},
    signal,
  });

  return {
    audioUrl: body.audio.publicUrl,
    waveformUrl: body.waveform.publicUrl,
    duration: sources.duration,
  };
}

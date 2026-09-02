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
import type { VoiceRecording } from '@acme/ui';
import { uploadTransport } from './transport';
import { renderWaveform } from './render-waveform';
import { fileSize } from './file-size';
import type { PresignResult } from './media.types.ts';
import { API_URL } from '../../core/api-url.ts';

/** 16:5 — wide and short, so a waveform reads as audio rather than a photo. */
const WAVEFORM_WIDTH = 320;
const WAVEFORM_HEIGHT = 100;

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
  recording: VoiceRecording,
  onProgress?: (sent: number, total: number) => void,
  signal?: AbortSignal,
): Promise<UploadedVoiceNote> {
  /*
    The waveform is drawn HERE rather than by the caller, so every call site
    cannot get it subtly different — the image has to match the live meter, and
    it has to land beside the audio. One place owns both facts.
  */
  const waveform = await renderWaveform(recording.levels, WAVEFORM_WIDTH, WAVEFORM_HEIGHT);
  const contentType = recording.uri.endsWith('.webm') ? 'audio/webm' : 'audio/m4a';
  const size = await fileSize(recording.uri);
  const res = await fetch(`${API_URL}/api/media/voice-note`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contentType,
      size,
      audioExtension: extensionOf(contentType, recording.uri),
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
    file: { uri: recording.uri, name: 'audio', type: contentType, size },
    url: body.audio.uploadUrl,
    contentType,
    onProgress: (sent, total) => onProgress?.(sent, total),
    signal,
  });

  await uploadTransport({
    file: { uri: waveform.uri, name: 'waveform.png', type: 'image/png', size: waveform.size },
    url: body.waveform.uploadUrl,
    contentType: 'image/png',
    onProgress: () => {},
    signal,
  });

  return {
    audioUrl: body.audio.publicUrl,
    waveformUrl: body.waveform.publicUrl,
    duration: recording.duration,
  };
}

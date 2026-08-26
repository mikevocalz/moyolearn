// Bunny Stream signing and video creation. Pure: takes its credentials as
// arguments and reads no environment, so it can be exercised by a script and a
// test — `bunny-stream.repository.ts` is the `server-only` wrapper that supplies
// env. Same split as `bunny-sign.ts`, for the same reason.
// SOT-KEYWORDS: bunny stream sign tus video signature pure library
import { createHash } from 'node:crypto';

export interface StreamConfig {
  libraryId: string;
  apiKey: string;
  /** Playback host, e.g. https://vz-xxxx.b-cdn.net — no trailing slash. */
  pullZone: string;
}

/** Creates the video row. TUS signs against a videoId, so this must run first. */
export async function createVideo(config: StreamConfig, title: string): Promise<string> {
  const res = await fetch(`https://video.bunnycdn.com/library/${config.libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: config.apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Bunny Stream refused the video (${res.status})`);
  const body = (await res.json()) as { guid?: string };
  if (!body.guid) throw new Error('Bunny Stream returned no video id.');
  return body.guid;
}

/**
 * Two hours, not the fifteen minutes a Storage presign gets.
 *
 * This signature authorises a RESUMABLE upload, and the point of TUS is that a
 * phone on a train picks the transfer back up. A credential that expires
 * mid-upload defeats the protocol it is authorising. Scope is still one video.
 */
export const STREAM_TTL_SECONDS = 2 * 60 * 60;

export function signUpload(config: StreamConfig, videoId: string, now = Date.now()) {
  const expire = Math.floor(now / 1000) + STREAM_TTL_SECONDS;
  return {
    endpoint: 'https://video.bunnycdn.com/tusupload',
    libraryId: config.libraryId,
    expire,
    // Bunny's own scheme — not SigV4. Order matters and is not alphabetical.
    signature: createHash('sha256')
      .update(`${config.libraryId}${config.apiKey}${expire}${videoId}`)
      .digest('hex'),
    playbackUrl: `${config.pullZone}/${videoId}/playlist.m3u8`,
    thumbnailUrl: `${config.pullZone}/${videoId}/thumbnail.jpg`,
  };
}

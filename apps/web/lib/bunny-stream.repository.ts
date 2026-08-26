// Bunny Stream — the only place the Stream API key is read.
//
// Creating the video row is a server call because it needs that key, and it has
// to happen before the client can upload: TUS needs a videoId to sign against.
// SOT: CLAUDE.md §The block
// SOT-KEYWORDS: bunny stream repository video tus signature library upload
import 'server-only';
import { createHash } from 'node:crypto';
import type { CreateStreamVideo, SignStreamUpload } from '@acme/app/server';

const env = () => {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_ACCESS_KEY;
  const pullZone = process.env.NEXT_PUBLIC_BUNNY_STREAM_PULL_ZONE_URL;
  if (!libraryId || !apiKey || !pullZone) {
    throw new Error('Bunny Stream is not configured — see .env.example.');
  }
  return { libraryId, apiKey, pullZone: pullZone.replace(/\/+$/, '') };
};

export const createStreamVideo: CreateStreamVideo = async (title) => {
  const { libraryId, apiKey } = env();
  const res = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
    method: 'POST',
    headers: { AccessKey: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Bunny Stream refused the video (${res.status})`);
  const body = (await res.json()) as { guid?: string };
  if (!body.guid) throw new Error('Bunny Stream returned no video id.');
  return body.guid;
};

/**
 * Two hours, not fifteen minutes.
 *
 * Unlike a Storage presign this signature covers a RESUMABLE upload: the point
 * of TUS is that a phone on a train can pick the transfer back up, and a
 * credential that expires mid-upload defeats the protocol it is authorising.
 * The scope is still one video, which is what bounds it.
 */
const TTL_SECONDS = 2 * 60 * 60;

export const signStreamUpload: SignStreamUpload = (videoId) => {
  const { libraryId, apiKey, pullZone } = env();
  const expire = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  return {
    endpoint: 'https://video.bunnycdn.com/tusupload',
    libraryId,
    expire,
    signature: createHash('sha256').update(`${libraryId}${apiKey}${expire}${videoId}`).digest('hex'),
    playbackUrl: `${pullZone}/${videoId}/playlist.m3u8`,
    thumbnailUrl: `${pullZone}/${videoId}/thumbnail.jpg`,
  };
};

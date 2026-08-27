// Bunny Stream — the only place the Stream API key is read.
//
// The signing, the API calls and the retention sweep's list/delete pair live in
// `bunny-stream-sign.ts`, which is pure. This file supplies environment and
// nothing else, so the logic stays testable without a `server-only` barrier
// around it.
// SOT: CLAUDE.md §The block · packages/app/features/media/retention.ts
// SOT-KEYWORDS: bunny stream repository video tus signature env retention sweep delete expiry
import 'server-only';
import type { CreateStreamVideo, SignStreamUpload } from '@acme/app/server';
import { MEDIA_TTL_DAYS } from '@acme/app/features/media/retention.ts';
import {
  createVideo,
  deleteVideos,
  listVideos,
  signUpload,
  type StreamConfig,
} from './bunny-stream-sign';

const config = (): StreamConfig => {
  const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = process.env.BUNNY_STREAM_ACCESS_KEY;
  const pullZone = process.env.NEXT_PUBLIC_BUNNY_STREAM_PULL_ZONE_URL;
  if (!libraryId || !apiKey || !pullZone) {
    throw new Error('Bunny Stream is not configured — see .env.example.');
  }
  return { libraryId, apiKey, pullZone: pullZone.replace(/\/+$/, '') };
};

export const createStreamVideo: CreateStreamVideo = (title) => createVideo(config(), title);
export const signStreamUpload: SignStreamUpload = (videoId) => signUpload(config(), videoId);

/**
 * Deletes every video in the Stream library past `MEDIA_TTL_DAYS`.
 *
 * THE GAP THIS CLOSES: `createVideo` above made videos and nothing ever removed
 * one. `app/api/media/sweep` walked the storage zone — photographs, voice notes
 * — and Stream is a different product on a different host with a different
 * credential, so a child's video sat in the library forever while the same
 * child's photograph of the same session was deleted on day seven.
 *
 * It lives HERE rather than in the sweep route because of the sentence at the
 * top of this file: this is the only place the Stream API key is read. The route
 * resolves its storage credentials inline, which is a duplication that predates
 * this and is confined to one product; adding a second env read for Stream would
 * be copying that rather than inheriting it.
 *
 * By AGE off the library listing, not from a database record, for the reason
 * `bunny-list.ts` gives: the orphans a record-driven sweep misses are the ones
 * nobody will ever notice. `MEDIA_TTL_DAYS` is shared with the storage half —
 * one published window for a child's raw capture, whichever product holds it.
 */
export async function sweepStreamVideos(now = Date.now()): Promise<{
  scanned: number;
  expired: number;
  deleted: string[];
  failed: string[];
}> {
  const stream = config();
  const cutoff = now - MEDIA_TTL_DAYS * 86_400_000;
  const videos = await listVideos(stream);
  const expired = videos
    // An unreadable upload date is left ALONE, the same rule the storage sweep
    // applies to an unparseable `lastChanged`.
    .filter((video) => !Number.isNaN(video.uploadedAt) && video.uploadedAt <= cutoff)
    .map((video) => video.guid);
  const { deleted, failed } = await deleteVideos(stream, expired);
  return { scanned: videos.length, expired: expired.length, deleted, failed };
}

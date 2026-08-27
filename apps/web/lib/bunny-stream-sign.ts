// Bunny Stream signing, video creation, and the listing and deletion a retention
// sweep needs. Pure: takes its credentials as arguments and reads no
// environment, so it can be exercised by a script and a test —
// `bunny-stream.repository.ts` is the `server-only` wrapper that supplies env.
// Same split as `bunny-sign.ts`, for the same reason.
//
// The listing and deletion halves mirror `bunny-list.ts` / `bunny-delete.ts`
// exactly, against the OTHER Bunny product: Stream is its own API on its own
// host with its own auth, and a video uploaded through TUS never appears in the
// storage zone those two walk. That is how the videos ended up with no retention
// path at all while the photographs had one.
// SOT: packages/app/features/media/retention.ts · apps/web/lib/bunny-list.ts
// SOT-KEYWORDS: bunny stream sign tus video signature pure library list delete retention sweep
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

/** One video in a Stream library, reduced to what a sweep decides on. */
export interface StreamVideo {
  guid: string;
  /** Epoch ms of the upload, already normalised — see `uploadedAtMs`. */
  uploadedAt: number;
}

interface RawVideo {
  guid?: string;
  dateUploaded?: string;
}

/** Bunny's page cap. Larger values are accepted and silently clamped. */
const PAGE_SIZE = 100;

/**
 * Bunny returns `dateUploaded` as `2026-08-27T03:30:35.109` — ISO-shaped with NO
 * timezone, and it is UTC. `Date.parse` reads a bare date-time as LOCAL time, so
 * on a server west of Greenwich every video would look hours YOUNGER than it is
 * and a sweep on a 7-day window would keep each one an extra day. A `Z` is
 * appended when no offset is present rather than trusting the runtime's zone.
 *
 * Returns `NaN` for anything unreadable, which the sweep treats as "leave it
 * alone" — the same rule the storage sweep applies to an unparseable
 * `lastChanged`. Deleting on a date we could not read would be guessing with a
 * child's data.
 */
export function uploadedAtMs(dateUploaded: string | undefined): number {
  if (dateUploaded === undefined) return Number.NaN;
  const normalised = /(?:Z|[+-]\d{2}:?\d{2})$/.test(dateUploaded)
    ? dateUploaded
    : `${dateUploaded}Z`;
  return Date.parse(normalised);
}

/**
 * Every video in the library, paged to the end.
 *
 * Listed rather than read from a database record, for the reason
 * `bunny-list.ts` gives about the storage zone: a sweep that only deletes what
 * the app remembers uploading misses a crash between `createVideo` and the
 * insert, and those orphans are exactly the ones nobody notices. Here the gap is
 * wider still — `createVideo` makes the video row BEFORE the TUS transfer
 * begins, so an upload the child abandoned leaves a video behind that no
 * attachment record ever pointed at.
 */
export async function listVideos(config: StreamConfig): Promise<StreamVideo[]> {
  const videos: StreamVideo[] = [];
  for (let page = 1; ; page += 1) {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${config.libraryId}/videos?page=${page}&itemsPerPage=${PAGE_SIZE}`,
      { headers: { AccessKey: config.apiKey, accept: 'application/json' } },
    );
    if (!res.ok) throw new Error(`Bunny Stream list failed (${res.status})`);
    const body = (await res.json()) as { items?: RawVideo[] };
    const items = body.items ?? [];
    for (const item of items) {
      if (item.guid === undefined) continue;
      videos.push({ guid: item.guid, uploadedAt: uploadedAtMs(item.dateUploaded) });
    }
    // A short page is the last page. `totalItems` is also returned, but paging
    // on the count means a video deleted mid-walk shifts the pages under us.
    if (items.length < PAGE_SIZE) return videos;
  }
}

/**
 * Deletes one video. Resolves `true` when it is gone.
 *
 * A 404 counts as success, exactly as in `bunny-delete.ts`: the video being
 * already absent is the state the caller wanted, and treating it as a failure
 * makes a sweep retry forever over things that no longer exist.
 */
export async function deleteVideo(config: StreamConfig, videoId: string): Promise<boolean> {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${config.libraryId}/videos/${encodeURIComponent(videoId)}`,
    { method: 'DELETE', headers: { AccessKey: config.apiKey } },
  );
  return res.ok || res.status === 404;
}

/** Deletes many, reporting what failed rather than throwing on the first. */
export async function deleteVideos(
  config: StreamConfig,
  videoIds: readonly string[],
): Promise<{ deleted: string[]; failed: string[] }> {
  const deleted: string[] = [];
  const failed: string[] = [];
  for (const videoId of videoIds) {
    try {
      if (await deleteVideo(config, videoId)) deleted.push(videoId);
      else failed.push(videoId);
    } catch {
      failed.push(videoId);
    }
  }
  return { deleted, failed };
}

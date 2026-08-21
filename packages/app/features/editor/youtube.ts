import { audioUrlFromWaveform, isWaveformUrl } from './upload.ts';
/**
 * Recognising YouTube links inside a note.
 *
 * The editor has no video node — `EnrichedTextInputInstance` exposes no embed
 * command — so a video is stored as an ordinary link and recognised again when
 * the note is DISPLAYED. That keeps the document valid HTML that any renderer
 * can read, and puts the player where a player belongs: the read view, not the
 * editing surface.
 */

/**
 * Every URL shape YouTube hands out: the watch page, the share shortlink, the
 * embed path, and Shorts. `v=` is matched anywhere in the query because share
 * links routinely carry `si=`, `t=` and list ids in front of it.
 */
const PATTERNS = [
  /(?:youtube\.com|youtube-nocookie\.com)\/watch\?(?:[^"'\s]*&)?v=([\w-]{11})/i,
  /youtu\.be\/([\w-]{11})/i,
  /(?:youtube\.com|youtube-nocookie\.com)\/embed\/([\w-]{11})/i,
  /(?:youtube\.com)\/shorts\/([\w-]{11})/i,
];

/** The 11-character video id, or null when the URL is not a YouTube one. */
export function youTubeVideoId(url: string): string | null {
  for (const pattern of PATTERNS) {
    const match = pattern.exec(url);
    if (match?.[1] !== undefined) return match[1];
  }
  return null;
}

/**
 * Playlist id from any YouTube URL carrying `list=`.
 *
 * Ids are not a fixed length the way video ids are — `PL…` user playlists,
 * `UU…`/`LL…` auto-generated ones and `RD…` mixes all differ — so this matches
 * the parameter rather than a shape. `WL` (Watch Later) and `LL` (Liked) are
 * excluded deliberately: they are private to the signed-in viewer and render as
 * an error inside an embed, which would look like a broken note.
 */
const PLAYLIST = /[?&]list=([\w-]+)/i;
const PRIVATE_LISTS = new Set(['WL', 'LL']);

export function youTubePlaylistId(url: string): string | null {
  const id = PLAYLIST.exec(url)?.[1];
  if (id === undefined || PRIVATE_LISTS.has(id)) return null;
  return id;
}

export interface YouTubeTarget {
  /** Present when the URL names a specific video. */
  videoId: string | null;
  /** Present when the URL carries a playable `list=`. */
  playlistId: string | null;
}

/**
 * What a YouTube URL should actually play.
 *
 * A share link from inside a playlist carries BOTH — "start at this video, in
 * this list" — and that is the shape worth preserving: dropping the list would
 * silently turn a lesson sequence into a single clip.
 */
export function youTubeTarget(url: string): YouTubeTarget | null {
  const videoId = youTubeVideoId(url);
  const playlistId = youTubePlaylistId(url);
  if (videoId === null && playlistId === null) return null;
  return { videoId, playlistId };
}

/**
 * The embed URL for a target. `videoseries` is YouTube's own entry point for a
 * list with no starting video; with a video id the list rides alongside it so
 * the player keeps its up-next queue.
 */
export function youTubeEmbedUrl({ videoId, playlistId }: YouTubeTarget): string {
  const base = 'https://www.youtube-nocookie.com/embed';
  if (videoId === null && playlistId !== null) {
    return `${base}/videoseries?list=${playlistId}`;
  }
  const suffix = playlistId === null ? '' : `?list=${playlistId}`;
  return `${base}/${videoId}${suffix}`;
}

export interface NoteSegment {
  kind: 'html' | 'video' | 'audio';
  /** HTML for `html`, the video id for `video`, the file URI for `audio`. */
  value: string;
  /** Link text, kept for an audio segment so the player can label itself. */
  label?: string;
  /**
   * Playlist id, when the recognised link carried one. Held beside the video id
   * rather than replacing it: a link shared from inside a playlist names both,
   * and the player needs both to start on the right video with the list intact.
   */
  playlistId?: string;
}

/** Audio the app recorded or attached. Matched on extension, because the note
 *  stores a plain link and nothing else marks it as audio. */
const AUDIO = /\.(m4a|mp3|wav|aac|caf|ogg)(\?|$)/i;

const ANCHOR = /<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;

/** An inline image node, which is how a video now sits IN the text flow. */
const IMAGE = /<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi;

/** Anchors and inline images, in document order — the order decides where each
 *  player lands in the read view, so they cannot be scanned separately. */
function mediaMatches(html: string): RegExpMatchArray[] {
  return [...html.matchAll(ANCHOR), ...html.matchAll(IMAGE)]
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
}

/**
 * Split note HTML into text runs and the videos found in it.
 *
 * The anchor is REMOVED where a video is recognised, rather than left beside
 * the player: showing a raw URL under its own preview is noise, and tapping it
 * would leave the app for something already on screen.
 *
 * Anything unrecognised stays untouched HTML, so a note without videos comes
 * back as a single segment and renders exactly as it did before.
 */
export function splitNoteSegments(html: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  let cursor = 0;

  for (const match of mediaMatches(html)) {
    const href = match[1] ?? '';
    const isImage = match[0].startsWith('<img');
    // A video reaches here two ways: as an inline image node (its YouTube
    // thumbnail, which is what the editor now inserts) or as a bare link,
    // which older notes and pasted URLs still use.
    const videoId = isImage ? videoIdFromThumbnail(href) : youTubeVideoId(href);
    // A playlist link may carry no video id at all ("play this whole list"),
    // so it is recognised independently of one.
    const playlistId = isImage ? null : youTubePlaylistId(href);
    // Audio arrives two ways: as an inline waveform image (what the editor now
    // inserts once the recording is uploaded) or as a bare link to an audio
    // file, which is what a note written before the upload existed contains.
    const isAudio = videoId === null && playlistId === null && (isImage ? isWaveformUrl(href) : AUDIO.test(href));
    // An ordinary inline image is not media — leave it in the HTML run.
    if (videoId === null && playlistId === null && !isAudio) continue;

    const index = match.index ?? 0;
    if (index > cursor) segments.push({ kind: 'html', value: html.slice(cursor, index) });

    if (videoId !== null || playlistId !== null) {
      segments.push({
        kind: 'video',
        value: videoId ?? '',
        ...(playlistId === null ? {} : { playlistId }),
      });
    } else if (isImage) {
      // The node carries only the waveform URL, so the audio URL is derived
      // from it by the shared-id convention the upload contract fixes.
      const audioUrl = audioUrlFromWaveform(href);
      if (audioUrl === null) continue;
      segments.push({ kind: 'audio', value: audioUrl });
    } else {
      // The anchor text is the label the editor wrote — "Voice note (0:12)".
      const label = match[0].replace(/<[^>]*>/g, '').trim();
      segments.push({ kind: 'audio', value: href, label: label.length > 0 ? label : undefined });
    }
    cursor = index + match[0].length;
  }

  if (cursor < html.length) segments.push({ kind: 'html', value: html.slice(cursor) });
  return segments.filter((segment) => segment.kind !== 'html' || segment.value.trim().length > 0);
}

/**
 * YouTube's own thumbnail for a video.
 *
 * This is what makes a video a REAL inline node rather than a strip below the
 * field. The native editor is an EditText driven by spans, and an inline image
 * is an ImageSpan holding a Drawable — it can draw a picture into the text
 * flow, but it cannot host a child view, so a live player can never sit inline
 * there. A thumbnail can, and it lands exactly where the caret was.
 *
 * `hqdefault` rather than `maxresdefault`: every video has one. maxres is
 * absent for older and lower-resolution uploads, and a missing thumbnail draws
 * the editor's broken-image glyph.
 */
export function youTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/** The video id from a thumbnail URL, or null if it is an ordinary image. */
export function videoIdFromThumbnail(src: string): string | null {
  const match = /img\.youtube\.com\/vi\/([A-Za-z0-9_-]{11})\//.exec(src);
  return match?.[1] ?? null;
}

/** 16:9 at a size that reads on a phone without dominating the field. */
export const INLINE_VIDEO_WIDTH = 320;
export const INLINE_VIDEO_HEIGHT = 180;

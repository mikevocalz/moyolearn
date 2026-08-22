'use client';
import { useYouTubePlayer, YoutubeView } from 'react-native-youtube-bridge';
import { View } from '@acme/ui/tw';
import type { YouTubePlayerProps } from './YouTubeEmbed.types.ts';
import { youTubeEmbedUrl } from './youtube.ts';

/**
 * A YouTube video or playlist, rendered where the link sits in a note.
 *
 * `react-native-youtube-bridge` drives the IFrame Player API through a WebView,
 * so the player is YouTube's own — which is what its terms require, and what
 * gives captions, quality selection and the watch-later affordances for free.
 *
 * 16:9 because that is what YouTube serves; a fixed height would letterbox on
 * one pane width and crop on another, and this player appears at several widths
 * (a note in a detail pane, a note in a full-screen editor).
 *
 * PLAYLISTS go through the `{ url }` source rather than `{ videoId }`: the
 * bridge's player vars expose no `list` parameter, so the list has to ride in
 * the embed URL. Passing the URL for the single-video case too keeps one code
 * path — and the same `youTubeEmbedUrl` the web fork uses, so the two cannot
 * disagree about what a given link plays.
 */
export function YouTubePlayer({ videoId, playlistId, className }: YouTubePlayerProps) {
  const url = youTubeEmbedUrl({
    videoId: videoId ?? null,
    playlistId: playlistId ?? null,
  });
  const player = useYouTubePlayer({ url });

  if (videoId === undefined && playlistId === undefined) return null;

  return (
    <View
      className={`my-2 overflow-hidden rounded-md border-2 border-border bg-ink-950 ${className ?? ''}`}
      // The border is the app's; the player fills inside it. `aspectRatio`
      // rather than a height so it scales with whatever pane it lands in.
      style={{ aspectRatio: 16 / 9 }}
    >
      <YoutubeView player={player} width="100%" height="100%" />
    </View>
  );
}

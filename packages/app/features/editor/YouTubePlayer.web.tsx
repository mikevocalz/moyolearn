'use client';
import { View } from '@acme/ui/tw';
import type { YouTubePlayerProps } from './YouTubeEmbed.types.ts';
import { youTubeEmbedUrl } from './youtube.ts';

/**
 * Web needs no bridge — the browser embeds YouTube's iframe directly, which is
 * what the native player is a wrapper around anyway.
 *
 * The URL is built by `youTubeEmbedUrl` rather than here, so web and native
 * resolve a playlist the same way instead of drifting apart.
 */
export function YouTubePlayer({ videoId, playlistId, className }: YouTubePlayerProps) {
  if (videoId === undefined && playlistId === undefined) return null;
  const src = youTubeEmbedUrl({
    videoId: videoId ?? null,
    playlistId: playlistId ?? null,
  });

  return (
    <View
      className={`my-2 overflow-hidden rounded-md border-2 border-border bg-ink-950 ${className ?? ''}`}
      style={{ aspectRatio: 16 / 9 }}
    >
      <iframe
        src={src}
        title={playlistId === undefined ? 'YouTube video' : 'YouTube playlist'}
        // nocookie + these permissions are what YouTube's embed docs specify;
        // omitting `allowFullScreen` silently disables the fullscreen control.
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 0 }}
      />
    </View>
  );
}

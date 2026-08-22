'use client';
// One YouTube surface: a single video, a YouTube list, or a curated queue.
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §4.6 (selected-row spec)
// SOT-KEYWORDS: youtube embed video playlist queue thumbnails selectable lesson
import { useState } from 'react';
import { Pressable, Text, View } from '@acme/ui/tw';
import { Image } from '@acme/ui';
import { YouTubePlayer } from './YouTubePlayer';
import type { PlaylistItem, YouTubeEmbedProps } from './YouTubeEmbed.types.ts';
import { youTubeThumbnail } from './youtube.ts';

export type { PlaylistItem, YouTubeEmbedProps } from './YouTubeEmbed.types.ts';

/**
 * A video and a playlist are the same surface at different lengths, so this is
 * one component rather than two: pass `videoId` for a single video, `items` for
 * a sequence, and the queue appears only when there is more than one thing to
 * choose between. Splitting them made callers decide which component to import
 * before they knew how many videos they had.
 *
 * A curated `items` queue is preferred over a YouTube `playlistId` on learner
 * surfaces. A `list=` id hands the sequence to YouTube — the queue is hidden
 * behind the player's own control and YouTube picks what follows — whereas
 * `items` is the app's own list, needs no Data API key (thumbnails come from
 * `youTubeThumbnail`), and keeps the choice of what plays next with the person
 * who built the lesson. `playlistId` stays for ordinary notes.
 */
export function YouTubeEmbed({
  videoId,
  playlistId,
  items,
  initialIndex = 0,
  onSelect,
  className,
}: YouTubeEmbedProps) {
  const queue = items ?? [];
  const clamped = Math.min(Math.max(initialIndex, 0), Math.max(queue.length - 1, 0));
  const [index, setIndex] = useState(clamped);

  // No queue: the player is the whole component, and the caller's own chrome
  // (a note, a sheet) frames it — which is why this returns the bare player.
  if (queue.length === 0) {
    return <YouTubePlayer videoId={videoId} playlistId={playlistId} className={className} />;
  }

  const current = queue[Math.min(index, queue.length - 1)];
  if (current === undefined) return null;

  // A single-item queue is a video, not a playlist. Rendering a one-row list
  // beneath it would be chrome describing something the player already shows.
  if (queue.length === 1) {
    return <YouTubePlayer videoId={current.videoId} className={className} />;
  }

  return (
    <View
      // The house card: 2px ink border, hard offset shadow, never blur. The
      // player sits flush inside it rather than carrying a second border.
      className={`w-full overflow-hidden rounded-card border-2 border-border bg-surface-raised shadow-card ${
        className ?? ''
      }`}
    >
      <YouTubePlayer videoId={current.videoId} className="my-0 rounded-none border-0" />

      <View className="gap-element border-t-2 border-border p-inset-tight">
        <Text className="text-label text-text">
          {queue.length} videos · playing {index + 1}
        </Text>
      </View>

      {/*
        A list, not a horizontal rail: a rail hides its own length, and "how
        much is left" is the thing a learner most wants before starting.
      */}
      {queue.map((item, i) => {
        const isCurrent = i === index;
        return (
          <Pressable
            key={item.videoId}
            onPress={() => {
              setIndex(i);
              onSelect?.(item, i);
            }}
            /*
              Doc 08 §4.6's selected row: highlighter underlay plus a left ink
              edge — the one place a border signals state, because its position
              distinguishes it from the card's own frame. Unselected rows carry
              no fill, so the queue reads as one object, not a stack of cards.
            */
            className={`min-h-target-adult flex-row items-center gap-element border-t border-border/25 p-inset-tight ${
              isCurrent ? 'border-l-4 border-l-border bg-highlighter/25' : ''
            }`}
            // Colour and position are never the only cue (WCAG 1.4.1) — the
            // accessible name carries position and playing state in words.
            accessibilityLabel={`${isCurrent ? 'Now playing, ' : ''}video ${i + 1} of ${
              queue.length
            }: ${item.title}`}
            accessibilityState={{ selected: isCurrent }}
          >
            {/* Empty alt: the row's own name already carries the title. */}
            <Image
              src={youTubeThumbnail(item.videoId)}
              alt=""
              width={88}
              height={50}
              className="shrink-0 rounded-sm border-2 border-border"
            />
            <View className="min-w-0 flex-1 gap-element">
              <Text className="text-label text-text" numberOfLines={2}>
                {item.title}
              </Text>
              <Text className="font-mono text-caption text-text-muted">
                {/* Mono so the index column stays aligned down the list. */}
                {String(i + 1).padStart(2, '0')}
                {item.duration === undefined ? '' : ` · ${item.duration}`}
                {isCurrent ? ' · now playing' : ''}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

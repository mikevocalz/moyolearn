'use client';
import { useColorScheme } from 'react-native';
import { EnrichedText } from 'react-native-enriched-html';
import { View } from '@acme/ui/tw';
import { AudioPlayer } from '@acme/ui';
import { semantic, uiRamp } from '@acme/theme';
import { splitNoteSegments } from './youtube.ts';
import { YouTubeEmbed } from './YouTubeEmbed';

export interface NoteBodyProps {
  /** The note's HTML, as produced by the editor. */
  html: string;
  className?: string;
}

/**
 * A saved note, rendered for reading.
 *
 * The editor stores a YouTube video as an ordinary link, because its schema has
 * no video node. This is where that link becomes a player: the HTML is split
 * around recognised YouTube anchors, the text runs render through
 * `EnrichedText`, and each video renders as an embed in the position its link
 * occupied. The document stays portable — anything that can read HTML still
 * sees a valid link — while a reader sees the video inline.
 *
 * A note with no videos comes back as a single segment and renders exactly as
 * it did before, so this costs nothing for the common case.
 */
export function NoteBody({ html, className }: NoteBodyProps) {
  const segments = splitNoteSegments(html);

  /*
    EnrichedText is a native view taking a resolved style object, so it cannot
    read the CSS variables the rest of the kit uses — the colour has to be
    picked in JS. It previously hardcoded ink[950], which put near-black text on
    the near-black dark surface at about 1.1:1: invisible, and a WCAG 1.4.3
    failure on a learner-facing surface. Semantic tokens, resolved per scheme.
  */
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const ink = semantic.text[scheme];
  const bodySize = parseFloat(uiRamp['body-lg'].cool[0]) * 16; // rem token → dp

  return (
    <View className={`gap-1 ${className ?? ''}`}>
      {segments.map((segment, index) =>
        segment.kind === 'video' ? (
          <YouTubeEmbed key={`video-${segment.value}-${index}`} videoId={segment.value} />
        ) : segment.kind === 'audio' ? (
          <AudioPlayer key={`audio-${index}`} uri={segment.value} label={segment.label} />
        ) : (
          <EnrichedText
            key={`html-${index}`}
            style={{ color: ink, fontSize: bodySize }}
            htmlStyle={{
              blockquote: { borderColor: semantic.border[scheme], borderWidth: 2, gapWidth: 12 },
              code: { color: ink, backgroundColor: semantic['surface-sunken'][scheme] },
            }}
          >
            {segment.value}
          </EnrichedText>
        ),
      )}
    </View>
  );
}

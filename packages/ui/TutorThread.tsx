'use client';
// The tutor conversation, as a list.
//
// Mobbin: https://mobbin.com/screens/63d3bc73-3bc9-4f4d-b8fe-f6732303a9b8 (Claude — sent image sits ABOVE its caption in the same trailing bubble) · https://mobbin.com/screens/95bda61d-00e2-4893-8169-0a6ef484210a (ChatGPT — same, image then question) · https://mobbin.com/screens/4f5f4f46-9b33-46ed-8a54-924c57d3c5de (Clubhouse — a voice note is play + waveform + duration on one row, inside the bubble) · https://mobbin.com/screens/df5e3d89-6c61-446d-a5a3-d0f8d0eba194 (Alan — image bubble in an assistant thread). Structure only.
//
// Every reference agrees on two things and this follows both: an attachment
// belongs INSIDE the bubble that carried it, not floating beside the thread,
// and an image sits above its caption because the picture is the subject and
// the words are about it.
//
// `VirtualList` rather than a mapped column — it is LegendList on native and
// @tanstack/react-virtual on web, and a tutoring session runs long enough that
// a child scrolling back through twenty turns should not be re-rendering all
// twenty. It is also the only list primitive this repo permits.
// SOT: packages/ui/tutor-message.ts
// SOT-KEYWORDS: tutor thread conversation list bubbles image audio virtual legendlist
import { useCallback } from 'react';
import { SolitoImage } from 'solito/image';
import { Pressable, Text, View } from './primitives';
import { VirtualList } from './VirtualList';
import { Lightbox } from './Lightbox';
import { AudioPlayer } from './audio/AudioPlayer';
import { useInstanceStore, useStore } from './use-instance-store';
import type { TutorMessage } from './tutor-message.ts';

export interface TutorThreadProps {
  messages: readonly TutorMessage[];
  className?: string;
}

export function TutorThread({ messages, className }: TutorThreadProps) {
  /*
    Every image in the whole conversation, in order, so the lightbox can page
    across turns — a child comparing problem 1 with problem 3 should not have to
    close and reopen. Scoped per instance, not module-level.
  */
  const images = messages.flatMap((m) => (m.attachments ?? []).filter((a) => a.kind === 'image'));
  const imageUris = images.map((a) => a.previewUri ?? a.uri);
  const indexById = new Map(images.map((a, i) => [a.id, i]));

  const store = useInstanceStore<{ open: boolean; index: number }>(() => ({ open: false, index: 0 }));
  const lightbox = useStore(store, (s) => s);
  const open = useCallback((id: string) => store.setState({ open: true, index: indexById.get(id) ?? 0 }), [store, indexById]);
  const close = useCallback(() => store.setState({ open: false, index: 0 }), [store]);

  return (
    <View className={`flex-1 ${className ?? ''}`}>
      <VirtualList
        data={messages as TutorMessage[]}
        keyExtractor={(message) => message.id}
        estimatedItemSize={96}
        className="flex-1"
        renderItem={({ item }) => (
          // Spacing per row rather than a container gap: VirtualList recycles,
          // so a gap on the container would not survive a recycled row.
          <View className="pb-stack">
            <Bubble message={item} onOpenImage={open} />
          </View>
        )}
      />
      <Lightbox images={imageUris} initialIndex={lightbox.index} open={lightbox.open} onClose={close} />
    </View>
  );
}

function Bubble({
  message,
  onOpenImage,
}: {
  message: TutorMessage;
  onOpenImage: (id: string) => void;
}) {
  const learner = message.role === 'learner';
  const attachments = message.attachments ?? [];

  return (
    <View className={learner ? 'items-end' : 'items-start'}>
      <View
        className={`max-w-content-prose gap-element rounded-card border-2 p-inset-tight ${
          learner ? 'border-primary bg-primary/10' : 'border-border bg-surface-raised'
        }`}
      >
        {/* Picture first: it is the subject, and the words are about it. */}
        {attachments
          .filter((a) => a.kind === 'image')
          .map((image) => (
            <Pressable
              key={image.id}
              onPress={() => onOpenImage(image.id)}
              aria-label={`Open ${image.name}`}
              className="h-48 w-64 overflow-hidden rounded-control border-2 border-border"
            >
              <SolitoImage
                src={image.previewUri ?? image.uri}
                alt={image.name}
                fill
                unoptimized
                contentFit="cover"
                sizes="256px"
              />
            </Pressable>
          ))}

        {/* A voice note is playable IN the thread. Sending speech that can only
            be re-read as a filename is not sending speech. */}
        {attachments
          .filter((a) => a.kind === 'audio')
          .map((audio) => (
            <AudioPlayer key={audio.id} uri={audio.uri} label={audio.name} />
          ))}

        {message.text.length > 0 ? (
          <Text className="font-sans text-body text-text">{message.text}</Text>
        ) : null}

        {/* A caption-less photo still needs a line, or the bubble reads as
            broken rather than as a question asked in pictures. */}
        {message.text.length === 0 && attachments.length > 0 ? (
          <Text className="font-sans text-caption text-text-muted">
            {learner ? 'Sent a picture' : ''}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

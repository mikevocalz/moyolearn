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
import { SolitoImage } from 'solito/image';
import { Pressable, Text, View } from './primitives';
import { VirtualList } from './VirtualList';
import { ImageViewer } from './ImageViewer';
import { AudioPlayer } from './audio/AudioPlayer';
import { useStore } from './use-instance-store';
import type { TutorMessage } from './tutor-message.ts';
import type { TutorAttachment } from './tutor-attachment.ts';

/*
  Read from the record rather than probing the file. A HEAD request per bubble
  would put a network round-trip in a scroll, and a 404 cannot tell "deleted on
  schedule" apart from "upload failed" — which are different things to say to a
  child.
*/
const isExpired = (a: TutorAttachment): boolean =>
  a.expiresAt !== undefined && Date.parse(a.expiresAt) <= Date.now();

export interface TutorThreadProps {
  messages: readonly TutorMessage[];
  /**
   * Older turns exist beyond what `messages` holds.
   *
   * A tutoring session can run for an hour; holding every turn in memory to
   * scroll back through is how a cheap Android tablet runs out of it. The
   * thread asks for more only when a child actually reaches the top.
   */
  hasOlder?: boolean;
  /** Fetch the previous page. The thread shows a spinner-free label while it runs. */
  onLoadOlder?: () => void;
  loadingOlder?: boolean;
  className?: string;
}

export function TutorThread({
  messages,
  hasOlder,
  onLoadOlder,
  loadingOlder,
  className,
}: TutorThreadProps) {
  /*
    Every image in the whole conversation, in order, so the lightbox can page
    across turns — a child comparing problem 1 with problem 3 should not have to
    close and reopen. Scoped per instance, not module-level.
  */
  const images = messages.flatMap((m) => (m.attachments ?? []).filter((a) => a.kind === 'image'));
  const imageUris = images.map((a) => a.previewUri ?? a.uri);
  const indexById = new Map(images.map((a, i) => [a.id, i]));

  return (
    <View className={`flex-1 ${className ?? ''}`}>
      {/*
        Pagination at the TOP, where older turns are, and as an explicit control
        rather than an invisible scroll trigger.

        A child scrolling back to re-read a hint does not want the list to
        silently grow and shift under their thumb; a labelled row tells them
        there is more and lets them decide. It also degrades honestly on a slow
        connection — "Loading" is a state a person can understand, where a
        stalled auto-load just looks broken.
      */}
      {hasOlder ? (
        <Pressable
          onPress={onLoadOlder}
          disabled={loadingOlder}
          aria-label="Show earlier messages"
          className="min-h-target-adult items-center justify-center border-b-2 border-border"
        >
          <Text className="font-sans text-caption text-text-muted">
            {loadingOlder ? 'Loading earlier messages' : 'Earlier in this session'}
          </Text>
        </Pressable>
      ) : null}

      <VirtualList
        data={messages as TutorMessage[]}
        keyExtractor={(message) => message.id}
        estimatedItemSize={96}
        className="flex-1"
        renderItem={({ item }) => (
          // Spacing per row rather than a container gap: VirtualList recycles,
          // so a gap on the container would not survive a recycled row.
          <View className="pb-stack">
            <Bubble message={item} urls={imageUris} indexById={indexById} />
          </View>
        )}
      />
    </View>
  );
}

function Bubble({
  message,
  urls,
  indexById,
}: {
  message: TutorMessage;
  /** Every image in the conversation, so the viewer pages across turns. */
  urls: readonly string[];
  indexById: Map<string, number>;
}) {
  const learner = message.role === 'learner';
  const attachments = message.attachments ?? [];

  return (
    <View className={learner ? 'items-end' : 'items-start'}>
      <View
        /*
          `rounded-control`, not `rounded-card`.

          A bubble at 10px sitting directly above a Send button at 6px reads as
          two components from two systems in one column — which is the exact
          failure `radius`'s own comment describes for the composer row. In a
          session the thread and the composer ARE one system: the bubbles, the
          field, the attach and send keys and the thumbnails inside the bubbles
          all take the control radius, so the eye reads one surface rather than
          a card stack with a toolbar under it.

          `rounded-card` stays right for a Card — a discrete object on a page.
          A bubble is not that; it is a shape in a conversation.
        */
        className={`max-w-content-prose gap-element rounded-control border-2 p-inset-tight ${
          learner ? 'border-primary bg-primary/10' : 'border-border bg-surface-raised'
        }`}
      >
        {/* Picture first: it is the subject, and the words are about it. */}
        {attachments
          .filter((a) => a.kind === 'image')
          .map((image) =>
            isExpired(image) ? (
              /*
                Expired media is stated, not silently absent and not a broken
                image. A child scrolling back through last week should learn
                that the picture was removed on purpose — that is the product
                keeping a promise, and it reads as one only if it is said.
              */
              <View
                key={image.id}
                className="h-48 w-64 items-center justify-center rounded-control border-2 border-dashed border-border bg-surface"
              >
                <Text className="max-w-40 text-center font-sans text-caption text-text-muted">
                  Picture removed after a week
                </Text>
              </View>
            ) : (
            <ImageViewer key={image.id} urls={urls} index={indexById.get(image.id) ?? 0}>
              {/* Galeria animates THIS element into the full-screen view, so the
                  thumbnail is the shared element — it must be the single child. */}
              <View className="h-48 w-64 overflow-hidden rounded-control border-2 border-border">
                <SolitoImage
                  src={image.previewUri ?? image.uri}
                  alt={image.name}
                  fill
                  unoptimized
                  contentFit="cover"
                  sizes="256px"
                />
              </View>
            </ImageViewer>
            ),
          )}

        {/* A voice note is playable IN the thread. Sending speech that can only
            be re-read as a filename is not sending speech. */}
        {attachments
          .filter((a) => a.kind === 'audio')
          .map((audio) =>
            isExpired(audio) ? (
              <Text key={audio.id} className="font-sans text-caption text-text-muted">
                Voice note removed after a week
              </Text>
            ) : (
              <AudioPlayer key={audio.id} uri={audio.uri} label={audio.name} />
            ),
          )}

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

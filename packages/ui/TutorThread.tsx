'use client';
// The tutor conversation, as a list.
//
// Mobbin: https://mobbin.com/screens/63d3bc73-3bc9-4f4d-b8fe-f6732303a9b8 (Claude — sent image sits ABOVE its caption in the same trailing bubble) · https://mobbin.com/screens/95bda61d-00e2-4893-8169-0a6ef484210a (ChatGPT — same, image then question) · https://mobbin.com/screens/4716caa7-1ec5-4bdf-89b1-aab1cff36993 (WhatsApp — voice note is play + waveform + duration on ONE row, with the transcript line UNDERNEATH inside the same bubble) · https://mobbin.com/screens/4f5f4f46-9b33-46ed-8a54-924c57d3c5de (Clubhouse — same row, duration trailing) · https://mobbin.com/screens/df5e3d89-6c61-446d-a5a3-d0f8d0eba194 (Alan — "See transcript" under a sent voice note). Structure only.
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

/**
 * One row of the thread: a stored turn, or the turn currently arriving.
 *
 * A union rather than a `TutorMessage` with an `isLive` flag — the live turn
 * has no id, no role and no attachments, and doc 10 §2's rule is that an
 * impossible combination should not be representable.
 */
type ThreadRow =
  | { kind: 'message'; message: TutorMessage }
  | { kind: 'live'; node: React.ReactNode };

/** Stable key for the single live row. It is never more than one. */
const LIVE_ROW_KEY = 'live-turn';

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
  /**
   * The turn currently arriving — the newest row of this list, not a band
   * beneath it.
   *
   * It used to render outside the scroll view, between the thread and the
   * composer, which cost the conversation a permanent strip of height and made
   * the one thing a child most wants to re-read the one thing they could not
   * scroll to. A live turn is a message that happens to be animating; history
   * and live turn get one place and one treatment.
   *
   * It is a real ROW, not `ListFooterComponent`. The footer was the obvious
   * shape and it was measured wrong on device: LegendList clamped the list's
   * scrollable range to the rows it knew about, so with a tall live turn in the
   * footer the conversation could not be scrolled back at all — the history was
   * on screen and unreachable. A row the list owns is a row the list can size.
   *
   * It does not become a `TutorMessage` to get there: the live turn is a state
   * of the session (a hint with its ladder, a diagnosis with its badge, an
   * ending with its summary), so the list's data is a small union and the live
   * row carries no invented id.
   */
  live?: React.ReactNode;
  className?: string;
}

export function TutorThread({
  messages,
  hasOlder,
  onLoadOlder,
  loadingOlder,
  live,
  className,
}: TutorThreadProps) {
  /*
    Every image in the whole conversation, in order, so the lightbox can page
    across turns — a child comparing problem 1 with problem 3 should not have to
    close and reopen. Scoped per instance, not module-level.
  */
  const rows: ThreadRow[] = [
    ...messages.map((message) => ({ kind: 'message' as const, message })),
    ...(live === undefined ? [] : [{ kind: 'live' as const, node: live }]),
  ];

  const images = messages.flatMap((m) => (m.attachments ?? []).filter((a) => a.kind === 'image'));
  const imageUris = images.map((a) => a.previewUri ?? a.uri);
  const indexById = new Map(images.map((a, i) => [a.id, i]));

  return (
    /*
      `overflow-hidden`, and it is load-bearing in two ways — both measured on
      device (Surface Duo, 1080dp), neither obvious from the web build.

      An Android `View` does not clip, so without it the virtualised list paints
      past the box flex gave it: before the live turn moved into the list, that
      spill drew straight over the turn below, two messages on the same pixels.
      Removing the clip to see whether that was still true also removed the
      thread's scroll entirely — the conversation rendered at full content
      height with no viewport to move within, so history was on screen and
      unreachable. Clipping is what gives this list a viewport on this screen.
    */
    <View className={`flex-1 overflow-hidden ${className ?? ''}`}>
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
        data={rows}
        keyExtractor={(row) => (row.kind === 'live' ? LIVE_ROW_KEY : row.message.id)}
        estimatedItemSize={96}
        /*
          A CONVERSATION OPENS AT ITS NEWEST MESSAGE. This read top-down like a
          document, so resuming a session showed the FIRST thing Natalie ever
          said and the learner had to scroll to find where they were. It also
          keeps a streaming turn in view as it is written.
        */
        atBottom
        /* Room under the last bubble so it does not sit on the composer. */
        bottomInset={30}
        className="flex-1"
        /*
          No scrollbar. A chat's own bubbles already say how far through it you
          are, and on a learner surface a rail that appears and fades on every
          arriving token is motion nobody asked for (doc 02 A.5 bans ambient
          motion on a child's screen).
        */
        showsVerticalScrollIndicator={false}
        /*
          NO auto-follow, and it is a decision rather than an omission. Pinning
          the list to its tail was tried and taken back out: `rows` is rebuilt
          on every render (the live row carries a fresh element by definition),
          so LegendList saw a data change on every frame of a streaming turn and
          scrolled to the bottom on each one — the conversation could not be
          scrolled back at all while she was speaking, which is exactly when a
          child wants to re-read it. Being able to scroll wins over landing at
          the end; the list keeps its own position, and the newest turn is where
          the reader already is.
        */
        renderItem={({ item }) => (
          // Spacing per row rather than a container gap: VirtualList recycles,
          // so a gap on the container would not survive a recycled row.
          <View className="pb-stack">
            {item.kind === 'live' ? (
              item.node
            ) : (
              <Bubble message={item.message} urls={imageUris} indexById={indexById} />
            )}
          </View>
        )}
      />
    </View>
  );
}

/** What to call a turn that carried attachments and no words. */
function CaptionlessLabel({ attachments }: { attachments: readonly TutorAttachment[] }) {
  const kinds = new Set(attachments.map((a) => a.kind));
  const audioHasTranscript = attachments.some(
    (a) => a.kind === 'audio' && (a.transcript?.length ?? 0) > 0,
  );
  if (kinds.size === 1 && kinds.has('audio') && audioHasTranscript) return null;

  const label =
    kinds.size > 1
      ? 'Sent some work'
      : kinds.has('audio')
        ? 'Sent a voice note'
        : kinds.has('document')
          ? 'Sent a file'
          : attachments.length > 1
            ? `Sent ${attachments.length} pictures`
            : 'Sent a picture';

  return <Text className="font-sans text-caption text-text-muted">{label}</Text>;
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
                {/*
                  `contain`, not `cover`. A homework photo is wide and the
                  problem is spread across it, so cropping to the centre showed
                  a child "= ?" and nothing else — the one part that tells them
                  nothing about which problem this was. Letterboxing is the
                  right trade when the whole frame is the content.
                */}
                <SolitoImage
                  src={image.previewUri ?? image.uri}
                  alt={image.name}
                  fill
                  unoptimized
                  contentFit="contain"
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
              // A voice note is a row, and a row needs width — squeezed into a
              // bubble sized to its own content it collapsed to a pill.
              <View key={audio.id} className="w-64 gap-element">
                {/* The player is one row — play, waveform, duration — exactly as
                    WhatsApp and Clubhouse lay it out. A voice note is a single
                    object, not a stack of controls. */}
                <AudioPlayer uri={audio.uri} label={audio.name} />

                {/*
                  The transcript sits UNDERNEATH, in the same bubble.

                  WhatsApp puts it there and doc 07 §3 requires it: an adult must
                  be able to review what a child said to the model, and sound
                  alone cannot be skimmed. It is also the accessible copy — a
                  deaf child, or one in a noisy room, reads the note instead of
                  playing it.

                  When it has not arrived yet the row says so rather than
                  vanishing, because a transcript that appears silently later
                  looks like something the app hid.
                */}
                {audio.transcript !== undefined && audio.transcript.length > 0 ? (
                  /*
                    Capped at four lines. A transcript is a reference for what
                    was said, not the message itself — the audio is. Left
                    unbounded, a long note pushes the rest of the conversation
                    off the screen, and a model that mishears silence can emit a
                    wall of repeated punctuation that buries the thread
                    entirely. Four lines is enough to recognise the note by.
                  */
                  <Text numberOfLines={4} className="font-sans text-caption text-text-muted">
                    {audio.transcript}
                  </Text>
                ) : (
                  <Text className="font-sans text-caption text-text-muted">
                    Writing this out…
                  </Text>
                )}
              </View>
            ),
          )}

        {message.text.length > 0 ? (
          <Text className="font-sans text-body text-text">{message.text}</Text>
        ) : null}

        {/*
          A caption-less attachment still needs a line, or the bubble reads as
          broken rather than as a question asked without words — but the line
          has to match what was actually sent. It said "Sent a picture" under a
          voice note, because the copy was written when images were the only
          kind and never revisited when audio arrived.

          A voice note that already shows its transcript needs no label at all:
          the transcript IS what was said, and "Sent a voice note" above it
          would be the app narrating something the reader can see.
        */}
        {message.text.length === 0 && attachments.length > 0 && learner ? (
          <CaptionlessLabel attachments={attachments} />
        ) : null}
      </View>
    </View>
  );
}

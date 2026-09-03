'use client';
// Composer — the learner message input for the S9 tutor session.
//
// Mobbin: https://mobbin.com/screens/8cebeed2-fe06-43a2-b4c4-66b6d13a71fd (ChatGPT — ONE row: attach leading, field taking the middle, mic then send trailing) · https://mobbin.com/screens/793f47cc-ae07-4cfa-b36a-831db8d6d397 (Google Gemini — the same row with the field grown to two lines; the keys stay bottom-aligned rather than re-centring) · https://mobbin.com/screens/7708c12a-439a-4d1a-a2a7-488b8c2ecdb8 (Notion — the reduced case, field plus one trailing key) · https://mobbin.com/screens/9c13ada9-0c95-45c8-9932-d20010b96e14 (ChatGPT — field and trailing action share one row height) · https://mobbin.com/screens/5def00a9-6228-4ccc-81a3-25cdb2fe20bd (Pi — full-width field, single trailing send) · https://mobbin.com/screens/236da9c6-8b17-4989-ad40-7e0da07ef603 (Noom — Camera / Photo library / Files, one flat list, no submenus) · https://mobbin.com/screens/db352f6d-4d7d-41f1-a678-e66ee043da83 (BFF — the same list including "Record audio message") · https://mobbin.com/screens/1d54bc84-03b2-4f46-8bca-3c6574ac07e1 (Instagram — recording REPLACES the field: live waveform, discard left, send right) · https://mobbin.com/screens/66e343b2-3334-4d2b-9494-bc22ce3cf386 (Beside — same shape, timer beside the waveform) · https://mobbin.com/screens/c827a5e4-3507-4bf7-a570-63bf1224752d (Alan — a sent voice note carries "See transcript"). Structure only.
//
// A child stuck on homework points a camera at it rather than describing it, so
// the composer takes pictures, documents and speech, not only typing.
//
// Three structural decisions, all taken from the references rather than
// invented:
//
//  - ONE flat attachment list, and it is FLAT IN THE BAR. Every app above
//    offers Camera / Photos / Files at the top level. A child hunting through a
//    submenu for "the photo one" has already lost the thread of the problem
//    they were stuck on. This file argued that and then did the opposite: one
//    key whose handler was `onPickCamera ?? onPickImage ?? onPickDocument`, so
//    on a host supplying all three — which the tutor screen does — camera
//    always won and the photo library and the file picker were unreachable.
//    Three capabilities, one button, two of them dead. Pictures and files are
//    now separate keys, and a key exists only where its handler does.
//  - TWO keys, not three: taking a NEW photo belongs to the Snap tab, which is
//    the shell's raised centre action, so the composer offers the library and
//    the file picker and does not repeat the camera beside them.
//  - ONE row, and it is the screen's footer: attach at the leading edge, the
//    field taking whatever width is left, mic and send at the trailing edge.
//    Splitting the actions onto a second row under the field cost the composer
//    a whole row of height it did not earn — a bar standing two rows tall over
//    an empty one-line field, permanently, on the screen where the conversation
//    is the subject.
//  - Recording REPLACES the field rather than sitting beside it. While speaking
//    there is nothing to type, and a live waveform where the text was is what
//    tells a child the microphone is actually hearing them.
//  - Discard is on the far side from send. They are opposite intentions and a
//    mis-tap costs the whole message, so they do not sit next to each other.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5 · doc 15 §1
// SOT-KEYWORDS: composer chat input tutor send message learner

import { useCallback, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { targets } from '@acme/theme';
import { Menu } from './Menu';
import { View, Text, Pressable, Textarea } from './primitives';
import { useAutoGrow } from './use-autogrow';
import { SolitoImage } from 'solito/image';
import { Camera, FileUp, Image, Mic, Paperclip, Plus, Send, Square, Trash2, X } from './icons';
// Through the barrel, not the file. `waveform.ts` (the pure bar maths) and
// `Waveform.tsx` (the component) differ only in case, so a direct path import
// resolves ambiguously on a case-insensitive filesystem and TS refuses it.
import { AudioPlayer, Waveform } from './audio';
import { KeyboardSticky } from './keyboard-aware';
import { Lightbox } from './Lightbox';
import { SlideIn } from './motion';
import { useInstanceStore, useStore } from './use-instance-store';
import { countImages, MAX_TUTOR_IMAGES, type TutorAttachment } from './tutor-attachment.ts';

export interface ComposerProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Touch target comes from the age band, never a hardcoded size (CLAUDE.md §UI). */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Attachments staged for the next turn. Rendered above the field so a child
   * can see what they are about to send — and remove it — before it goes.
   */
  attachments?: readonly TutorAttachment[];
  onRemoveAttachment?: (id: string) => void;
  /**
   * Offered only when the host supplies a handler. Missing handler, missing
   * button: the same rule the capability registry uses, so a control never
   * appears where the platform cannot honour it.
   */
  onPickCamera?: () => void;
  onPickImage?: () => void;
  onPickDocument?: () => void;
  /** Starts a voice turn. Absent on web until MediaRecorder is wired. */
  onStartRecording?: () => void;
  /** Live recording state, owned by the host. */
  recording?: { elapsedSec: number; levels: readonly number[] };
  onCancelRecording?: () => void;
  /**
   * Ends the take and STAGES it, so the child can hear it back before it goes.
   * Without this the only ways out of a recording were send and discard, which
   * meant a voice note could never be checked — only gambled on.
   */
  onStopRecording?: () => void;
  /** Ends the take and sends it in one press. */
  onSendRecording?: () => void;
  className?: string;
}

export function Composer({
  value,
  onChangeText,
  onSend,
  placeholder = 'Type your answer',
  disabled,
  size = 'md',
  attachments,
  onRemoveAttachment,
  onPickCamera,
  onPickImage,
  onPickDocument,
  onStartRecording,
  recording,
  onCancelRecording,
  onStopRecording,
  onSendRecording,
  className,
}: ComposerProps) {
  /*
    An attachment is a message. A photo of a maths problem with no words is the
    commonest thing a stuck child sends, and requiring them to type something
    alongside it would be a toll booth on the exact moment they are struggling.
  */
  const canSend = !disabled && (value.trim().length > 0 || (attachments?.length ?? 0) > 0);
  /*
    At the cap the attach control goes away rather than greying out. A disabled
    button a child keeps tapping teaches nothing; the count beside the tray says
    what happened, once, in words.
  */
  const imageCount = countImages(attachments ?? []);
  const atImageCap = imageCount >= MAX_TUTOR_IMAGES;
  /*
    The cap counts PICTURES, so it retires the picture key and leaves the file
    key standing. Folding documents into the same test meant a child who had
    attached three photos could no longer attach the worksheet PDF either — a
    limit on one kind of thing quietly enforced against another.
  */
  /*
    ONE way to a picture, not two.

    Camera and library were briefly two keys side by side, and to a child they
    are one thought — "put my homework in here" — wearing two icons. The shell
    already owns taking a NEW photo: Snap is the raised centre tab and the
    product's signature action, so a second camera button inside the composer
    duplicates the one control the whole app is built around. The composer's
    picture key therefore reaches for the LIBRARY, and falls back to the camera
    only on a host that has no library picker to offer.
  */
  /*
    THE CAMERA WAS UNREACHABLE. This was `onPickImage ?? onPickCamera`, and the
    tutor screen passes BOTH — so the library always won, `onPickCamera` was
    dead behind a `??`, and a child could only ever attach homework they had
    already photographed in another app. Taking the picture is the primary
    action for this feature; the library is the fallback for one taken earlier.
  */
  const showCamera = onPickCamera !== undefined;
  const pickPicture = onPickImage ?? onPickCamera;
  const showPicture = !disabled && !atImageCap && pickPicture !== undefined;
  const showDocument = !disabled && onPickDocument !== undefined;
  const canAttach = showPicture || showDocument;

  /*
    THE ROW MEASURES ITSELF, NOT THE WINDOW.

    `useSizeClass` and `useWindowSizeClass` both answer questions about the
    WINDOW, and the window is the wrong ruler for this control: the same screen
    at the same width hosts this composer full-width on a phone and inside a
    380dp conversation pane in the three-pane session. Asked about the window,
    the row draws its phone form in a third of the space — four 44dp keys and a
    64dp field, measured on the Duo, which is a field that fits three
    characters.

    `onLayout` rather than a new hook: nothing in the kit measures a container
    (every size helper here reads `useWindowDimensions`), and one screen's
    footer does not justify a second measurement mechanism. `null` until the
    first layout, and the fully-expanded row is what renders in the meantime —
    the wide form is the safe first paint, because it is the one that never
    hides a capability.
  */
  const [rowWidth, setRowWidth] = useState<number | null>(null);
  const measureRow = useCallback((event: LayoutChangeEvent) => {
    setRowWidth(event.nativeEvent.layout.width);
  }, []);

  /*
    Below this the two attach keys become one.

    The number is the field width, worked backwards. Four keys at the adult
    band's 44dp target, three gaps, the field's own gaps, the border and the
    row's padding come to ~228dp of chrome. A child's answer is set at
    `text-body-lg` (18px), where a readable line is around 18 characters ≈
    160dp — below that the field wraps one word per line, which is the failure
    the `65ch` bug already taught us to measure rather than eyeball. 160 + 228
    rounds to 400. Collapsing one key returns ~52dp, so the narrow row holds its
    160dp field down to ~348 — the conversation pane's usable width.

    NOTHING IS LOST at the narrow width and no target shrinks. The band token
    still sets the size (a K-2 child gets 72dp, not 44), and both ways in are
    still one press away, in a FLAT list — the Noom/BFF rule this file already
    argues for. What changes is that the list is behind a `+` instead of spread
    across the bar.
  */
  const COMPACT_ROW_DP = 400;
  const compactAttach =
    rowWidth !== null && rowWidth < COMPACT_ROW_DP && showPicture && showDocument;

  /*
    Camera FIRST, then library, then files — Noom's and BFF's order in the
    Mobbin refs above, and the order of likelihood here: the homework is on the
    table in front of the child, not in their camera roll.
  */
  const attachActions = [
    ...(showCamera ? [{ id: 'camera', title: 'Take a photo' }] : []),
    ...(onPickImage ? [{ id: 'picture', title: 'Photo library' }] : []),
    { id: 'document', title: 'File' },
  ];

  const onAttachAction = useCallback(
    (id: string) => {
      if (id === 'camera') onPickCamera?.();
      else if (id === 'picture') onPickImage?.();
      else onPickDocument?.();
    },
    [onPickCamera, onPickImage, onPickDocument],
  );

  /*
    Icon buttons carry the age band's touch target, same as every other control.

    This is written as a map because I first wrote `w-target-md` — a token that
    does not exist. `targets` is keyed by BAND (floor/adult/teen/child/young),
    not by the size scale, so Tailwind generated nothing and the attach button
    rendered 24px wide: its icon, with no box. 24px is also under the WCAG 2.2
    floor of 44, on a product used by children.

    `buttonSizeForBand` maps young and child to `xl`, teen to `lg`, adult to
    `md`, so this map is that mapping read backwards.
  */
  /*
    Lightbox state, scoped to this composer instance rather than a module store —
    two composers on one screen must not share which picture is open.
  */
  const lightboxStore = useInstanceStore<{ open: boolean; index: number }>(() => ({
    open: false,
    index: 0,
  }));
  const lightbox = useStore(lightboxStore, (l) => l);
  const openLightbox = useCallback(
    (index: number) => lightboxStore.setState({ open: true, index }),
    [lightboxStore],
  );
  const closeLightbox = useCallback(
    () => lightboxStore.setState({ open: false, index: 0 }),
    [lightboxStore],
  );
  /*
    The lightbox takes an index into the IMAGES, while the tray iterates all
    attachments. A document staged before a photo would otherwise make the two
    disagree and open the wrong picture, so the map is built once and looked up
    by id rather than recomputed from a position.
  */
  const images = (attachments ?? []).filter((a) => a.kind === 'image');
  const imageUris = images.map((a) => a.previewUri ?? a.uri);
  const imageIndexById = new Map(images.map((a, i) => [a.id, i]));

  const iconTarget = {
    sm: 'min-h-target-adult min-w-target-adult',
    md: 'min-h-target-adult min-w-target-adult',
    lg: 'min-h-target-teen min-w-target-teen',
    xl: 'min-h-target-child min-w-target-child',
  }[size];

  /*
    The row's resting height, as a NUMBER — the same age-band target the keys
    beside the field take, so an empty composer is one level row.

    A number rather than a class because it has to reach the native field's
    HOST, which a className never does; that distinction is the difference
    between a composer that can be typed into on Android and one that cannot
    (see `use-autogrow.native`). `targets` is keyed by band, not by the size
    scale, so this map is `buttonSizeForBand` read backwards.
  */
  const rowHeight = Number.parseInt(
    { sm: targets.adult, md: targets.adult, lg: targets.teen, xl: targets.child }[size],
    10,
  );

  /*
    Grows with what is typed, and only then — one line at rest, up to a cap,
    scrolling inside itself after that. The two platforms measure differently
    (`scrollHeight` on web, the Compose/SwiftUI host's own measurement on
    native), so the hook returns props to spread rather than a single ref.
  */
  const autoGrow = useAutoGrow(value, rowHeight);

  const handleSubmit = useCallback(() => {
    if (canSend) onSend();
  }, [canSend, onSend]);

  /*
    Recording replaces the row entirely — see the header. While a child is
    speaking there is nothing to type, and the waveform standing where the field
    was is what proves the microphone is hearing them.
  */
  if (recording) {
    return (
      /*
        TWO rows, the same shape the composer takes when idle — waveform where
        the field sits, actions on their own row beneath.

        It was one row: discard, waveform, send, all competing for width. The
        waveform is the thing a child is watching while they speak, and squeezing
        it between two keys left it a sliver. WhatsApp puts the recording on its
        own line and the three decisions under it, which also means the bar does
        not change shape between typing and speaking — only its contents do.
      */
      <View
        key="recording"
        className={`gap-element rounded-control border-2 border-strong bg-surface-raised px-inset-tight py-inset-field ${className ?? ''}`}
      >
        <View className="flex-row items-center gap-element">
          {/* Elapsed leads, as it does in the reference: it is the number that
              answers "how long have I been talking". */}
          <Text className="font-mono text-data text-text">
            {Math.floor(recording.elapsedSec / 60)}:
            {String(Math.floor(recording.elapsedSec % 60)).padStart(2, '0')}
          </Text>

          {/* The kit's own Waveform — square-ended flat bars, already in
              Storybook. It slices and pads `levels` to its own bar count, so the
              recorder hands over everything captured. */}
          <Waveform levels={recording.levels} height={24} className="flex-1" />
        </View>

        <View className="flex-row items-center justify-between">
          {/* Discard far left, send far right — opposite intentions, opposite
              ends, so a mis-tap cannot cost the take. */}
          <SlideIn from="left" distance={40} duration={160} delay={100}>
            <Pressable
              onPress={onCancelRecording}
              aria-label="Discard recording"
              className={`${iconTarget} items-center justify-center rounded-control`}
            >
              <Trash2 size={20} className="text-danger" />
            </Pressable>
          </SlideIn>

          {/*
            STOP, centred, exactly where the reference puts it.

            This was a passive "Listening" dot, on the reasoning that a take ends
            by sending or discarding and a third control is a third thing to
            explain. That was wrong, and wrong in the direction that costs a
            child the most: with no stop, a voice note could never be HEARD back
            before it went. Send was a gamble and discard was the only way to
            change your mind. Stopping is not a third way to finish — it is the
            only way to check.

            The live signal the dot was carrying has not gone anywhere: the
            waveform above is moving and the elapsed count is running, which is
            evidence the microphone is working rather than a label claiming it.
          */}
          {onStopRecording ? (
            <Pressable
              onPress={onStopRecording}
              aria-label="Stop recording"
              className={`${iconTarget} items-center justify-center rounded-control border-2 border-danger`}
            >
              {/* Filled, not the bare outline. An outline square inside an
                  outlined button is a box drawn inside a box; a SOLID square is
                  the universal stop glyph and reads as one at a glance. */}
              <Square size={16} className="text-danger" fill="currentColor" />
            </Pressable>
          ) : (
            <View className="flex-row items-center gap-element">
              <View className="h-2 w-2 rounded-full bg-danger" />
              <Text className="font-sans text-caption text-text-muted">Listening</Text>
            </View>
          )}

          <SlideIn from="right" distance={20} duration={200}>
            <Pressable
              onPress={onSendRecording}
              aria-label="Send voice message"
              className={`${iconTarget} items-center justify-center rounded-control bg-primary`}
            >
              <Send size={20} className="text-on-primary" />
            </Pressable>
          </SlideIn>
        </View>
      </View>
    );
  }

  return (
    /*
      The bar rides the keyboard, and it does so from HERE rather than from the
      screen around it.

      The activity asks for `adjustResize`, but under edge-to-edge Android stops
      resizing the window and hands the app an IME inset to consume instead — so
      the keyboard opened straight over the composer and a child could not see
      the answer they were typing. Keeping that fix inside the component means it
      holds wherever the composer is placed, including in Storybook, instead of
      being a rule every host has to remember. `KeyboardSticky` is the kit's
      wrapper over `react-native-keyboard-controller`; on web it is a fragment.
    */
    <KeyboardSticky>
      <View key="idle" className={`gap-stack ${className ?? ''}`}>
        {/* Staged attachments, above the field.
            An image shows the IMAGE. A filename is not a photo — a child who
            attached the wrong page of homework cannot tell from "photo.jpg", and
            checking costs them the send. Every reference does the same thing:
            a square thumbnail with a small dismiss badge on its corner, and the
            badge sits ON the picture rather than beside it so the tray stays one
            row of pictures instead of a list of rows. */}
        {attachments && attachments.length > 0 ? (
          <View className="flex-row flex-wrap gap-element">
            {attachments.map((attachment) =>
              attachment.kind === 'image' ? (
                <View key={attachment.id} className="relative">
                  <Pressable
                    onPress={() => openLightbox(imageIndexById.get(attachment.id) ?? 0)}
                    aria-label={`Open ${attachment.name}`}
                    className="h-16 w-16 overflow-hidden rounded-control border-2 border-border bg-surface-raised"
                  >
                    <SolitoImage
                      src={attachment.previewUri ?? attachment.uri}
                      alt={attachment.name}
                      fill
                      unoptimized
                      contentFit="contain"
                      sizes="64px"
                    />
                  </Pressable>
                  {/* Offset onto the corner. Its hit area is the WCAG floor even
                      though the badge is drawn small — a 16px target on a
                      children's surface is a target only an adult can hit. */}
                  <Pressable
                    onPress={() => onRemoveAttachment?.(attachment.id)}
                    aria-label={`Remove ${attachment.name}`}
                    className="absolute -right-2 -top-2 min-h-target-adult min-w-target-adult items-center justify-center"
                  >
                    {/* Square too. Every reference draws this badge as a circle;
                        this kit has one radius and a dismiss badge is still a
                        button. Consistency inside the product beats matching a
                        screenshot from another one. */}
                    <View className="h-6 w-6 items-center justify-center rounded-control border-2 border-border bg-surface">
                      <X size={12} className="text-text" />
                    </View>
                  </Pressable>
                </View>
              ) : (
                /* A document has no picture, so it keeps a labelled chip — the
                   name IS the only identifying thing about it.

                   A voice note is NOT in that category and used to be treated as
                   if it were: a mic glyph and "Voice note (2s)". A filename is not
                   a recording. The child had just spoken into the microphone and
                   the only thing offered back was a word for what they had done,
                   so stopping a take bought them nothing they could act on. It
                   gets the kit's player, the same one the thread uses. */
                attachment.kind === 'audio' ? (
                  <View
                    key={attachment.id}
                    className="flex-row items-center gap-element rounded-control border-2 border-border bg-surface-raised p-inset-tight"
                  >
                    <AudioPlayer
                      uri={attachment.uri}
                      duration={attachment.durationSec}
                      className="w-56"
                    />
                    <Pressable
                      onPress={() => onRemoveAttachment?.(attachment.id)}
                      aria-label={`Remove ${attachment.name}`}
                      className="min-h-target-adult min-w-target-adult items-center justify-center rounded-control"
                    >
                      <X size={14} className="text-text-muted" />
                    </Pressable>
                  </View>
                ) : (
                <View
                  key={attachment.id}
                  className="flex-row items-center gap-element rounded-control border-2 border-border bg-surface-raised py-1 pl-inset-tight pr-1"
                >
                  {attachment.kind === 'document' ? <FileUp size={16} className="text-text-muted" /> : null}
                  <Text numberOfLines={1} className="max-w-40 font-sans text-caption text-text">
                    {attachment.name}
                  </Text>
                  <Pressable
                    onPress={() => onRemoveAttachment?.(attachment.id)}
                    aria-label={`Remove ${attachment.name}`}
                    className="min-h-target-adult min-w-target-adult items-center justify-center rounded-control"
                  >
                    <X size={14} className="text-text-muted" />
                  </Pressable>
                </View>
                )
              ),
            )}
          </View>
        ) : null}

        {atImageCap ? (
          <Text className="font-sans text-caption text-text-muted">
            That&apos;s {MAX_TUTOR_IMAGES} pictures — enough to work with. Remove one to swap it.
          </Text>
        ) : null}

        {/* Tap a thumbnail to check it full-size before sending. The kit already
            had this component and nothing used it. */}
        <Lightbox
          images={imageUris}
          initialIndex={lightbox.index}
          open={lightbox.open}
          onClose={closeLightbox}
        />

        {/*
          ONE surface, ONE row: attach · field · mic · send.

          It was a single container with the text on its own full-width line and
          the actions on a row beneath it, inside. That is a real pattern — but it
          spends a whole row of chrome to buy the field a width it does not need,
          and the composer is a FOOTER: the conversation is the subject of this
          screen and every pixel the bar keeps is a pixel of the question a child
          is answering. Two rows over a one-line field read as a panel that had
          been left open.

          ChatGPT's own bar is the reference for the row (see the header), and
          Gemini's for what happens when it grows: `items-end`, so the keys stay
          on the bottom line as the field gets taller instead of drifting to the
          middle of a growing box. Only the field grows; the keys are fixed
          anchors at either end.
        */}
        <View
          onLayout={measureRow}
          className={`flex-row items-end gap-element rounded-control border-2 border-strong bg-surface-raised px-inset-tight py-inset-field ${
            disabled ? 'opacity-60' : ''
          }`}
        >
          {/* Attach leads, as it does in every reference — one key per way in,
              each present only where its handler is. Hidden rather than disabled:
              a greyed key a child keeps pressing teaches nothing. */}
          {compactAttach ? (
            /*
              ONE KEY, ONE FLAT LIST — not a submenu. `Menu` draws both ways in
              at the same level with no nesting, which is the Noom/BFF rule this
              file's header already commits to; the `+` is only where the list
              hangs from when the bar has no room to spread it out.
            */
            <Menu actions={attachActions} onAction={onAttachAction} title="Add to your answer">
              <View
                role="button"
                aria-label="Add a photo or file"
                className={`${iconTarget} items-center justify-center rounded-control`}
              >
                <Plus size={20} className="text-text" />
              </View>
            </Menu>
          ) : canAttach ? (
            /* Leading group, arriving from the left and settling rightward —
               the later half of the convergence described on `SlideIn`. */
            <SlideIn
              from="left"
              distance={40}
              duration={160}
              delay={100}
              className="flex-row items-center gap-element"
            >
              {showCamera ? (
                <Pressable
                  onPress={onPickCamera}
                  aria-label="Take a photo"
                  className={`${iconTarget} items-center justify-center rounded-control`}
                >
                  <Camera size={20} className="text-text" />
                </Pressable>
              ) : null}
              {showPicture ? (
                <Pressable
                  onPress={pickPicture}
                  aria-label={onPickImage ? 'Add a photo' : 'Take a photo'}
                  className={`${iconTarget} items-center justify-center rounded-control`}
                >
                  {onPickImage ? (
                    <Image size={20} className="text-text" />
                  ) : (
                    <Camera size={20} className="text-text" />
                  )}
                </Pressable>
              ) : null}
              {/* The paperclip, and it is a paperclip on purpose: `FileUp` is the
                  badge the tray puts on a document already attached, and the same
                  glyph doing both jobs would say "this file" where the bar means
                  "add a file". */}
              {showDocument ? (
                <Pressable
                  onPress={onPickDocument}
                  aria-label="Add a file"
                  className={`${iconTarget} items-center justify-center rounded-control`}
                >
                  <Paperclip size={20} className="text-text" />
                </Pressable>
              ) : null}
            </SlideIn>
          ) : (
            // Holds the row's shape so the field does not slide to the leading
            // edge when attach is unavailable.
            <View className={iconTarget} />
          )}

          {/* The middle, and the only part of the row that stretches. No border of
              its own — the container is the field now. `flex-1` resolves onto the
              native wrapper, which is what gives the hosted control a width to
              fill rather than sizing it to its own text. */}
          <Textarea
            /*
              THE HEIGHT BOUNDS ARE LOAD-BEARING ON ANDROID — spread, not styled
              over. `autoGrow` carries `minHeight`, and the floor was once removed
              as visual dead space: the field is a hosted Compose view, the host
              measured its subtree at HEIGHT ZERO — `ComposeView (…, 0.000)` around
              a TextField that still painted its placeholder — and the composer
              looked correct while being impossible to focus or type into, which is
              this product's core interaction. A className min-height never reaches
              the host; only a style does. Nothing may set `style` after this.
            */
            {...autoGrow}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            editable={!disabled}
            /* `text-body-lg`, not `text-body`: this is the field a CHILD types their
             answer into, and it was the smallest text on a screen built for one.
             The hot dial carries it to 18. */
          className="flex-1 resize-none border-0 bg-transparent font-sans text-body-lg text-text placeholder:text-text-muted"
            aria-label="Message composer"
          />

          {/* Trailing group, arriving from the right edge and settling
              leftward. It starts FIRST — the counter-motion against the attach
              key is the whole effect, and it only reads as counter-motion if
              the two do not start together. */}
          <SlideIn
            from="right"
            distance={20}
            duration={200}
            className="flex-row items-center gap-element"
          >
            {/*
              BOTH, always. This swapped — microphone on an empty field, send
              once there was something to send — which is what WhatsApp and the
              rest of the references do.

              It is wrong here. Speaking and sending are two different
              intentions, not two states of one key, and swapping meant the send
              control a child had just used was gone the next time they looked
              for it. A control that moves house depending on what you have
              typed is a control you have to re-find every time. Send is dimmed
              when there is nothing to send, which says the same thing without
              the button leaving.
            */}
            {onStartRecording ? (
              <Pressable
                onPress={onStartRecording}
                disabled={disabled}
                aria-label="Record a voice message"
                className={`${iconTarget} items-center justify-center rounded-control`}
              >
                <Mic size={20} className="text-text" />
              </Pressable>
            ) : null}

            {/* The one piece of colour in the bar, so the eye finds it without
                a label — the brand mango, the same fill the primary action wears
                everywhere else — and a rounded SQUARE, not a circle. The
                references draw circular send keys; this design system does not.
                `radius.control` is the one shape every interactive thing takes,
                and a pill in the middle of a squared-off kit reads as an import
                from somewhere else. Borrowing structure from a reference does not
                mean borrowing its shape language. */}
            <Pressable
              onPress={handleSubmit}
              disabled={!canSend}
              aria-label="Send message"
              /* Send is ALWAYS the brand yellow — it is the row's one primary
                 action and should be findable before there is anything to send.
                 Unavailable is carried by opacity, not by turning it grey: a
                 grey square reads as a different control rather than as the
                 same one waiting. */
              className={`${iconTarget} items-center justify-center rounded-control bg-primary ${
                canSend ? '' : 'opacity-40'
              }`}
            >
              <Send size={20} className="text-on-primary" />
            </Pressable>
          </SlideIn>
        </View>
      </View>
    </KeyboardSticky>
  );
}

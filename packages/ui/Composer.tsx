'use client';
// Composer — the learner message input for the S9 tutor session.
//
// Mobbin: https://mobbin.com/screens/9c13ada9-0c95-45c8-9932-d20010b96e14 (ChatGPT — field and trailing action share one row height) · https://mobbin.com/screens/5def00a9-6228-4ccc-81a3-25cdb2fe20bd (Pi — full-width field, single trailing send) · https://mobbin.com/screens/236da9c6-8b17-4989-ad40-7e0da07ef603 (Noom — Camera / Photo library / Files, one flat list, no submenus) · https://mobbin.com/screens/db352f6d-4d7d-41f1-a678-e66ee043da83 (BFF — the same list including "Record audio message") · https://mobbin.com/screens/1d54bc84-03b2-4f46-8bca-3c6574ac07e1 (Instagram — recording REPLACES the field: live waveform, discard left, send right) · https://mobbin.com/screens/66e343b2-3334-4d2b-9494-bc22ce3cf386 (Beside — same shape, timer beside the waveform) · https://mobbin.com/screens/c827a5e4-3507-4bf7-a570-63bf1224752d (Alan — a sent voice note carries "See transcript"). Structure only.
//
// A child stuck on homework points a camera at it rather than describing it, so
// the composer takes pictures, documents and speech, not only typing.
//
// Three structural decisions, all taken from the references rather than
// invented:
//
//  - ONE flat attachment list. Every app above offers Camera / Photos / Files
//    at the top level. A child hunting through a submenu for "the photo one"
//    has already lost the thread of the problem they were stuck on.
//  - Recording REPLACES the field rather than sitting beside it. While speaking
//    there is nothing to type, and a live waveform where the text was is what
//    tells a child the microphone is actually hearing them.
//  - Discard is on the far side from send. They are opposite intentions and a
//    mis-tap costs the whole message, so they do not sit next to each other.
// SOT: docs/pack/23-tutorstage-handoff.md §3.5 · doc 15 §1
// SOT-KEYWORDS: composer chat input tutor send message learner

import { useCallback } from 'react';
import { View, Text, Pressable, Textarea } from './primitives';
import { useAutoGrow } from './use-autogrow';
import { Button } from './Button';
import { SolitoImage } from 'solito/image';
import { Camera, FileUp, Image, Mic, Plus, Send, Trash2, X } from './icons';
// Through the barrel, not the file. `waveform.ts` (the pure bar maths) and
// `Waveform.tsx` (the component) differ only in case, so a direct path import
// resolves ambiguously on a case-insensitive filesystem and TS refuses it.
import { Waveform } from './audio';
import { Lightbox } from './Lightbox';
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
  const canAttach =
    !disabled && !atImageCap && (onPickCamera ?? onPickImage ?? onPickDocument) !== undefined;

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
    Height only, shared by BOTH actions.

    Attach and Send sized from different systems — attach from the age-band
    target, Send from Button's own scale — so they disagreed by a few pixels and
    the row looked misaligned. They now take the same height token, and only the
    field grows: the two buttons are fixed anchors at either end of a row whose
    middle stretches.
  */
  const actionHeight = {
    sm: 'h-target-adult',
    md: 'h-target-adult',
    lg: 'h-target-teen',
    xl: 'h-target-child',
  }[size];

  /*
    The field's FLOOR is the same token, so an empty composer is one level row.

    Autogrow sizes the field to its content — about 40px for a single line of
    body text plus padding — which is under the 44px touch target the buttons
    take. The row then read as a short field between two taller keys. A minimum
    equal to the action height makes them start level; growth happens upward
    from there, and only the field grows.
  */
  const fieldFloor = {
    sm: 'min-h-target-adult',
    md: 'min-h-target-adult',
    lg: 'min-h-target-teen',
    xl: 'min-h-target-child',
  }[size];
  // Grows with what is typed. The two platforms use different mechanisms —
  // `scrollHeight` on web, `onContentSizeChange` on native — so the hook returns
  // props to spread rather than a single ref.
  const autoGrow = useAutoGrow(value);

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
          <Pressable
            onPress={onCancelRecording}
            aria-label="Discard recording"
            className={`${iconTarget} items-center justify-center rounded-control`}
          >
            <Trash2 size={20} className="text-danger" />
          </Pressable>

          {/* A live indicator, centred, where the reference puts its stop key.
              Not a button: the take ends by sending or discarding, and a third
              way to stop is a third thing to explain to a child mid-sentence. */}
          <View className="flex-row items-center gap-element">
            <View className="h-2 w-2 rounded-full bg-danger" />
            <Text className="font-sans text-caption text-text-muted">Listening</Text>
          </View>

          <Pressable
            onPress={onSendRecording}
            aria-label="Send voice message"
            className={`${iconTarget} items-center justify-center rounded-control bg-primary`}
          >
            <Send size={20} className="text-on-primary" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className={`gap-stack ${className ?? ''}`}>
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
                 name IS the only identifying thing about it. */
              <View
                key={attachment.id}
                className="flex-row items-center gap-element rounded-control border-2 border-border bg-surface-raised py-1 pl-inset-tight pr-1"
              >
                {attachment.kind === 'document' ? <FileUp size={16} className="text-text-muted" /> : null}
                {attachment.kind === 'audio' ? <Mic size={16} className="text-text-muted" /> : null}
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
        ONE surface, two rows inside it.

        This was three separately bordered boxes in a row — attach, field, send —
        which reads as a form, not a composer. Every shipped AI chat surveyed
        (Meta AI, ChatGPT, Claude, Grok, Copilot) does the same thing instead:
        a single container with the text on its own full-width line and the
        actions on a row beneath it, inside.

        It is not only nicer. It fixes the layout problem underneath: with the
        actions on their own row nothing competes with the field for height, so
        the field grows and the keys sit still without either being told to.
        Text also gets the full width, which matters for a long answer.
      */}
      <View
        className={`gap-element rounded-control border-2 border-strong bg-surface-raised px-inset-tight py-inset-field ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        {/* No border of its own — the container is the field now. */}
        <Textarea
          {...autoGrow}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          editable={!disabled}
          /*
            No minimum height. That floor existed when the field sat BESIDE the
            buttons and had to match their touch target; now the actions have
            their own row and the container carries the height, so a floor here
            just opens a band of dead space under a one-line answer.
          */
          className="w-full resize-none border-0 bg-transparent font-sans text-body text-text placeholder:text-text-muted" 
          numberOfLines={1}
          aria-label="Message composer"
        />

        <View className="flex-row items-center justify-between">
          {/* Attach leads, as it does in every reference. Hidden — not disabled —
              when there is no picker or the image cap is reached. */}
          {canAttach ? (
            <Pressable
              onPress={onPickCamera ?? onPickImage ?? onPickDocument}
              aria-label="Add a photo or file"
              className={`${iconTarget} items-center justify-center rounded-control`}
            >
              <Plus size={20} className="text-text" />
            </Pressable>
          ) : (
            // Holds the row's shape so the trailing action does not slide left
            // when attach is unavailable.
            <View className={iconTarget} />
          )}

          <View className="flex-row items-center gap-element">
            {/*
              Speak or send, never both. An empty field offers the microphone,
              because a child who has typed nothing is likelier to want to talk;
              the moment there is something to send, sending is the only thing
              that button does.
            */}
            {!canSend && onStartRecording ? (
              <Pressable
                onPress={onStartRecording}
                disabled={disabled}
                aria-label="Record a voice message"
                className={`${iconTarget} items-center justify-center rounded-control`}
              >
                <Mic size={20} className="text-text" />
              </Pressable>
            ) : (
              /* A filled circle, as every reference draws it — the one piece of
                 colour in the bar, so the eye finds it without a label. */
              <Pressable
                onPress={handleSubmit}
                disabled={!canSend}
                aria-label="Send message"
                /*
                  A rounded SQUARE, not a circle. The references draw circular
                  send keys; this design system does not — `radius.control` is
                  the one shape every interactive thing takes, and a pill in the
                  middle of a squared-off kit reads as an import from somewhere
                  else. Borrowing structure from a reference does not mean
                  borrowing its shape language.
                */
                className={`${iconTarget} items-center justify-center rounded-control ${
                  canSend ? 'bg-primary' : 'bg-surface-sunken'
                }`}
              >
                <Send size={20} className={canSend ? 'text-on-primary' : 'text-text-muted'} />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

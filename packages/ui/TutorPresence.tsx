'use client';
// TutorPresence — Natalie herself, and the one control that reveals or hides her.
//
// WHY THIS EXISTS: the stage used to draw the avatar inside a single branch of
// its state switch (`kind: 'presence'`), so the moment the session started
// coaching — which is immediately, the opening turn fires on arrival — Natalie
// left the screen and never came back. The tutor was not "small on a phone";
// she was absent for the entire lesson on every device. Presence is not a
// state of the conversation, it is the conversation's other participant, so it
// is rendered here, once, outside the switch.
//
// Mobbin: https://mobbin.com/screens/61145e30-2d3f-4722-bd57-031946bcac2e (Grok
// minimised live voice — the collapsed form names WHO is there and WHAT they are
// doing, "Listening…", with the controls inline, so continuing audio is
// explained rather than uncanny) ·
// https://mobbin.com/screens/f3a8b60d-ad7b-433a-b888-e46f45ee6a17 (Tolan — the
// character's own face IS the collapsed control, which is what keeps identity
// continuous across the collapse) ·
// https://mobbin.com/screens/9c801ead-4757-48c4-99d6-ea40833169df (Perplexity
// voice — the revealed form is one centred presence over one quiet control row
// and nothing else competing) ·
// https://mobbin.com/screens/9ab613b6-0e0e-44f3-ab47-77fd1f1fdad7 (Duolingo —
// the character owns a band ABOVE the question and the work owns the bottom, a
// fixed vertical order the learner never has to re-find) ·
// https://mobbin.com/screens/433fb29c-cb3b-41af-9508-e8562b34b88b (Mimo — when
// the workspace matters the tutor docks to a bar beside its line instead of
// taking the screen). Structure only; style stays on docs 02/08/23.
//
// THE HARD RULE THIS COMPONENT IS BUILT AROUND: hiding her must never touch her
// voice. Two independent reasons it cannot, and both were checked on device
// rather than assumed.
//
// 1. Speech does not live in React. `tutor-audio.ts` exports a module-level
//    `TutorAudioQueue` singleton, enqueued by the store's `coach()` and stopped
//    only by an explicit `stop()`; the mic is `AudioRecorderSheet`, mounted at
//    the app root, outside this screen entirely. No component owns either. The
//    ONLY audio API reachable from inside the `Freeze` below is
//    `sampleSpeech()` — a READER the face bus polls to move the mouth. So the
//    worst a freeze can do to audio is stop reading its clock.
// 2. `react-freeze` suspends RE-RENDERS; it does not unmount. Effects are not
//    torn down, which is measurable: with the subtree frozen the face bus went
//    on sampling the audio clock ~130×/s until `TutorAvatar` was taught to stop
//    its own loop. That is a performance bug, and it was fixed there — but it
//    also means a freeze has strictly less reach than an unmount, which is
//    precisely why it is the safe choice next to a live voice session.
//
// What Freeze buys here is that Natalie stays MOUNTED while hidden: the stage
// controller, the face bus and the viseme cursor are held in refs, so revealing
// her resumes an existing tutor instead of constructing a new one mid-sentence.
// Nothing that speaks, records, streams, or captions may ever be moved inside
// the `Freeze` below — the caption is rendered by the stage, above the thread,
// and stays there.
//
// The rail therefore has to SAY she is still there, because she is still
// talking. That is the whole design of the collapsed form: her mark, her name,
// and what she is doing this second. A voice with no visible owner is the one
// thing a child should never get.
//
// SOT: docs/design/tutor-session-responsive-spec.md §1 · §2 · docs/pack/23-tutorstage-handoff.md §3 · §6 ·
//      docs/pack/22-embodied-tutor-avatar-spec.md §7
// SOT-KEYWORDS: tutor presence reveal collapse freeze natalie avatar rail status voice keeps playing

import { useEffect, useState } from 'react';
import { Freeze } from 'react-freeze';
import { Avatar } from './Avatar';
import { Badge, type BadgeProps } from './Badge';
import { ChevronDown, ChevronUp } from './icons';
import { MotionView, useReducedMotion } from './motion';
import { PressScale } from './press-scale';
import { View, Text } from './primitives';
import { isTutorRevealed, type ResolvedTutorPresence } from './tutor-view';

/*
  ONE constant, read by both the transition and the freeze timer.

  The renderer has to stay live for the whole collapse or her face stops
  mid-word while she is still visibly on screen. `onAnimationComplete` is not
  usable as the "exit finished" signal — Legend Motion fires it per animated
  key and does not fire it at all for a key whose value did not change, so a
  reduced-motion pass or an interrupted collapse would leave the subtree
  unfrozen forever. A timer sharing this exact constant cannot drift from the
  animation it is waiting on, because there is only one number.

  180ms sits under doc 23 §6's 200ms state-communicating ceiling.
*/
const COLLAPSE_MS = 180;
const REVEAL_MS = 240;

/**
 * How far she travels in. Small on purpose: doc 22 §7 and doc 02 A.5 ban
 * attention-getting motion on a child's surface, so this reads as her settling
 * into place, not as an entrance.
 */
const REST_Y = 10;
const REST_SCALE = 0.94;

/**
 * The rail's minimum height per age band.
 *
 * Mirrors `Button.tsx`'s size→target mapping rather than picking new numbers —
 * the rail is the band's row-level control and must land on the same target as
 * every other one. Doc 23 §4.4: any affordance on or around the avatar takes
 * the band token.
 */
const RAIL_TARGET: Record<'sm' | 'md' | 'lg' | 'xl', string> = {
  sm: 'min-h-target-adult',
  md: 'min-h-target-adult',
  lg: 'min-h-target-teen',
  xl: 'min-h-target-child',
};

export interface TutorPresenceProps {
  /** Her name. One string, because identity is one thing (doc 22 §7). */
  name: string;
  /** What she is doing this second — the honest signal while she is collapsed. */
  status: string;
  tone: BadgeProps['tone'];
  /** `auto` is resolved at the screen; this component only draws real modes. */
  tutorPresence: ResolvedTutorPresence;
  /**
   * The embodied renderer, held mounted and suspended by `Freeze` whenever she
   * is not revealed — so a reveal resumes the tutor that was already there
   * rather than building a new one. It is the renderer's own job to stop its
   * animation loop while hidden; a freeze does not do that (see the header).
   */
  avatar?: React.ReactNode;
  /** Omit to draw the band as a read-only status strip (no reveal is offered). */
  onToggleReveal?: () => void;
  /**
   * The younger bands' extra line — "She can still hear you." K–2 and 3–5 need
   * telling; a 12th-grader reading "Listening" does not. Density is the band
   * difference, not a different component.
   */
  assurance?: string;
  /** Age-band size, same vocabulary as `Button`. */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function TutorPresence({
  name,
  status,
  tone,
  tutorPresence,
  avatar,
  onToggleReveal,
  assurance,
  size = 'md',
  className,
}: TutorPresenceProps) {
  const revealed = isTutorRevealed(tutorPresence);
  const reducedMotion = useReducedMotion();

  /*
    Legend Motion reads `initial` once, at mount. A session that opens collapsed
    must start AT the resting frame, or she plays a full entrance and exit
    before the first paint settles.

    A lazy `useState` rather than a ref: this is a value the first render needs,
    and reading `ref.current` during render is what `react-hooks/refs` exists to
    stop. The setter is deliberately unused — the point is that it never changes.
  */
  const [mountedRevealed] = useState(revealed);

  /*
    FROZEN IS ASYMMETRIC, and the asymmetry is the whole trick.

    Unfreezing has to happen BEFORE she animates in — a frozen subtree renders
    nothing, so there would be no avatar for the entrance to carry. Freezing has
    to happen AFTER she has animated out, or her last painted frame is whatever
    she looked like at the instant of the press, held under a 180ms fade.

    So the reveal direction is DERIVED (`!revealed && …`) and takes effect in the
    same commit as the press, while the collapse direction waits on a timer. The
    timer is also the only writer, which keeps every state update out of the
    effect body — a synchronous setState there is a cascading render, and this
    component sits above a streaming conversation.
  */
  const [collapseDone, setCollapseDone] = useState(!mountedRevealed);
  useEffect(() => {
    const id = setTimeout(
      () => setCollapseDone(!revealed),
      // Reduced motion has no exit to wait for: the transition is instant, so
      // suspending her on the next tick is suspending her at the right moment.
      revealed || reducedMotion ? 0 : COLLAPSE_MS,
    );
    return () => clearTimeout(id);
  }, [revealed, reducedMotion]);
  const frozen = !revealed && collapseDone;

  /*
    Reduced motion is a render mode, not a style (doc 23 §6 / doc 17 §B3): the
    reveal lands on its final frame with no travel. `useReducedMotion` reads the
    OS setting through the same external store the kit's entrance presets use,
    so this cannot disagree with them.
  */
  const transition = reducedMotion
    ? { type: 'timing' as const, duration: 0 }
    : {
        type: 'timing' as const,
        duration: revealed ? REVEAL_MS : COLLAPSE_MS,
        // `easing`, not `ease` — see the note in motion.tsx. Animated.timing
        // reads only `easing`, and a resolved `ease` is silently dropped.
        easing: 'easeOut' as const,
      };

  const actionLabel = revealed ? `Hide ${name}` : `Show ${name}`;
  const Chevron = revealed ? ChevronUp : ChevronDown;

  const rail = (
    /*
      TWO ROWS, not one, and the second one is why.

      Everything first sat on a single row — mark, name, status, assurance,
      action. In the two-pane layout the conversation column is 380px (doc 23
      §5), and at that width the assurance wrapped INSIDE the middle column and
      shoved the action against the edge: the reassurance and the control were
      fighting each other for the same 120px. The assurance is a sentence, so it
      gets the full width underneath, and the identity row keeps its shape at
      every size the session is drawn at.
    */
    <View
      className={`w-full gap-element rounded-card border-2 border-border bg-surface-sunken px-4 py-2 ${RAIL_TARGET[size]} justify-center`}>
      <View className="w-full flex-row items-center gap-element">
        {/*
          Her mark survives the collapse — doc 01 §6.1's "one continuous identity
          from tab-bar icon → session stage". It is a STATIC mark, not the
          renderer: `audio-only` is defined as no 2D or 3D avatar at all (spec §1),
          and a revealed Natalie already has a face two rows up, so drawing it
          again here would be the same person twice.
        */}
        {!revealed && tutorPresence !== 'audio-only' ? <Avatar name={name} size="sm" /> : null}
        {/*
          One live region for the status. Announced politely, because "Speaking"
          arriving over the top of her own speech is the announcement
          interrupting the thing it announces.
        */}
        <View className="flex-1 flex-row flex-wrap items-center gap-element" aria-live="polite">
          <Text className="font-sans text-label font-semibold text-text">{name}</Text>
          <Badge label={status} tone={tone} />
        </View>
        {onToggleReveal ? (
          /* `shrink-0`: the action is the one thing on this row that must never
             be squeezed — it is the way back to her. */
          <View className="shrink-0 flex-row items-center gap-element">
            <Text className="font-sans text-label text-text-muted">{actionLabel}</Text>
            <Chevron className="h-5 w-5 text-text-muted" />
          </View>
        ) : null}
      </View>
      {assurance ? (
        <Text className="w-full font-sans text-caption text-text-muted">{assurance}</Text>
      ) : null}
    </View>
  );

  return (
    <View className={`w-full gap-element ${className ?? ''}`}>
      {/*
        SHE IS ALWAYS MOUNTED, and always in this one place. Moving her between
        two slots would remount the renderer on every toggle — the stage
        controller, the face bus and the viseme cursor are all held in refs, and
        a remount throws them away mid-sentence. Frozen, the subtree renders
        nothing and takes no height, so a collapsed session pays no layout for
        her either.
      */}
      <MotionView
        className="w-full items-center"
        initial={{
          opacity: mountedRevealed ? 1 : 0,
          scale: mountedRevealed ? 1 : REST_SCALE,
          y: mountedRevealed ? 0 : REST_Y,
        }}
        animate={{
          opacity: revealed ? 1 : 0,
          scale: revealed ? 1 : REST_SCALE,
          y: revealed ? 0 : REST_Y,
        }}
        transition={transition}
        aria-hidden={!revealed}>
        <Freeze freeze={frozen}>{avatar}</Freeze>
      </MotionView>

      {onToggleReveal ? (
        /*
          THE WHOLE ROW IS THE TARGET, both directions, one press. The old
          control was a text button in the toolbar that cycled
          visible → compact → audio-only, so bringing Natalie back from voice-only
          took two presses and the label described a transition rather than a
          state. A child asking "where is she" should not have to read a verb.
        */
        <PressScale
          outerClassName="w-full"
          className="w-full"
          onPress={onToggleReveal}
          role="button"
          aria-label={actionLabel}>
          {rail}
        </PressScale>
      ) : (
        rail
      )}
    </View>
  );
}

'use client';
// TutorAvatar — the embodied Natalie presence.
//
// This is the 2D->3D handoff point. For now it draws the 2D mark while the
// `@acme/avatar` controller and face bus are wired, ticked on requestAnimationFrame,
// and driven by the live tutor audio queue's viseme samples.
// SOT: packages/avatar/src/tutor-stage.ts · packages/app/features/tutor/tutor-audio.ts
// SOT-KEYWORDS: tutor avatar presence 2d 3d handoff face bus speech driver viseme

import { useEffect, useRef } from 'react';
import { Avatar, isTutorRevealed } from '@acme/ui';
import type { ResolvedTutorPresence } from '@acme/ui';
import {
  createFaceBus,
  createTutorStage,
  directEncoder,
  type FaceBus,
  type SpeechDriver,
  type TutorStage,
} from '@acme/avatar';
import { audioQueue } from './tutor-audio';
import { toneRenderFor, type ToneKey } from './tutor-tone';

export interface TutorAvatarProps {
  /** Already resolved by the screen — `auto` has no avatar size to draw. */
  tutorPresence: ResolvedTutorPresence;
  isSpeaking: boolean;
  tone?: ToneKey | null;
}

const speechDriver: SpeechDriver = {
  sampleSpeech: (nowMs) => audioQueue.sampleSpeech(nowMs),
  sampleGesture: () => null,
  speak: async () => {},
  stop: () => {},
  now: () => audioQueue.now(),
  scheduledOnsetAt: 0,
};

export function TutorAvatar({ tutorPresence, isSpeaking, tone }: TutorAvatarProps) {
  const stageRef = useRef<TutorStage | null>(null);
  const faceBusRef = useRef<FaceBus | null>(null);

  /*
    THE FACE LOOP RUNS ONLY WHILE THE FACE IS ON SCREEN.

    The three effects below ran unconditionally, so a learner on voice-only —
    where this component returns `null` — was still paying for a stage
    controller, a face bus, and a 60fps requestAnimationFrame loop driving a
    mouth that was never drawn. So was a learner who had collapsed her.

    `react-freeze` does NOT fix this, and it is worth stating plainly because
    the assumption is easy to make: freezing suspends RE-RENDERS of the subtree,
    it does not unmount it, so `useEffect` cleanups do not run and a timer or a
    rAF loop inside a frozen tree keeps going. Measured on device — with the
    subtree frozen, the face bus was still sampling the audio clock ~130 times a
    second. Freeze is the right tool for keeping her mounted and cheap to bring
    back; it is not a pause button for imperative loops. Those have to stop
    themselves, which is what this flag does.

    That cuts the other way too, and it is the reason the arrangement is safe:
    if freezing cannot stop a loop, it certainly cannot stop speech. Nothing
    about hiding Natalie can reach the audio queue.
  */
  const embodied = isTutorRevealed(tutorPresence);

  // Keep the controller stable for the session. `presence-2d` is the only
  // guaranteed-safe opening tier; higher tiers are introduced by the device
  // capability manager once it has measured.
  useEffect(() => {
    if (!embodied || stageRef.current !== null) return;
    stageRef.current = createTutorStage({ tier: 'presence-2d' });
    faceBusRef.current = createFaceBus({
      speech: speechDriver,
      encoder: directEncoder(['jawOpen']),
    });
  }, [embodied]);

  useEffect(() => {
    stageRef.current?.setSpeaking(isSpeaking);
    faceBusRef.current?.setConversationCues({ partnerSpeaking: isSpeaking });
    if (tone) {
      const { emotion, intensity } = toneRenderFor(tone);
      faceBusRef.current?.setEmotion(emotion, intensity);
    }
  }, [isSpeaking, tone]);

  /*
    Keyed on `embodied` so the loop is torn down and rebuilt by the same pass
    that builds the controllers it ticks. Effects run in declaration order, so
    the refs above are already populated when this first runs.
  */
  useEffect(() => {
    if (!embodied) return;
    const stage = stageRef.current;
    const faceBus = faceBusRef.current;
    if (!stage || !faceBus) return;
    let raf: number;
    const tick = () => {
      stage.tick(performance.now());
      faceBus.step(0.016);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [embodied]);

  /*
    Nothing at all when she is not revealed, and that is not a loss of presence.

    `TutorPresence` draws her static mark on the rail in `compact` and draws no
    mark in `audio-only` (the responsive spec's definition of the mode). What
    this component owns is the LIVE face — the tier controller, the face bus,
    the viseme-driven mouth — and none of that has a job while the face is not
    on screen. Rendering an `md` avatar here as well would put her mark on the
    screen twice while she is collapsed.
  */
  if (!embodied) return null;
  return <Avatar name="Natalie" size="xl" />;
}

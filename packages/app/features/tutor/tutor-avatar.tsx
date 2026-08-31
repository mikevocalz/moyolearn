'use client';
// TutorAvatar — the embodied Natalie presence.
//
// This is the 2D->3D handoff point. For now it draws the 2D mark while the
// `@acme/avatar` controller and face bus are wired, ticked on requestAnimationFrame,
// and driven by the live tutor audio queue's viseme samples.
// SOT: packages/avatar/src/tutor-stage.ts · packages/app/features/tutor/tutor-audio.ts
// SOT-KEYWORDS: tutor avatar presence 2d 3d handoff face bus speech driver viseme

import { useEffect, useRef } from 'react';
import { Avatar } from '@acme/ui';
import type { TutorView } from '@acme/ui';
import {
  createFaceBus,
  createTutorStage,
  directEncoder,
  type FaceBus,
  type SpeechDriver,
  type TutorStage,
} from '@acme/avatar';
import { audioQueue } from './tutor-audio';

export interface TutorAvatarProps {
  tutorView: TutorView;
  isSpeaking: boolean;
}

const speechDriver: SpeechDriver = {
  sampleSpeech: (nowMs) => audioQueue.sampleSpeech(nowMs),
  sampleGesture: () => null,
  speak: async () => {},
  stop: () => {},
  now: () => audioQueue.now(),
  scheduledOnsetAt: 0,
};

export function TutorAvatar({ tutorView, isSpeaking }: TutorAvatarProps) {
  const stageRef = useRef<TutorStage | null>(null);
  const faceBusRef = useRef<FaceBus | null>(null);

  // Keep the controller stable for the session. `presence-2d` is the only
  // guaranteed-safe opening tier; higher tiers are introduced by the device
  // capability manager once it has measured.
  useEffect(() => {
    if (stageRef.current === null) {
      stageRef.current = createTutorStage({ tier: 'presence-2d' });
      faceBusRef.current = createFaceBus({
        speech: speechDriver,
        encoder: directEncoder(['jawOpen']),
      });
    }
  }, []);

  useEffect(() => {
    stageRef.current?.setSpeaking(isSpeaking);
    faceBusRef.current?.setConversationCues({ partnerSpeaking: isSpeaking });
  }, [isSpeaking]);

  useEffect(() => {
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
  }, []);

  if (tutorView === 'hidden') return null;
  return <Avatar name="Natalie" size={tutorView === 'visible' ? 'xl' : 'md'} />;
}

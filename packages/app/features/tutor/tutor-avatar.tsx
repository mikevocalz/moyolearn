'use client';
// TutorAvatar — the embodied Natalie presence.
//
// This is the 2D-to-3D handoff point. For now it draws the 2D mark while the
// `@acme/avatar` controller is wired, ticks on a frame loop, and speaks. The
// 3D renderer will replace the `Avatar` fallback once it is ready to draw a
// real face; 2D remains the safe first-paint surface.
// SOT: packages/avatar/src/tutor-stage.ts · packages/ui/TutorStage.tsx
// SOT-KEYWORDS: tutor avatar presence 2d 3d handoff face speaking tick

import { useEffect, useRef } from 'react';
import { Avatar } from '@acme/ui';
import type { TutorView } from '@acme/ui';
import { createTutorStage } from '@acme/avatar';

export interface TutorAvatarProps {
  tutorView: TutorView;
  isSpeaking: boolean;
}

export function TutorAvatar({ tutorView, isSpeaking }: TutorAvatarProps) {
  // Keep the controller stable for the session. `presence-2d` is the only
  // guaranteed-safe opening tier; higher tiers are introduced by the device
  // capability manager once it has measured.
  const stage = useRef(createTutorStage({ tier: 'presence-2d' })).current;

  useEffect(() => {
    stage.setSpeaking(isSpeaking);
  }, [stage, isSpeaking]);

  useEffect(() => {
    let raf: number;
    const tick = () => {
      stage.tick(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  if (tutorView === 'hidden') return null;
  return <Avatar name="Natalie" size={tutorView === 'visible' ? 'xl' : 'md'} />;
}

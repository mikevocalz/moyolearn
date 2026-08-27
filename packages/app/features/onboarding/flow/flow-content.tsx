'use client';
// The S21–S25 sequences behind one route. Each content component owns its own
// steps; this only picks which one runs and answers "what happens when it ends".
//
// Mobbin: not applicable — this file renders no UI of its own beyond the
// unknown-flow fallback, which is the kit's EmptyState. Every surface it can
// render carries its own citations (guardian-, learner-, tutor-, business- and
// teacher-onboarding-content).
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding flow content router guardian learner tutor owner teacher

import { useRouter } from 'solito/navigation';
import { Button, EmptyState } from '@acme/ui';
import { Compass } from '@acme/ui/icons';
import { GuardianOnboardingContent } from '../guardian/guardian-onboarding-content';
import { LearnerFirstRunContent } from '../learner/learner-first-run-content';
import { TutorOnboardingContent } from '../tutor/tutor-onboarding-content';
import { BusinessOnboardingContent } from '../business/business-onboarding-content';
import { TeacherOnboardingContent } from '../teacher/teacher-onboarding-content';
import { isOnboardingFlow, type OnboardingFlow } from './flow';
import { voiceBandFor } from '../../capture/age-band';
import { useSessionStore } from '../../../providers/session/store';
import { API_URL } from '../../tutor/tutor.store';

const NEXT_PATH: Record<OnboardingFlow, string> = {
  // Doc 36 §2: the learner lands on TODAY with one action (Snap), not inside a
  // live session. '/' is the dispatcher, whose learner shell root is Today.
  learner: '/',
  guardian: '/',
  tutor: '/',
  teacher: '/',
  owner: '/',
};

export function OnboardingFlowContent({ flow }: { flow: string }) {
  const router = useRouter();
  const ageBand = useSessionStore((s) => s.activeContext.gradeBand);

  /**
   * Every way out of a learner flow — Today OR the guided first Snap — runs the
   * same band persist, because the Snap route ends in a live tutor exchange and
   * an unsaved band there means the wrong register out loud (doc 32).
   */
  const finish = (path: string) => {
    // The band was collected at S14 and, until now, only ever reached the client
    // session store — so the server's copy stayed at its default and every
    // learner got the older register. Persist before routing, and do not block
    // a child on the write: the band has a safe default, and a learner staring
    // at a spinner because a PATCH is slow is the worse outcome.
    if (flow === 'learner' && ageBand) {
      void fetch(`${API_URL}/api/learner/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ gradeBand: voiceBandFor(ageBand) }),
      }).catch(() => {
        // Nothing to say to the learner here. The band falls back to 9-12,
        // which is the same default the field carries.
      });
    }

    router.replace(path);
  };

  // Learners land in the tutor; other roles land at the home shell.
  const done = () => finish(isOnboardingFlow(flow) ? NEXT_PATH[flow] : '/');
  // Doc 37 §2's guided first Snap: onboarding ends INTO the capture flow, which
  // owns the camera and its permission ask (guided-frame, doc 37 §1.5).
  const trySnap = () => finish('/capture');

  if (!isOnboardingFlow(flow)) {
    return (
      <EmptyState
        icon={<Compass className="text-text-muted" />}
        title="We don’t have a setup for that"
        description="Pick who you are and we’ll start the right one."
        action={<Button title="Start over" onPress={() => router.replace('/onboarding')} />}
      />
    );
  }

  return FLOWS[flow]({ done, trySnap });
}

interface FlowExits {
  done: () => void;
  /** Only the learner flow uses it; it rides the same band-persisting finish. */
  trySnap: () => void;
}

/**
 * A map, not a switch, so adding S26 is one line and TypeScript names the case
 * you forgot: `Record<OnboardingFlow, …>` is exhaustive by construction.
 */
const FLOWS: Record<OnboardingFlow, (exits: FlowExits) => React.ReactElement> = {
  guardian: ({ done }) => <GuardianOnboardingContent onExit={done} />,
  learner: ({ done, trySnap }) => <LearnerFirstRunContent onDone={done} onTrySnap={trySnap} />,
  tutor: ({ done }) => <TutorOnboardingContent onExit={done} />,
  owner: ({ done }) => <BusinessOnboardingContent onExit={done} />,
  teacher: ({ done }) => <TeacherOnboardingContent onExit={done} />,
};

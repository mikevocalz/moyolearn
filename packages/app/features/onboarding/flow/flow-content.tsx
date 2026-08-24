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

export function OnboardingFlowContent({ flow }: { flow: string }) {
  const router = useRouter();
  // Every sequence ends in the same place: the shell the role already routes to.
  // Onboarding is not a destination, so it does not push one of its own.
  const done = () => router.replace('/');

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

  return FLOWS[flow](done);
}

/**
 * A map, not a switch, so adding S26 is one line and TypeScript names the case
 * you forgot: `Record<OnboardingFlow, …>` is exhaustive by construction.
 */
const FLOWS: Record<OnboardingFlow, (done: () => void) => React.ReactElement> = {
  guardian: (done) => <GuardianOnboardingContent onExit={done} />,
  learner: (done) => <LearnerFirstRunContent onDone={done} />,
  tutor: (done) => <TutorOnboardingContent onExit={done} />,
  owner: (done) => <BusinessOnboardingContent onExit={done} />,
  teacher: (done) => <TeacherOnboardingContent onExit={done} />,
};

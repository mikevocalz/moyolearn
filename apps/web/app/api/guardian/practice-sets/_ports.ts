// The ports the three practice-set routes hand the service, in one place so
// the draft, approve and print routes cannot wire different readers.
//
// Persistence is B1's repository (docs/work/pr-100/briefs/b1.md step 3). The
// ward's band is read here because no repository exposes a by-learner band
// read: `loadGradeBand` in student-model.repository.ts reads `ctx.learnerId`,
// which on these routes is the guardian.
// SOT: docs/work/pr-100/contract.md §Routes §Practice sets
// SOT-KEYWORDS: practice set route ports repository band ward dropped log
import 'server-only';
import { randomUUID } from 'node:crypto';
import { getPayload } from 'payload';
import config from '@payload-config';
import { readVoiceBand } from '@acme/student-model/pure';
import type { PracticePorts } from '@acme/app/features/homework/practice.service.ts';
import {
  approvePracticeSet,
  createPracticeSet,
  loadPracticeSet,
  loadSubmission,
} from '@/lib/homework.repository';
import { loadGuardianWards } from '@/lib/summary.repository';

export const practicePorts: PracticePorts = {
  loadGuardianWards,
  loadSubmission,
  createPracticeSet,
  approvePracticeSet,
  loadPracticeSet,
  loadLearnerBand: async (learnerAuthId) => {
    const payload = await getPayload({ config });
    const user = await payload.findByID({ collection: 'users', id: learnerAuthId }).catch(() => null);
    return readVoiceBand((user as { gradeBand?: string } | null)?.gradeBand);
  },
  newPracticeSetId: () => randomUUID(),
  // Ids and checker reasons only; a prompt never reaches the log.
  reportDropped: (practiceSetId, dropped) => {
    console.warn(
      JSON.stringify({
        event: 'homework.practice.dropped',
        practiceSetId,
        dropped: dropped.map(({ id, skillTag, reason }) => ({ id, skillTag, reason })),
      }),
    );
  },
};

/** Same mapping as the report routes, plus the ward refusal. */
export function practiceErrorStatus(message: string): { status: number; error: string } {
  if (message === 'Unauthenticated') return { status: 401, error: 'Unauthenticated' };
  if (message === 'Forbidden') return { status: 403, error: 'Forbidden' };
  return { status: 500, error: 'Practice set unavailable' };
}

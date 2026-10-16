import 'server-only';
// Guardian practice sets: draft from a submission, approve, load for print.
//
// Every entry runs under `protectedOperation`, and the caller is the guardian
// on `ctx`, never a body field. Each one re-reads the wards list, so a
// guardianship revoked after the draft was made also revokes the approve and
// the print; the repository's `guardianAuthId = ctx.learnerId` scoping is the
// second wall, not the only one.
//
// The draft is practice, and the key is for the adult. Nothing here reads a
// child's answer or records a result: approving a set says "I read these and
// they suit my child", and printing is the only thing an approval unlocks.
// Dropped items (the checker refused the key) are reported through a port with
// ids and reasons only, so the log carries no question text.
// SOT: docs/work/pr-100/contract.md §Practice sets §Routes · docs/work/pr-100/briefs/b1.md step 3 · packages/app/features/capture/assessment-readiness.ts
// SOT-KEYWORDS: practice set service guardian draft approve print ward protected operation answer key
import type { Auth } from '@acme/auth/server';
import type { DroppedPracticeItem, VoiceBand } from '@acme/student-model/pure';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';
import type { LoadGuardianWards } from '../summary/summary.service.ts';
import type { HomeworkSubmissionView, PracticeSetView } from './homework.types.ts';
import { buildPracticeDraft, canHoldPracticeKey } from './practice-draft.ts';

/**
 * Repository names follow docs/work/pr-100/briefs/b1.md step 3. The three
 * practice-set functions scope by `guardianAuthId = ctx.learnerId`, so a
 * foreign id reads as null rather than as someone else's row.
 */
export interface PracticePorts {
  readonly loadGuardianWards: LoadGuardianWards;
  readonly loadSubmission: (ctx: ProtectedCtx, submissionId: string) => Promise<HomeworkSubmissionView | null>;
  /** The ward's recorded band; null when none is recorded. */
  readonly loadLearnerBand: (learnerAuthId: string) => Promise<VoiceBand | null>;
  readonly createPracticeSet: (ctx: ProtectedCtx, draft: PracticeSetView) => Promise<PracticeSetView>;
  readonly approvePracticeSet: (ctx: ProtectedCtx, practiceSetId: string) => Promise<PracticeSetView | null>;
  readonly loadPracticeSet: (ctx: ProtectedCtx, practiceSetId: string) => Promise<PracticeSetView | null>;
  readonly newPracticeSetId: () => string;
  readonly reportDropped: (practiceSetId: string, dropped: readonly DroppedPracticeItem[]) => void;
}

/**
 * The band the generator draws on when the ward has none recorded. 3-5 is the
 * middle of the range, and the preview shows every item before anything is
 * printed, so an adult sees a mismatch before a child does.
 */
const UNRECORDED_BAND: VoiceBand = '3-5';

export class PracticeSetNotApproved extends Error {
  constructor() {
    super('PracticeSetNotApproved');
    this.name = 'PracticeSetNotApproved';
  }
}

async function requireKeyHolder(ctx: ProtectedCtx, ports: PracticePorts, learnerAuthId: string): Promise<void> {
  const wards = await ports.loadGuardianWards(ctx);
  if (!canHoldPracticeKey(ctx, wards, learnerAuthId)) throw new Error('Forbidden');
}

/** Null when the submission does not exist or is not the caller's ward's. */
export async function draftPracticeSet(
  auth: Auth,
  headers: Headers,
  submissionId: string,
  ports: PracticePorts,
): Promise<PracticeSetView | null> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const submission = await ports.loadSubmission(ctx, submissionId);
      if (submission === null) return null;
      await requireKeyHolder(ctx, ports, submission.learnerAuthId);
      const band = (await ports.loadLearnerBand(submission.learnerAuthId)) ?? UNRECORDED_BAND;
      const { view, dropped } = buildPracticeDraft({
        submission,
        band,
        practiceSetId: ports.newPracticeSetId(),
        now: new Date().toISOString(),
      });
      if (dropped.length > 0) ports.reportDropped(view.practiceSetId, dropped);
      return ports.createPracticeSet(ctx, view);
    },
    { telemetry: { op: 'homework.practice.draft', resource: 'homeworkPracticeSets', action: 'write' } },
  );
}

export async function approvePracticeSetFor(
  auth: Auth,
  headers: Headers,
  practiceSetId: string,
  ports: PracticePorts,
): Promise<PracticeSetView | null> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const existing = await ports.loadPracticeSet(ctx, practiceSetId);
      if (existing === null) return null;
      await requireKeyHolder(ctx, ports, existing.learnerAuthId);
      if (existing.status === 'approved') return existing;
      return ports.approvePracticeSet(ctx, practiceSetId);
    },
    { telemetry: { op: 'homework.practice.approve', resource: 'homeworkPracticeSets', action: 'write' } },
  );
}

/** For the print route. A draft does not print: the adult approves what they read first. */
export async function practiceSetForPrint(
  auth: Auth,
  headers: Headers,
  practiceSetId: string,
  ports: Pick<PracticePorts, 'loadGuardianWards' | 'loadPracticeSet'>,
): Promise<PracticeSetView | null> {
  return protectedOperation(
    auth,
    headers,
    async (ctx) => {
      const set = await ports.loadPracticeSet(ctx, practiceSetId);
      if (set === null) return null;
      const wards = await ports.loadGuardianWards(ctx);
      if (!canHoldPracticeKey(ctx, wards, set.learnerAuthId)) throw new Error('Forbidden');
      if (set.status !== 'approved') throw new PracticeSetNotApproved();
      return set;
    },
    { telemetry: { op: 'homework.practice.print', resource: 'homeworkPracticeSets', action: 'read' } },
  );
}

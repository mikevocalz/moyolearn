// Student-model repository — what is left of the tutor's Payload surface after
// the educational store took the model.
//
// It used to hold the whole thing: `saveTranscript`, `saveFacts` and
// `loadPriorFacts` against `payload.session_transcripts` and
// `payload.student_model_facts`. Doc 12 §4 puts that store in `edu`, and it now
// actually is there — the three moved to `edu.repository.ts` and are NOT
// re-exported from here. A shim would have been the kind thing to do for call
// sites and the wrong thing for the separation: two names for one write path is
// how a feature ends up pointed at the store that stopped being authoritative.
//
// Two things stay, for one reason each:
//
//   `factFromDoc` — the retention sweep still drains the `payload` copies
//   (`retention.repository.ts`), and it needs to decode a row to run the cascade
//   over it. It decodes; it does not serve a read path.
//
//   `loadGradeBand` / `saveGradeBand` — the grade band is a property of the USER
//   record, doc 07 §3 layer 1. That is the operational store and it belongs in
//   `payload`; moving it to `edu` would put an account attribute in the
//   educational store because it happens to be read by a tutoring turn.
// SOT: CLAUDE.md §The block · docs/pack/19-learning-outcomes-spec.md §3 · apps/web/lib/edu.repository.ts
// SOT-KEYWORDS: student model repository payload grade band fact decoder retention sweep separation edu cutover
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { StudentModelFact } from '@acme/payload';
import { asVoiceBand } from '@acme/app/server';
import type {
  LoadGradeBand,
  SaveGradeBand,
  DerivedFact,
  MasteryFact,
  ReviewFact,
  ScaffoldingFact,
  MisconceptionFact,
  InterestFact,
} from '@acme/app/server';

async function withPayload<T>(fn: (payload: Awaited<ReturnType<typeof getPayload>>) => Promise<T>): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

/**
 * One `studentModelFacts` row decoded into the discriminated union the model is
 * written in.
 *
 * Its ONLY caller now is the retention sweep (`retention.repository.ts`), which
 * has to decode a `payload` fact to run the cascade over it. It was shared with
 * the tutoring read path until that path moved to `edu`; it stayed here rather
 * than moving with it because `edu.repository.ts:factFromRow` decodes typed
 * columns and this decodes a `detail` blob — same job, two schemas, and merging
 * them would mean one function pretending both stores have the same shape.
 *
 * A row whose `kind` this build does not know is returned as `null` and skipped
 * rather than coerced — an unreadable fact is not shown, and it is not deleted
 * either, because deleting on a shape we could not parse would be guessing with
 * a child's data.
 */
export function factFromDoc(doc: StudentModelFact): DerivedFact | null {
  const common = {
    id: doc.factId,
    learnerId: doc.learnerAuthId,
    sentence: doc.sentence,
    derivedFrom: (doc.derivedFrom ?? []) as readonly string[],
    observedAt: doc.observedAt,
    expiresAt: doc.expiresAt,
  };

  const detail = (doc.detail ?? {}) as Record<string, string | number | boolean | undefined>;
  const kind: DerivedFact['kind'] = doc.kind;

  if (kind === 'mastery') {
    return {
      ...common,
      kind: 'mastery' as const,
      skillId: (detail.skillId as string) ?? '',
      skillTitle: (detail.skillTitle as string) ?? '',
      p: (detail.p as number) ?? 0,
      attempts: (detail.attempts as number) ?? 0,
    } satisfies MasteryFact;
  }
  if (kind === 'review') {
    return {
      ...common,
      kind: 'review' as const,
      skillId: (detail.skillId as string) ?? '',
      skillTitle: (detail.skillTitle as string) ?? '',
      dueAt: (detail.dueAt as string) ?? common.observedAt,
      intervalDays: (detail.intervalDays as number) ?? 0,
    } satisfies ReviewFact;
  }
  if (kind === 'scaffolding') {
    return {
      ...common,
      kind: 'scaffolding' as const,
      skillId: (detail.skillId as string) ?? '',
      hintDepth: (detail.hintDepth as number) ?? 0,
    } satisfies ScaffoldingFact;
  }
  if (kind === 'misconception') {
    return {
      ...common,
      kind: 'misconception' as const,
      skillId: (detail.skillId as string) ?? '',
      tag: (detail.tag as string) ?? '',
      strategy: (detail.strategy as string) ?? '',
      active: (detail.active as boolean) ?? false,
    } satisfies MisconceptionFact;
  }
  if (kind === 'interest') {
    return {
      ...common,
      kind: 'interest' as const,
      tag: (detail.tag as string) ?? '',
      guardianApproved: (detail.guardianApproved as boolean) ?? false,
    } satisfies InterestFact;
  }
  return null;
}

/**
 * Doc 31 §2.1's voice band, read from the learner's own record.
 *
 * `asVoiceBand` owns both the fallback and the migration, which is why the
 * comparison that used to live here is gone. A row written before the field was
 * split still says `young` or `older`, and mapping rather than rejecting those
 * is what keeps a six-year-old out of the register doc 31 was written about.
 * The fallback for an unreadable value stays 9-12 for the reason it always was:
 * a band is a safe thing to be wrong about in that direction, and the flag read
 * next to it — which is not — has no fallback at all.
 */
export const loadGradeBand: LoadGradeBand = async (ctx) => {
  return withPayload(async (payload) => {
    const user = await payload.findByID({ collection: 'users', id: ctx.learnerId }).catch(() => null);
    return asVoiceBand((user as { gradeBand?: string } | null)?.gradeBand);
  });
};

/** The write half of `loadGradeBand`. Doc 07 §3 layer 1's band, persisted. */
export const saveGradeBand: SaveGradeBand = async (ctx, gradeBand) => {
  await withPayload((payload) =>
    payload.update({ collection: 'users', id: ctx.learnerId, data: { gradeBand } }),
  );
};

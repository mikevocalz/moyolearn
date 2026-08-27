// Student-model repository — the only place the tutor's routes touch Payload.
//
// CLAUDE.md's block says only repositories touch `@acme/payload`, and this file
// exists because the fact-loading code was living inside the evaluate route. A
// second route (the coaching turn) needs the same reads, and a repository
// copied into two routes is a repository that will disagree with itself by the
// third.
// SOT: CLAUDE.md §The block · docs/pack/19-learning-outcomes-spec.md §3
// SOT-KEYWORDS: student model repository payload facts transcript grade band load save
import 'server-only';
import { getPayload } from 'payload';
import config from '@payload-config';
import type { StudentModelFact } from '@acme/payload';
import type {
  ProtectedCtx,
  TranscriptToSave,
  LoadPriorFacts,
  LoadGradeBand,
  SaveGradeBand,
  SaveFacts,
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

export async function saveTranscript(_ctx: ProtectedCtx, transcript: TranscriptToSave) {
  await withPayload((payload) =>
    payload.create({
      collection: 'sessionTranscripts',
      /*
        Spread field by field rather than cast. `turns` is a readonly array on
        the service's type and a mutable JSON column on the collection's, and a
        cast through `unknown` hid that mismatch instead of resolving it — while
        also silencing every future field the two shapes stop agreeing on.
      */
      data: {
        sessionId: transcript.sessionId,
        learnerAuthId: transcript.learnerAuthId,
        turns: [...transcript.turns],
        capturedAt: transcript.capturedAt,
        expiresAt: transcript.expiresAt,
      },
    }),
  );
}

/**
 * One `studentModelFacts` row decoded into the discriminated union the model is
 * written in.
 *
 * Exported rather than kept inside `loadPriorFacts` because the retention sweep
 * (`retention.repository.ts`) reads the same rows through a different `where`,
 * and a second decoder would be a second place for the JSON `detail` column to
 * disagree about what a fact is.
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

export const loadPriorFacts: LoadPriorFacts = async (ctx) => {
  return withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'studentModelFacts',
      where: { learnerAuthId: { equals: ctx.learnerId } },
      limit: 1000,
    });
    return docs.map(factFromDoc).filter((fact): fact is DerivedFact => fact !== null);
  });
};

function factDetail(fact: DerivedFact): Record<string, unknown> {
  if (fact.kind === 'mastery') {
    return { skillId: fact.skillId, skillTitle: fact.skillTitle, p: fact.p, attempts: fact.attempts };
  }
  if (fact.kind === 'review') {
    return { skillId: fact.skillId, skillTitle: fact.skillTitle, dueAt: fact.dueAt, intervalDays: fact.intervalDays };
  }
  if (fact.kind === 'scaffolding') {
    return { skillId: fact.skillId, hintDepth: fact.hintDepth };
  }
  if (fact.kind === 'misconception') {
    return { skillId: fact.skillId, tag: fact.tag, strategy: fact.strategy, active: fact.active };
  }
  if (fact.kind === 'interest') {
    return { tag: fact.tag, guardianApproved: fact.guardianApproved };
  }
  return {};
}

export const saveFacts: SaveFacts = async (ctx, facts) => {
  return withPayload(async (payload) => {
    for (const fact of facts) {
      const { docs } = await payload.find({
        collection: 'studentModelFacts',
        where: {
          factId: { equals: fact.id },
          learnerAuthId: { equals: ctx.learnerId },
        },
        limit: 1,
      });

      const base = {
        factId: fact.id,
        learnerAuthId: ctx.learnerId,
        kind: fact.kind,
        sentence: fact.sentence,
        detail: factDetail(fact),
        derivedFrom: [...fact.derivedFrom],
        observedAt: fact.observedAt,
        expiresAt: fact.expiresAt,
      };

      if (docs.length > 0 && docs[0].id) {
        await payload.update({
          collection: 'studentModelFacts',
          id: docs[0].id,
          data: base,
        });
      } else {
        await payload.create({
          collection: 'studentModelFacts',
          data: base,
        });
      }
    }
  });
};

/**
 * Doc 07 §3 layer 1's band, read from the learner's own record. Falls back to
 * `older` when the field is unset, which is the same default `crisisResponse`
 * carries: the older register does not baby-talk a teenager, and a young child
 * shown it is still shown a correct crisis resource.
 */
export const loadGradeBand: LoadGradeBand = async (ctx) => {
  return withPayload(async (payload) => {
    const user = await payload.findByID({ collection: 'users', id: ctx.learnerId }).catch(() => null);
    return (user as { gradeBand?: string } | null)?.gradeBand === 'young' ? 'young' : 'older';
  });
};

/** The write half of `loadGradeBand`. Doc 07 §3 layer 1's band, persisted. */
export const saveGradeBand: SaveGradeBand = async (ctx, gradeBand) => {
  await withPayload((payload) =>
    payload.update({ collection: 'users', id: ctx.learnerId, data: { gradeBand } }),
  );
};

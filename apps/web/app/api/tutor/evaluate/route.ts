// POST /api/tutor/evaluate — server-side answer check for the S9 tutor.
// SOT: CLAUDE.md §The block · docs/pack/19-learning-outcomes-spec.md §3
// SOT-KEYWORDS: tutor evaluate api route protected operation server transcript payload student model
import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { evaluateTutorTurn } from '@acme/app/server';
import type {
  ProtectedCtx,
  TranscriptToSave,
  LoadPriorFacts,
  SaveFacts,
  DerivedFact,
  MasteryFact,
  ReviewFact,
  ScaffoldingFact,
  MisconceptionFact,
  InterestFact,
} from '@acme/app/server';
import { auth } from '@/lib/auth';

async function withPayload<T>(fn: (payload: Awaited<ReturnType<typeof getPayload>>) => Promise<T>): Promise<T> {
  const payload = await getPayload({ config });
  return fn(payload);
}

async function saveTranscript(_ctx: ProtectedCtx, transcript: TranscriptToSave) {
  await withPayload((payload) =>
    payload.create({
      collection: 'sessionTranscripts',
      data: transcript as unknown as Record<string, unknown>,
    }),
  );
}

const loadPriorFacts: LoadPriorFacts = async (ctx) => {
  return withPayload(async (payload) => {
    const { docs } = await payload.find({
      collection: 'studentModelFacts',
      where: { learnerAuthId: { equals: ctx.learnerId } },
      limit: 1000,
    });
    return docs.map((doc) => {
      const common = {
        id: doc.factId as string,
        learnerId: doc.learnerAuthId as string,
        sentence: doc.sentence as string,
        derivedFrom: (doc.derivedFrom ?? []) as readonly string[],
        observedAt: doc.observedAt as string,
        expiresAt: doc.expiresAt as string,
      };

      const detail = (doc.detail ?? {}) as Record<string, unknown>;
      const kind = doc.kind as DerivedFact['kind'];

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
    }).filter(Boolean) as DerivedFact[];
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

const saveFacts: SaveFacts = async (ctx, facts) => {
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
          data: base as Record<string, unknown>,
        });
      } else {
        await payload.create({
          collection: 'studentModelFacts',
          data: base as Record<string, unknown>,
        });
      }
    }
  });
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('problem' in body) ||
    !('answer' in body) ||
    typeof (body as Record<string, unknown>).problem !== 'string' ||
    typeof (body as Record<string, unknown>).answer !== 'string' ||
    !('hintDepth' in body) ||
    typeof (body as Record<string, unknown>).hintDepth !== 'number'
  ) {
    return NextResponse.json({ error: 'problem, answer, and hintDepth are required' }, { status: 400 });
  }

  const { problem, answer, hintDepth } = body as { problem: string; answer: string; hintDepth: number };

  try {
    const result = await evaluateTutorTurn(auth, request.headers, { problem, answer, hintDepth }, loadPriorFacts, saveTranscript, saveFacts);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

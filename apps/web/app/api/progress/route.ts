// GET /api/progress — learner student model snapshot from persisted StudentModelFacts.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/22-reporting-charts-spec.md §2
// SOT-KEYWORDS: progress api mastery review scaffolding student model protected operation
import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { protectedOperation } from '@acme/app/server';
import { auth } from '@/lib/auth';

export interface ProgressResponse {
  masteryBySkill: Record<string, number>;
  reviewBySkill: Record<string, string>;
  scaffoldingBySkill: Record<string, number>;
}

export async function GET(request: NextRequest) {
  try {
    const snapshot = await protectedOperation(auth, request.headers, async (ctx) => {
      const payload = await getPayload({ config });
      const { docs } = await payload.find({
        collection: 'studentModelFacts',
        where: { learnerAuthId: { equals: ctx.learnerId } },
        limit: 1000,
      });

      const mastery: Record<string, number> = {};
      const review: Record<string, string> = {};
      const scaffolding: Record<string, number> = {};

      for (const doc of docs) {
        const detail = (doc.detail ?? {}) as Record<string, unknown>;
        const skillTitle = (detail.skillTitle as string | undefined) ?? (doc.sentence as string);
        if (!skillTitle) continue;

        if (doc.kind === 'mastery') {
          const p = typeof detail.p === 'number' ? detail.p : 0;
          mastery[skillTitle] = p;
        } else if (doc.kind === 'review') {
          const dueAt = (detail.dueAt as string) ?? (doc.observedAt as string);
          review[skillTitle] = dueAt;
        } else if (doc.kind === 'scaffolding') {
          const hintDepth = typeof detail.hintDepth === 'number' ? detail.hintDepth : 0;
          scaffolding[skillTitle] = hintDepth;
        }
      }
      return { mastery, review, scaffolding };
    });
    return NextResponse.json({
      masteryBySkill: snapshot.mastery,
      reviewBySkill: snapshot.review,
      scaffoldingBySkill: snapshot.scaffolding,
    } satisfies ProgressResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

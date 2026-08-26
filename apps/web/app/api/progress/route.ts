// GET /api/progress — learner mastery snapshot from persisted StudentModelFacts.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/22-reporting-charts-spec.md §2
// SOT-KEYWORDS: progress api mastery student model protected operation
import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { protectedOperation } from '@acme/app/server';
import { auth } from '@/lib/auth';

export interface ProgressResponse {
  masteryBySkill: Record<string, number>;
}

export async function GET(request: NextRequest) {
  try {
    const masteryBySkill = await protectedOperation(auth, request.headers, async (ctx) => {
      const payload = await getPayload({ config });
      const { docs } = await payload.find({
        collection: 'studentModelFacts',
        where: {
          and: [
            { learnerAuthId: { equals: ctx.learnerId } },
            { kind: { equals: 'mastery' } },
          ],
        },
        limit: 1000,
      });
      const mastery: Record<string, number> = {};
      for (const doc of docs) {
        if (doc.kind !== 'mastery') continue;
        const detail = (doc.detail ?? {}) as { skillTitle?: string; p?: number };
        const skillTitle = detail.skillTitle ?? (doc.sentence as string);
        const p = typeof detail.p === 'number' ? detail.p : 0;
        if (skillTitle) mastery[skillTitle] = p;
      }
      return mastery;
    });
    return NextResponse.json({ masteryBySkill } satisfies ProgressResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

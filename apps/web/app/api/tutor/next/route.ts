// GET /api/tutor/next — adaptive next practice problem from the student model.
// SOT: docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/23-tutorstage-handoff.md §3
// SOT-KEYWORDS: tutor next adaptive practice problem student model review mastery
import { NextRequest, NextResponse } from 'next/server';
import { getPayload } from 'payload';
import config from '@payload-config';
import { protectedOperation } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { generatePracticeProblem } from '@acme/student-model/pure';

export interface NextProblemResponse {
  skillTitle: string;
  problem: string;
}

const SEED_SKILLS = [
  'Number sense',
  'Order of operations',
  'Fractions',
  'Word problems',
];

export async function GET(request: NextRequest) {
  try {
    const next = await protectedOperation(auth, request.headers, async (ctx) => {
      const payload = await getPayload({ config });
      const { docs } = await payload.find({
        collection: 'studentModelFacts',
        where: {
          and: [
            { learnerAuthId: { equals: ctx.learnerId } },
            { kind: { in: ['mastery', 'review'] } },
          ],
        },
        limit: 1000,
      });

      const now = new Date().toISOString();
      const reviews: string[] = [];
      const mastery: { skillTitle: string; p: number }[] = [];

      for (const doc of docs) {
        const detail = (doc.detail ?? {}) as Record<string, unknown>;
        const skillTitle = (detail.skillTitle as string | undefined) ?? (doc.sentence as string);
        if (!skillTitle) continue;

        if (doc.kind === 'review') {
          const dueAt = (detail.dueAt as string) ?? (doc.observedAt as string);
          if (dueAt <= now) reviews.push(skillTitle);
        } else if (doc.kind === 'mastery') {
          const p = typeof detail.p === 'number' ? detail.p : 1;
          mastery.push({ skillTitle, p });
        }
      }

      // Prioritize due reviews, then lowest mastery, then seeded skills.
      const skill =
        reviews[0] ??
        mastery.sort((a, b) => a.p - b.p)[0]?.skillTitle ??
        SEED_SKILLS[Math.floor(Math.random() * SEED_SKILLS.length)];

      const problem = generatePracticeProblem(skill);
      if (!problem) throw new Error('No practice problem for skill');
      return { skillTitle: skill, problem };
    });
    return NextResponse.json(next satisfies NextProblemResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

// POST /api/memory/forget-all — "Forget everything about Maya", for real.
//
// THE THIRD ROUTE THAT DID NOT EXIST, and the worst of the three.
// `memory.store.ts:confirmForgetAll` was `set({ facts: [], transcripts: [] })`.
// The dialog above it read "All N notes and N sessions are deleted. Her account,
// her plan and her past work are not touched", and the only true clause in that
// sentence was the last one.
//
// IT READS NO BODY. Not "it validates the body" — it never calls `request.json`.
// There is nothing a caller could legitimately say: the learner is
// `ctx.learnerId` (CLAUDE.md §The block), and a request that could name whose
// record to destroy would be the worst-shaped endpoint in a children's product.
// The absence is the security property, so it is stated rather than left to be
// noticed.
//
// TWO STORES, ONE PRESS. `forgetEduLearnerRecord` empties every `edu` table for
// the learner in one transaction — transcripts, the knowledge graph, the vectors
// that hang off them by foreign key, AND `edu.blocked_tags`, which is cleared
// here and recorded by the single-line eraser (that file argues the asymmetry).
// `eraseLearnerMedia` deletes the objects: the photograph of the handwriting and
// the recording of the voice, which are the closest thing we hold to the child
// herself. When it cannot prove which objects are hers it refuses and says so,
// and the response carries that refusal to the screen instead of rounding it to
// success.
//
// A GUARDIAN SURFACE at the free `practise` floor, for the third time and the
// same reason: a family whose card lapsed must still be able to delete what we
// know about their child.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27 · packages/app/features/memory/memory.service.ts · apps/web/lib/bunny.repository.ts
// SOT-KEYWORDS: memory s27 forget everything api route protected operation guardian delete all edu blocked tags bunny media erasure
import { NextRequest, NextResponse } from 'next/server';
import { forgetEverything } from '@acme/app/server';
import { forgetEduLearnerRecord } from '@/lib/edu.repository';
import { forgetSessionSummaries } from '@/lib/summary.repository';
import { eraseLearnerMedia } from '@/lib/bunny.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const result = await forgetEverything(auth, request.headers, {
      forgetLearnerRecord: forgetEduLearnerRecord,
      // Doc 34 §3: summaries outlive transcripts, so this cascade is the ONLY
      // deleter they have. The port is required, not optional, for that reason.
      forgetSessionSummaries,
      eraseLearnerMedia,
    });
    /*
      Counts and a media verdict, never the ids of what went. A guardian pressing
      this asked for the record to stop existing, and echoing the fact ids back
      would be a last copy of the model in a response body written to logs.
    */
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

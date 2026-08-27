// POST /api/tutor/evaluate — server-side answer check for the S9 tutor.
//
// THE COMPOSITION ROOT for the tutoring write path, which is why the store the
// turn lands in is decided here and nowhere else. `evaluateTutorTurn` takes
// three ports and knows nothing about Postgres; swapping the educational store
// in was this import line changing, which is the property the ports exist for.
// SOT: CLAUDE.md §The block · docs/pack/19-learning-outcomes-spec.md §3 · docs/pack/12-systems-design-prompt.md §4
// SOT-KEYWORDS: tutor evaluate api route protected operation server transcript edu educational store student model
import { NextRequest, NextResponse } from 'next/server';
import { evaluateTutorTurn } from '@acme/app/server';
import { loadEduPriorFacts, saveEduFacts, saveEduTranscript } from '@/lib/edu.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

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
    const result = await evaluateTutorTurn(
      auth,
      request.headers,
      { problem, answer, hintDepth },
      loadEduPriorFacts,
      saveEduTranscript,
      saveEduFacts,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

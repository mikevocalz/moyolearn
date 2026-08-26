// POST /api/tutor/evaluate — server-side answer check for the S9 tutor.
// SOT: CLAUDE.md §The block · docs/pack/19-learning-outcomes-spec.md §3
// SOT-KEYWORDS: tutor evaluate api route protected operation server
import { NextRequest, NextResponse } from 'next/server';
import { evaluateTutorTurn } from '@acme/app/server';
import { auth } from '@/lib/auth';

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
    typeof (body as Record<string, unknown>).answer !== 'string'
  ) {
    return NextResponse.json({ error: 'problem and answer are required' }, { status: 400 });
  }

  const { problem, answer } = body as { problem: string; answer: string };

  try {
    const result = await evaluateTutorTurn(auth, request.headers, { problem, answer });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

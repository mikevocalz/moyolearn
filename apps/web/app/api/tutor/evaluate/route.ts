// POST /api/tutor/evaluate — server-side answer check for the S9 tutor.
// SOT: CLAUDE.md §The block · docs/pack/19-learning-outcomes-spec.md §3
// SOT-KEYWORDS: tutor evaluate api route protected operation server
import { NextRequest, NextResponse } from 'next/server';
import { evaluateTutorTurn } from '@acme/app/server';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const body = await request.json() as { problem: string; answer: string };
  const result = await evaluateTutorTurn(auth, request.headers, body);
  return NextResponse.json(result);
}

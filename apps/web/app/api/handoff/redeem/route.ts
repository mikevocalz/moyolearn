// POST /api/handoff/redeem — the learner device turns a code into a session
// (doc 36 §2: "the code redemption creates the learner session — a child never
// types an email or password").
//
// Anonymous BY DESIGN, and deliberately not a protectedOperation: there is no
// session yet — the code IS the credential, exactly as a password is at
// /api/auth. Redemption burns the single-use row and then signs the learner in
// through Better Auth's own username path, whose Response (session cookie
// included) is returned as-is.
//
// Every failure is the same 404 body: malformed, expired, already-redeemed and
// never-existed are indistinguishable, so the endpoint cannot be used as an
// oracle for which codes are live. No permission copy either way — the learner
// screen says "that code didn't work, ask your grown-up for a new one".
// SOT: docs/pack/36-role-navigation-flows.md §2 §4.4 · packages/auth/src/handoff.ts
// SOT-KEYWORDS: handoff redeem api route sign-in session anonymous single-use fail closed
import { NextRequest, NextResponse } from 'next/server';
import { redeemDeviceHandoff } from '@acme/auth/server';
import { handoffStore } from '@/lib/handoff.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

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
    !('code' in body) ||
    typeof (body as Record<string, unknown>).code !== 'string'
  ) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 });
  }

  try {
    const response = await redeemDeviceHandoff(auth, { store: handoffStore }, (body as { code: string }).code);
    if (!response) {
      return NextResponse.json({ error: 'Code not recognized' }, { status: 404 });
    }
    return response;
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

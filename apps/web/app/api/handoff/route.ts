// POST /api/handoff — a guardian mints a device-handoff code for one of their
// own wards (doc 36 §2). Behind `protectedOperation`: the guardian is whoever
// the session says, and `learnerAuthId` is a resource claim the service
// re-verifies against active guardianship rows before anything is minted.
//
// The response carries the code ONCE. It is never stored in the clear and
// never logged — the row keeps a hash and a TTL, nothing else.
// SOT: docs/pack/36-role-navigation-flows.md §2 · packages/app/features/onboarding/handoff/handoff.service.ts
// SOT-KEYWORDS: handoff api route mint code guardian protected operation
import { NextRequest, NextResponse } from 'next/server';
import { issueHandoffCode } from '@acme/app/server';
import { guardianshipReader, handoffStore } from '@/lib/handoff.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// A code's 15-minute life starts now; a cached mint is a shorter life wearing a 200.
export const dynamic = 'force-dynamic';

const statusFor = (message: string): number =>
  message === 'Unauthenticated' ? 401 : message.startsWith('Only a guardian') || message.startsWith('Not an active') ? 403 : 500;

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
    !('learnerAuthId' in body) ||
    typeof (body as Record<string, unknown>).learnerAuthId !== 'string' ||
    (body as { learnerAuthId: string }).learnerAuthId.length === 0
  ) {
    return NextResponse.json({ error: 'learnerAuthId is required' }, { status: 400 });
  }

  const { learnerAuthId } = body as { learnerAuthId: string };

  try {
    const issue = await issueHandoffCode(auth, request.headers, learnerAuthId, {
      store: handoffStore,
      guardianships: guardianshipReader,
    });
    return NextResponse.json({ ok: true, ...issue });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: statusFor(message) });
  }
}

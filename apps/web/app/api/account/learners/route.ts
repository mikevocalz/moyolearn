// GET /api/account/learners — the children this account may delete.
//
// The read `family.store.ts` has been waiting for: "`setChildren` is the seam
// the real guardianship query writes through. It has no caller yet:
// `/api/family/learners` exports POST only." This is deliberately the NARROW
// version of that read — name, id, and whether a second guardian is on the
// child — because it exists to make FD-26's per-learner control honest, not to
// populate the family hub. A hub read is a different projection (avatars, grade
// bands, progress) and inventing it here would be two answers to "who are this
// guardian's children".
//
// SAME PORT AS THE DELETION. `managedLearners` and `deleteManagedLearner` both
// go through `loadAccountOwnership`, so the list a guardian is shown and the
// set the server will act on cannot disagree.
// SOT: packages/app/features/account/account-deletion.service.ts · packages/app/features/family/family.store.ts
// SOT-KEYWORDS: account learners api route guardian wards read fd-26 managed learner list protected operation
import { NextRequest, NextResponse } from 'next/server';
import { managedLearners } from '@acme/app/server';
import { loadAccountOwnership } from '@/lib/account-deletion.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const learners = await managedLearners(auth, request.headers, loadAccountOwnership);
    return NextResponse.json({ learners });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

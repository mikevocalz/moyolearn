// POST /api/account/learners/delete — one child, at their guardian's word.
//
// This is the control `consent-flow-content.tsx:82` has been promising since the
// consent screen shipped: "we keep a record of how and when — you can withdraw
// it any time from the family screen." COPPA gives the verifying parent that
// right and the screen claimed it; nothing implemented it.
//
// THE ID IS THE ONLY THING A CALLER MAY NAME, and it is not trusted.
// `planAccountDeletion` looks it up in the ward list the SESSION resolved, so a
// body naming another family's child finds no ward and gets a refusal — the
// same shape `memory.service.ts` gives `factId`, where "the worst a hostile id
// can do is name a fact belonging to somebody else and delete nothing".
//
// A LEARNER CANNOT REACH THIS. `ctx.isLearner` is refused before the ward
// lookup: a child who is themselves guardian-managed has no wards, but the
// refusal is explicit rather than incidental, because "it returns an empty list
// anyway" is an argument that stops being true the day the shape changes.
// SOT: packages/app/features/account/account-deletion.service.ts · docs/pack/06-auth-onboarding-spec.md §6
// SOT-KEYWORDS: account learner delete api route guardian withdraw consent coppa fd-26 ward protected operation
import { NextRequest, NextResponse } from 'next/server';
import { AccountDeletionRefused, deleteManagedLearner } from '@acme/app/server';
import {
  deleteAuthUser,
  eraseSubjectPayload,
  loadAccountOwnership,
} from '@/lib/account-deletion.repository';
import { eraseEduSubject } from '@/lib/edu.repository';
import { eraseSubjectMedia } from '@/lib/bunny.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

function parseLearnerAuthId(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return null;
  const id = (body as Record<string, unknown>).learnerAuthId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export async function POST(request: NextRequest) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const learnerAuthId = parseLearnerAuthId(raw);
  if (learnerAuthId === null) {
    return NextResponse.json({ error: 'learnerAuthId is required' }, { status: 400 });
  }

  try {
    const receipt = await deleteManagedLearner(auth, request.headers, learnerAuthId, {
      loadOwnership: loadAccountOwnership,
      eraseEdu: eraseEduSubject,
      erasePayload: eraseSubjectPayload,
      eraseMedia: eraseSubjectMedia,
      deleteAuthUser,
    });
    return NextResponse.json({
      mediaIncomplete: receipt.mediaIncomplete,
      heldReports: receipt.heldReports,
    });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    if (error instanceof AccountDeletionRefused) {
      return NextResponse.json({ reason: error.reason }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

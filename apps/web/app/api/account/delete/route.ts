// POST /api/account/delete — FD-26, the server half.
//
// App Review guideline 5.1.1(v): an app that lets a user create an account must
// let them initiate deleting it from inside the app, and the deletion has to
// reach the server. This is the endpoint that makes that true; the screen is
// `packages/app/features/account/delete-account-content.tsx`.
//
// IT READS NO BODY — not "it validates the body", it never calls
// `request.json`. The account is `ctx.learnerId` and the children that go with
// it are resolved from guardianship rows the session owns, so there is nothing
// a caller could legitimately say. `forget-all/route.ts` states the same
// property for the same reason, and it is more load-bearing here: a request
// that could name whose ACCOUNT to destroy is worse than one that could name
// whose memories.
//
// COUNTS AND VERDICTS, NEVER IDS. The receipt carries what was deleted and what
// was kept. Echoing the ward ids or the row ids back would be a last copy of
// the family in a response body destined for a log.
// SOT: packages/app/features/account/account-deletion.service.ts · docs/release/app-store-readiness.md §3
// SOT-KEYWORDS: account delete api route fd-26 protected operation apple 5.1.1 erasure cascade guardian ward legal hold
import { NextRequest, NextResponse } from 'next/server';
import { AccountDeletionRefused, deleteOwnAccount } from '@acme/app/server';
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

export async function POST(request: NextRequest) {
  try {
    const receipt = await deleteOwnAccount(auth, request.headers, {
      loadOwnership: loadAccountOwnership,
      eraseEdu: eraseEduSubject,
      erasePayload: eraseSubjectPayload,
      eraseMedia: eraseSubjectMedia,
      deleteAuthUser,
    });
    return NextResponse.json({
      keptWards: receipt.keptWards,
      mediaIncomplete: receipt.mediaIncomplete,
      heldReports: receipt.heldReports,
    });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    /*
      A refusal is not a failure, and it travels as its DISCRIMINANT rather than
      as a sentence: `account-deletion.copy.ts` owns the words, so no route
      authors a line a child's guardian will read.
    */
    if (error instanceof AccountDeletionRefused) {
      return NextResponse.json({ reason: error.reason }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

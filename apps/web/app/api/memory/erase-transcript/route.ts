// POST /api/memory/erase-transcript — S27's session eraser, server side.
//
// THE SECOND ROUTE THAT DID NOT EXIST. `memory.store.ts:confirmEraseTranscript`
// filtered a zustand array and stopped — the same bug as `eraseLine`, in the same
// file, left behind by the commit that fixed the first one. A guardian deleted an
// evening of their child's tutoring, watched the session and the notes derived
// from it disappear, reloaded, and read the lot again.
//
// WHAT MAKES THIS DIFFERENT FROM `/erase`: the cascade. Deleting a session is not
// deleting a row — `erasure.ts` defines erasure on PROVENANCE, so the session
// takes every belief it was the sole source of and trims itself out of the
// history of the ones it shared. The dialog that precedes this counts those
// beliefs with `cascadePreview`, and the server decides them with
// `eraseTranscript`; the same function, so the promise and the act agree.
//
// A GUARDIAN SURFACE, at the free `practise` floor, and `memory.service.ts` says
// why a lapsed card must never stand between a family and deleting a record of
// their child. No paywall, price or upgrade prompt is reachable from this
// response.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27 · packages/student-model/src/erasure.ts · packages/app/features/memory/memory.service.ts
// SOT-KEYWORDS: memory s27 erase transcript session api route protected operation guardian cascade provenance sole source edu educational store
import { NextRequest, NextResponse } from 'next/server';
import { eraseMemoryTranscript } from '@acme/app/server';
import { eraseEduTranscriptCascade } from '@/lib/edu.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// A delete is a decision about now, and its answer is never reusable — stated
// rather than assumed, exactly as the single-line eraser beside it states it.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  /*
    `transcriptId` is the ONLY thing this route accepts. Not the learner, and not
    the list of facts to delete — the cascade is computed in the repository from
    the rows the store actually holds (`eraseEduTranscriptCascade`), because a
    body that could name the facts would let a caller delete part of a model
    while leaving the session that justifies it on the guardian's screen.
  */
  if (
    typeof body !== 'object' ||
    body === null ||
    !('transcriptId' in body) ||
    typeof (body as Record<string, unknown>).transcriptId !== 'string' ||
    (body as { transcriptId: string }).transcriptId.length === 0
  ) {
    return NextResponse.json({ error: 'transcriptId is required' }, { status: 400 });
  }

  const { transcriptId } = body as { transcriptId: string };

  try {
    const result = await eraseMemoryTranscript(
      auth,
      request.headers,
      transcriptId,
      eraseEduTranscriptCascade,
    );
    /*
      200 with `erased: false` when the id matched nothing, not a 404 — same rule
      as `/api/memory/erase`. A guardian who pressed the button twice, or a client
      retrying a request that already committed, has the outcome it asked for, and
      a 404 would make the store reinstate a session that does not exist.
    */
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

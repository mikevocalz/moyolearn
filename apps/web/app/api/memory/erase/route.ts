// POST /api/memory/erase — S27's eraser, server side.
//
// THE ROUTE THAT DID NOT EXIST. `memory.store.ts` called `eraseFact` on a
// zustand array and stopped there, so a guardian erased a line, watched it
// disappear, reloaded, and read it again. Doc 07 §S27's "the eraser works" was
// true of one React tree on one device for as long as it stayed mounted.
//
// The composition root for erasure, in the same shape as the tutoring write
// path: the service knows a port, this file decides the store behind it, and
// `eraseEduFactAndBlockTag` is the one function permitted to touch `edu`
// (`tooling/check-store-separation.mjs`).
//
// A GUARDIAN SURFACE. S27 is guarded on `isGuardian` in the mobile drawer and
// its erasure controls act on one child's record. No paywall, price or upgrade
// prompt is reachable from this response, and the operation runs at the free
// `practise` floor deliberately — `memory.service.ts` says why a lapsed card
// must never stand between a family and deleting what we know about their child.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27 · packages/app/features/memory/memory.service.ts · packages/payload/migrations/edu_blocked_tags.sql
// SOT-KEYWORDS: memory s27 erase api route protected operation guardian delete blocked tag knowledge graph edu educational store
import { NextRequest, NextResponse } from 'next/server';
import { eraseMemoryLine } from '@acme/app/server';
import { eraseEduFactAndBlockTag } from '@/lib/edu.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// A delete is a decision about now, and its answer is never reusable. Stated
// rather than assumed, for the same reason the safety-status route states it.
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  /*
    `factId` is the ONLY thing this route accepts. Not the learner, not the tag,
    not the kind — every one of those comes from `ctx` or from the row that was
    actually deleted (`edu.repository.ts:eraseEduFactAndBlockTag`). A body that
    could name the learner would be a delete endpoint for other people's
    children; a body that could name the tag would be a way to suppress part of a
    model without deleting anything a guardian could see on S27.
  */
  if (
    typeof body !== 'object' ||
    body === null ||
    !('factId' in body) ||
    typeof (body as Record<string, unknown>).factId !== 'string' ||
    (body as { factId: string }).factId.length === 0
  ) {
    return NextResponse.json({ error: 'factId is required' }, { status: 400 });
  }

  const { factId } = body as { factId: string };

  try {
    const result = await eraseMemoryLine(auth, request.headers, factId, eraseEduFactAndBlockTag);
    /*
      200 WITH `erased: false` when the id matched nothing, rather than a 404.
      A guardian double-pressing the trash icon, or a client retrying a request
      that already committed, has got the outcome it asked for — the line is
      gone. Answering 404 would make `memory.store.ts` restore a row that does
      not exist, which is the one thing this screen may never do.
    */
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = message === 'Unauthenticated' ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

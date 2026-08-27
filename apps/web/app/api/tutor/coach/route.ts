// POST /api/tutor/coach — the streaming coaching turn (doc 29 §3).
//
// SSE rather than a JSON response because the demo bar is a child watching text
// arrive, and a coaching turn that lands as a single block after four seconds
// reads as a page load rather than as someone thinking. The transport is the
// only thing this file owns; every safety and pedagogy decision was made before
// the generator it is iterating was handed over.
// SOT: docs/pack/29-shipaton-plan.md §3 · docs/pack/15-native-ai-client-spec.md §1
// SOT-KEYWORDS: tutor coach api route sse stream protected operation safety plane
import { NextRequest, NextResponse } from 'next/server';
import { coachTutorTurn, type CoachEvent } from '@acme/app/server';
/*
  Two stores, named separately because they ARE separate (doc 12 §4). The model
  the coaching turn reasons over is educational data and comes from `edu`; the
  grade band is an attribute of the user's account and stays in the operational
  store. Reading both through one repository would have been the convenient lie.
*/
import { loadEduPriorFacts } from '@/lib/edu.repository';
import { loadGradeBand } from '@/lib/student-model.repository';
/*
  The guardian's own policy (doc 07 §3 layer 1) and the record of anything the
  plane stops (doc 07 §3 layer 7). A THIRD store, again named separately: safety
  events are Payload's by doc 12 §4 and are the one place a crisis may be
  written, which is exactly why they are not in `edu` beside the model.
*/
import { loadLearnerFlags } from '@/lib/learner-flags.repository';
import { recordSafetyEvent } from '@/lib/safety-event.repository';
import { auth } from '@/lib/auth';
/*
  A bare import, and the only kind that works here. `coachTutorTurn` takes no
  gateway — it reaches the shared one through `tutorTurnFor`'s defaulted
  parameter four frames down — so the durable budget ledger can only arrive by
  being installed before this handler runs. Importing the composition root IS
  that installation; there is no value to bind. Deleting this line does not break
  a type, it silently returns the §7 ceiling to a counter that dies with the
  lambda, which is why it is commented rather than terse.
*/
import '@/lib/inference';
import { reportRouteError } from '@/lib/report-error';

// The turn holds a connection open while a model generates, which a statically
// rendered route cannot do.
export const dynamic = 'force-dynamic';

function isCoachBody(
  body: unknown,
): body is { problem: string; message?: string; sessionId?: string } {
  if (typeof body !== 'object' || body === null) return false;
  const record = body as Record<string, unknown>;
  if (typeof record.problem !== 'string' || record.problem.trim().length === 0) return false;
  if (record.message !== undefined && typeof record.message !== 'string') return false;
  // A conversation handle, not an identity — see `CoachTurnInput.sessionId`. It
  // is optional because a turn can legitimately run before the session resolves.
  return record.sessionId === undefined || typeof record.sessionId === 'string';
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isCoachBody(body)) {
    return NextResponse.json({ error: 'problem is required' }, { status: 400 });
  }

  let events: AsyncGenerator<CoachEvent>;
  try {
    events = await coachTutorTurn(
      auth,
      request.headers,
      { problem: body.problem, message: body.message ?? '', sessionId: body.sessionId },
      {
        loadPriorFacts: loadEduPriorFacts,
        loadGradeBand,
        loadLearnerFlags,
        recordSafetyEvent,
      },
    );
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    // Auth and validation fail before the stream opens, so they can still be a
    // status code. Anything that goes wrong after this point is a `blocked`
    // event on an already-200 response.
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ kind: 'blocked' })}\n\n`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      // The child navigated away mid-turn. Stop the generator so the vendor
      // stream is torn down rather than billed to completion.
      void events.return(undefined as never);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      // Nginx and some proxies buffer a streamed body by default, which turns
      // sentence-by-sentence delivery back into one block at the end.
      'X-Accel-Buffering': 'no',
    },
  });
}

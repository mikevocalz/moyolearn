// POST /api/jobs/drain — one bounded pass over the live queues.
//
// THIS ROUTE IS THE WORKER. `docs/design/jobs.md` §8.2 left the choice open —
// "a separate always-on service, a container, or a scheduled invocation that
// drains a bounded batch" — and this is the third, because it is the only one
// that adds no infrastructure: it runs in the deployment that already exists, on
// the cron that already exists, against the Postgres that already exists. The
// trade is stated in `packages/jobs/src/drain.ts`: latency is bounded by the
// SCHEDULE, not by the queue. Nothing live today needs better than that.
//
// Two doors onto it, as everywhere else in this app: a POST with its own bearer
// for a human or another service, and a GET beside it carrying `CRON_SECRET` for
// Vercel. Conflating them would mean loosening one to suit the other.
// SOT: packages/jobs/src/drain.ts · apps/web/lib/jobs.ts · docs/design/jobs.md §4 §5 §8.2
// SOT-KEYWORDS: jobs drain route worker bounded batch pg-boss bearer secret dead letter shed report
import { NextRequest, NextResponse } from 'next/server';
import { drain } from '@/lib/jobs';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

/**
 * Long enough for a retention sweep to finish inside one pass.
 *
 * The sweeps run multi-statement deletes over a month of rows and are the
 * slowest thing on any queue; a drain that timed out mid-sweep would leave the
 * job `active` until `expireInSeconds` released it, which reads as a hang rather
 * than as a failure. 300 s is Vercel's ceiling for a Pro function.
 */
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  /*
    A shared secret, not a session. The drain runs work on behalf of children
    with no user present, and an open endpoint that executes queued deletions is
    not made safe by being hard to guess.
  */
  const secret = process.env.JOBS_DRAIN_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    /*
      `stopWhenDone` closes pg-boss at the end of the pass. A drain invocation is
      not a long-lived worker, and a boss left started holds its pool open until
      the lambda is recycled — which is two of the eight connections
      `payload.config.ts` budgets, held by a function that has finished.
    */
    const report = await drain({ stopWhenDone: true });

    return NextResponse.json({
      ok: true,
      // Named per queue rather than summed. "7 completed" cannot answer whether
      // distillation ran at all, which is the question a drain report exists for.
      queues: report.queues,
      shed: report.plan.triggered ? report.plan : null,
      deadLetters: report.deadLetters,
    });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Drain failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

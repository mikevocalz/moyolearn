// GET /api/health/jobs — the dead-man switch for the whole worker fleet.
//
// Doc 35 §5 spends the ONE free Sentry uptime monitor here: it polls this
// route, and the route answers 500 unless every live queue is fresh under the
// per-queue rules in `@acme/jobs`'s `QUEUE_HEALTH_RULES`. One monitor, entire
// fleet, zero error events — queue health rides an HTTP status, not quota.
//
// UNAUTHENTICATED BY DESIGN: an uptime prober cannot hold a secret worth
// having, and the body is queue names, booleans and machine-shaped reason
// strings — nothing here identifies a person or carries a payload. The
// repository never selects the `data` column, so there is nothing to leak.
//
// FAIL-CLOSED, TWICE. A live queue with no sample reads as stale (see
// `evaluateJobsHealth`), and a thrown read — Postgres unreachable, pool
// exhausted — is a 500 too: a dead-man switch that answers 200 while blind is
// the one bug this route must never have. The 500 PATH IS PROVEN IN TEST
// (`packages/jobs/src/health.test.ts`, threshold override), not by pausing a
// real queue; doc 35 §7 row 11's "pause it and watch" is the one-time UI
// verification, not the regression story.
// SOT: docs/pack/35-sentry-free-tier.md §5 §7 row 11 · packages/jobs/src/health.ts · apps/web/lib/jobs-health.repository.ts
// SOT-KEYWORDS: health jobs route dead man switch uptime monitor 500 stale fleet fresh queue
import { NextResponse } from 'next/server';
import { evaluateJobsHealth } from '@acme/jobs';
import { readQueueHealthSamples } from '@/lib/jobs-health.repository';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const samples = await readQueueHealthSamples();
    const report = evaluateJobsHealth(samples, new Date());

    return NextResponse.json(
      { ok: report.healthy, queues: report.queues },
      { status: report.healthy ? 200 : 500 },
    );
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    // No error detail in the body: an unauthenticated probe gets a verdict,
    // not a stack. The detail went to the reporter above.
    return NextResponse.json({ ok: false, queues: [] }, { status: 500 });
  }
}

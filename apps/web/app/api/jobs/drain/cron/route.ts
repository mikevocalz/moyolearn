// GET /api/jobs/drain/cron — the Vercel-Cron door onto the bounded drain.
//
// NO LONGER SCHEDULED. Doc 35 §5 / PR-135 moved the */30 tick off Vercel cron
// (it kept the deployment off the Hobby tier): the retry tick is now
// `.github/workflows/jobs-drain.yml`, which hits POST /api/jobs/drain with its
// own bearer, and pg-boss retention maintenance runs in-database on Supabase
// pg_cron (`packages/payload/migrations/jobs_pg_cron_maintenance.sql` holds
// the full split). This door stays for the day a paid Vercel tier brings the
// schedule back — same two-door arrangement as the two sweeps: Vercel Cron
// signs with `CRON_SECRET`, the drain takes `JOBS_DRAIN_SECRET`, and
// conflating them would mean loosening one to suit the other.
//
// WHAT THIS SCHEDULE IS FOR. It is not the sweeps' trigger — each sweep's own
// cron enqueues AND drains its queue inside its own window, so the daily
// guarantee never depends on this route running. This is the RETRY path: a job
// whose handler threw comes back on its queue's ladder, and something has to be
// running when it does. It is also the pass that evaluates JOB-3 dead-letter
// depth on a queue that has no work, which is exactly the queue nobody looks at.
// SOT: apps/web/app/api/jobs/drain/route.ts · apps/web/vercel.json · docs/design/jobs.md §4.2 §8.2
// SOT-KEYWORDS: jobs drain cron vercel schedule retry dead letter alert trigger
import { NextRequest, NextResponse } from 'next/server';
import { POST as drainJobs } from '../route';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const drainSecret = process.env.JOBS_DRAIN_SECRET;
  if (!drainSecret) {
    // Loudly, not silently: a cron that returns 200 having drained nothing is a
    // retry path that looks alive on every dashboard and is not.
    return NextResponse.json({ ok: false, error: 'JOBS_DRAIN_SECRET is not set' }, { status: 500 });
  }

  // Delegated rather than duplicated — one drain implementation, called by both
  // doors, so the scheduled path can never drift from the manual one.
  return drainJobs(
    new NextRequest(new URL('/api/jobs/drain', request.url), {
      method: 'POST',
      headers: { authorization: `Bearer ${drainSecret}` },
    }),
  );
}

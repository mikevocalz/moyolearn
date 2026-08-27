// GET /api/retention/sweep/cron — the scheduled trigger for the transcript
// retention sweep.
//
// Separate from the sweep itself for the same reason the media pair is: the two
// are authenticated differently, and conflating them means loosening one to suit
// the other. Vercel Cron issues a GET carrying `CRON_SECRET`; the sweep takes a
// POST with `RETENTION_SWEEP_SECRET`, which is what a human or another service
// would use. Two doors, each with its own key, onto one room.
//
// 04:00 daily, an hour after the media sweep. Staggered rather than stacked:
// both sweeps run long multi-statement deletes against the same Postgres pool,
// and a day's granularity is right for a thirty-day window either way.
//
// IT GOES THROUGH THE QUEUE NOW, AND STILL RUNS IN THIS WINDOW. The cron
// enqueues `retention.sweep.transcripts` and then drains that one queue in the
// same request, so the daily guarantee is unchanged — the work still happens
// when the schedule fires, in the invocation the schedule woke. What the queue
// adds is the three things a bare cron cannot have: a `singletonKey` on the UTC
// day, so a Vercel retry or a hand-triggered run cannot start a second sweep on
// top of the first; a retry ladder, so a sweep that fails at 04:00 comes back
// minutes later on the general drain instead of being lost until 04:00 tomorrow
// — a twenty-four-hour hole in a published window on a child's data; and a dead
// letter with an alert when the ladder runs out.
//
// `docs/design/jobs.md` §5 rules the sweeps NOT SHED at any backlog, so the
// drain below can never decline to run this one.
// SOT: apps/web/app/api/retention/sweep/route.ts · apps/web/lib/jobs.ts · docs/design/jobs.md §2.1 §3 §5
// SOT-KEYWORDS: retention sweep cron vercel schedule transcript erasure trigger queue enqueue drain singleton key
import { NextRequest, NextResponse } from 'next/server';
import { drain, enqueueSweep } from '@/lib/jobs';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

/** The sweep deletes a month of rows across two stores; it is not a fast request. */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sweepSecret = process.env.RETENTION_SWEEP_SECRET;
  if (!sweepSecret) {
    // Loudly, not silently: a cron that returns 200 having done nothing is a
    // retention promise that looks kept on every dashboard and is not.
    return NextResponse.json(
      { ok: false, error: 'RETENTION_SWEEP_SECRET is not set' },
      { status: 500 },
    );
  }

  try {
    /*
      A `null` id means the day's sweep is already queued or active. That is the
      singleton key working, so the drain still runs — it is what picks the
      existing job up. Returning early on `null` would turn a duplicate trigger
      into a skipped sweep.
    */
    const jobId = await enqueueSweep('retention.sweep.transcripts');
    const report = await drain({ only: ['retention.sweep.transcripts'], stopWhenDone: true });

    return NextResponse.json({ ok: true, jobId, queues: report.queues });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Sweep failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

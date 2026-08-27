// GET /api/media/sweep/cron — the scheduled trigger for the retention sweep.
//
// Separate from the sweep itself because the two are authenticated differently
// and conflating them would mean loosening one to suit the other. Vercel Cron
// issues a GET carrying its own bearer (`CRON_SECRET`); the sweep takes a POST
// with `MEDIA_SWEEP_SECRET`, which is what a human or another service would use.
// Two doors, each with its own key, onto one room.
//
// 03:00 daily. A day's granularity is right for a seven-day window — sweeping
// hourly would delete a file up to 23 hours earlier than a child's "a week"
// means, and nothing here needs that precision.
//
// IT GOES THROUGH THE QUEUE NOW, AND STILL RUNS IN THIS WINDOW — identical
// reasoning to the transcript sweep beside it (`app/api/retention/sweep/cron/route.ts`
// carries the long version). The queue adds a `singletonKey` on the UTC day, a
// retry ladder, and a dead letter with an alert; it does not move when the sweep
// happens. `docs/design/jobs.md` §5 rules both sweeps NOT SHED at any backlog.
// SOT: apps/web/app/api/media/sweep/route.ts · apps/web/lib/jobs.ts · docs/design/jobs.md §2.1 §3 §5
// SOT-KEYWORDS: media sweep cron vercel schedule retention trigger queue enqueue drain singleton key
import { NextRequest, NextResponse } from 'next/server';
import { drain, enqueueSweep } from '@/lib/jobs';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

/** The sweep lists an entire storage zone and the Stream library; it is not fast. */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  /*
    Vercel signs cron invocations with CRON_SECRET. Without this check the URL
    is a public delete trigger — findable, repeatable, and pointed at a
    children's product's media.
  */
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sweepSecret = process.env.MEDIA_SWEEP_SECRET;
  if (!sweepSecret) {
    // Loudly, not silently: a cron that returns 200 having done nothing is a
    // retention promise that looks kept on every dashboard and is not.
    return NextResponse.json({ ok: false, error: 'MEDIA_SWEEP_SECRET is not set' }, { status: 500 });
  }

  try {
    /*
      A `null` id means the day's sweep is already queued or active. That is the
      singleton key working, so the drain still runs — it is what picks the
      existing job up. Returning early on `null` would turn a duplicate trigger
      into a skipped sweep.
    */
    const jobId = await enqueueSweep('retention.sweep.media');
    const report = await drain({ only: ['retention.sweep.media'], stopWhenDone: true });

    return NextResponse.json({ ok: true, jobId, queues: report.queues });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Sweep failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

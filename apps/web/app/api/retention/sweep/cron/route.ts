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
// SOT: apps/web/app/api/retention/sweep/route.ts
// SOT-KEYWORDS: retention sweep cron vercel schedule transcript erasure trigger
import { NextRequest, NextResponse } from 'next/server';
import { POST as sweep } from '../route';

export const dynamic = 'force-dynamic';

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

  // Delegated rather than duplicated — one sweep implementation, called by both
  // doors, so the scheduled path can never drift from the manual one.
  return sweep(
    new NextRequest(new URL('/api/retention/sweep', request.url), {
      method: 'POST',
      headers: { authorization: `Bearer ${sweepSecret}` },
    }),
  );
}

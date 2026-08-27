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
// SOT: apps/web/app/api/media/sweep/route.ts
// SOT-KEYWORDS: media sweep cron vercel schedule retention trigger
import { NextRequest, NextResponse } from 'next/server';
import { POST as sweep } from '../route';

export const dynamic = 'force-dynamic';

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

  // Delegated rather than duplicated — one sweep implementation, called by both
  // doors, so the scheduled path can never drift from the manual one.
  return sweep(
    new NextRequest(new URL('/api/media/sweep', request.url), {
      method: 'POST',
      headers: { authorization: `Bearer ${sweepSecret}` },
    }),
  );
}

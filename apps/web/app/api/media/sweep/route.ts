// POST /api/media/sweep — delete uploaded media past its retention window.
//
// The AUTHORITATIVE sweep. The device drains its own upload queue, but a phone
// that is never opened again would keep a child's photograph indefinitely, so
// the deletion promise cannot depend on a client running.
//
// It works by AGE off the bucket listing rather than from a database record.
// A sweep that only deletes what the app remembers uploading misses whatever it
// forgot — a crash between PUT and insert, a dropped row, a file from an older
// build — and those orphans are exactly the ones nobody will ever notice.
//
// TWO PRODUCTS, one window. Photographs and voice notes are objects in a Bunny
// Storage zone; VIDEO goes to Bunny Stream, which is a separate API on a
// separate host with a separate credential and does not appear in the storage
// listing at all. This route swept the zone only, so `MEDIA_TTL_DAYS` was a
// promise kept for a child's photograph and not for the same child's video —
// the videos `bunny-stream-sign.ts:createVideo` makes had no deletion path of
// any kind. `sweepStreamVideos` is that path, and it is called here rather than
// scheduled separately so the two halves cannot drift into different windows or
// different cron failures.
// SOT: packages/app/features/media/retention.ts · docs/pack/07-security-child-ai-safety-spec.md §4 · apps/web/lib/bunny-stream.repository.ts
// SOT-KEYWORDS: media sweep retention delete cron bunny stream video expiry orphan children data
import { NextRequest, NextResponse } from 'next/server';
import { MEDIA_TTL_DAYS } from '@acme/app/features/media/retention.ts';
import { listRecursive } from '@/lib/bunny-list';
import { deleteObjects } from '@/lib/bunny-delete';
import { sweepStreamVideos } from '@/lib/bunny-stream.repository';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

/*
  The same three names `bunny.repository` reads, and derived the same way — the
  host comes from the REGION rather than being its own variable, because the
  storage endpoint is `<region>.storage.bunnycdn.com` and a second source for
  the same fact is a second thing to get wrong.

  I first wrote BUNNY_STORAGE_HOST/ZONE/PASSWORD from memory. None of them
  exist; the sweep resolved `undefined` as a hostname and failed at DNS.
*/
function zone() {
  const name = process.env.BUNNY_STORAGE_ZONE_NAME;
  const password = process.env.BUNNY_STORAGE_ACCESS_KEY;
  const region = process.env.BUNNY_STORAGE_REGION ?? 'ny';
  if (!name || !password) throw new Error('Bunny storage is not configured — see .env.example.');
  return { host: `${region}.storage.bunnycdn.com`, zone: name, password };
}

export async function POST(request: NextRequest) {
  /*
    A shared secret, not a session. This runs from a scheduler with no user, and
    the alternative — leaving it open because "only cron knows the URL" — is an
    unauthenticated delete endpoint for a children's product.
  */
  const secret = process.env.MEDIA_SWEEP_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prefix = process.env.BUNNY_MEDIA_PREFIX ?? 'moyolearn';
  const cutoff = Date.now() - MEDIA_TTL_DAYS * 86_400_000;

  try {
    const objects = await listRecursive(zone(), prefix);
    const expired = objects
      .filter((object) => {
        const changed = Date.parse(object.lastChanged);
        // An unparseable timestamp is left ALONE. Deleting on a date we could
        // not read would be guessing with a child's data.
        return !Number.isNaN(changed) && changed <= cutoff;
      })
      .map((object) => object.path);

    const { deleted, failed } = await deleteObjects(zone(), expired);

    /*
      AFTER the storage half, and inside the same try. Sequential rather than
      concurrent so a Stream outage cannot take the object deletions down with
      it — those have already happened by the time this runs, and a 500 from
      here is a retry of the video half over an already-clean zone rather than
      an abandoned sweep.
    */
    const video = await sweepStreamVideos();

    return NextResponse.json({
      ok: true,
      scanned: objects.length,
      expired: expired.length,
      deleted: deleted.length,
      // Named, not just counted: a sweep that quietly fails on the same file
      // every night is how a retention promise rots.
      failed,
      // Reported under its own names rather than summed in. "9 deleted" cannot
      // answer whether the video half ran at all, which is the question this
      // route was silently answering "no" to before it existed.
      videoScanned: video.scanned,
      videoExpired: video.expired,
      videoDeleted: video.deleted.length,
      videoFailed: video.failed,
    });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Sweep failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// POST /api/media/presign — mint a short-lived credential for ONE object.
//
// This is the only authenticated step in an upload. Everything after it happens
// between the client and Bunny, which is the point: the bytes never pass through
// here, so a 200MB video is not a serverless timeout.
// SOT: docs/decisions/bunny-storage-presign-spike.md · CLAUDE.md §The block
// SOT-KEYWORDS: media presign api route upload bunny protected operation
import { NextRequest, NextResponse } from 'next/server';
import { presignUpload, PresignRejected, protectedOperation, type MediaKind } from '@acme/app/server';
import { signUpload } from '@/lib/bunny.repository';
import { auth } from '@/lib/auth';

const KINDS: readonly MediaKind[] = ['image', 'audio', 'document'];

export async function POST(request: NextRequest) {
  try {
    /*
      DELIBERATELY AT THE `practise` FLOOR, stated rather than inherited.

      This is the learner's path: `features/media/queued-uploader.ts` drains a
      child's homework photos and voice answers through here. CLAUDE.md forbids a
      paywall on a learner surface, and a capability check that can refuse would
      be one — the child would lose the picture of the problem they are stuck on
      because an adult's card expired.

      The editor's media routes (`voice-note`, `video`) DO require `write`; they
      are tutor authoring, not a child answering. Left implicit, this route would
      have read as an oversight next to those two.
    */
    const result = await protectedOperation(auth, request.headers, async (ctx) => {
      const body = (await request.json()) as Partial<{
        filename: string;
        contentType: string;
        size: number;
        kind: string;
      }>;
      const kind = KINDS.find((k) => k === body.kind);
      if (!kind) {
        return { ok: false as const, error: 'Unknown media kind.' };
      }
      try {
        /*
          Note what is NOT taken from the body: the object key. It is built from
          `ctx` inside the service, so a caller cannot choose where their bytes
          land — the same rule that keeps `orgId` off every other request here.
        */
        return {
          ok: true as const,
          ...presignUpload(
            ctx,
            {
              filename: body.filename ?? 'file',
              contentType: body.contentType ?? '',
              size: Number(body.size ?? 0),
              kind,
            },
            signUpload,
          ),
        };
      } catch (error) {
        // A rejection is a sentence the user can act on, not a stack trace.
        if (error instanceof PresignRejected) {
          return { ok: false as const, error: error.message };
        }
        throw error;
      }
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}

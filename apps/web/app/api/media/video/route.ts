// POST /api/media/video — create the Stream video row and sign its TUS upload.
//
// Unlike Storage, the record exists before any bytes move: TUS signs against a
// videoId, so Bunny has to be told about the video first. That is also why
// progress can be attributed to a real row from the first chunk.
// SOT: packages/app/features/media/stream.service.ts
// SOT-KEYWORDS: video api route tus stream bunny presign protected operation
import { NextRequest, NextResponse } from 'next/server';
import { presignStreamUpload, StreamRejected, protectedOperation } from '@acme/app/server';
import { createStreamVideo, signStreamUpload } from '@/lib/bunny-stream.repository';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const result = await protectedOperation(auth, request.headers, async (ctx) => {
      const body = (await request.json()) as Partial<{ title: string }>;
      try {
        return {
          ok: true as const,
          ...(await presignStreamUpload(ctx, body.title ?? '', createStreamVideo, signStreamUpload)),
        };
      } catch (error) {
        if (error instanceof StreamRejected) {
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

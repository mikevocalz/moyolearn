// POST /api/media/voice-note — mint BOTH credentials a voice note needs.
//
// One call, not two, because the audio and its waveform must share a folder and
// two independent presigns would land in two. The only way to make separate
// calls agree would be to let the client name the second key, which is exactly
// what the presign rules refuse to allow.
// SOT: packages/app/features/editor/upload.ts · docs/decisions/bunny-storage-presign-spike.md
// SOT-KEYWORDS: voice note presign api route audio waveform upload bunny
import { NextRequest, NextResponse } from 'next/server';
import { presignVoiceNote, PresignRejected, protectedOperation } from '@acme/app/server';
import { signUpload } from '@/lib/bunny.repository';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const result = await protectedOperation(auth, request.headers, async (ctx) => {
      const body = (await request.json()) as Partial<{
        contentType: string;
        size: number;
        audioExtension: string;
      }>;
      try {
        return {
          ok: true as const,
          ...presignVoiceNote(
            ctx,
            {
              contentType: body.contentType ?? '',
              size: Number(body.size ?? 0),
              audioExtension: body.audioExtension ?? 'm4a',
            },
            signUpload,
          ),
        };
      } catch (error) {
        if (error instanceof PresignRejected) {
          return { ok: false as const, error: error.message };
        }
        throw error;
      }
    },
    /*
      `write`, not the `practise` floor every route inherits by default.

      Its only callers are the notes editor — `features/schedule/NotesEditor.tsx`
      through `features/editor/capabilities.ts` — so this is a tutor authoring a
      note about a session: business content creation, not a child answering
      homework.

      The learner's own voice notes do NOT come through here. They go through
      `/api/media/presign` from `features/media/queued-uploader.ts`, which stays
      at the floor deliberately: a child's homework capture must never depend on
      what an adult is paying.
    */
    { requires: 'write' });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}

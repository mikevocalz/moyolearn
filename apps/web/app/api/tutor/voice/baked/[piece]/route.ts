// GET /api/tutor/voice/baked/[piece] — a baked set piece's signed audio URL
// (doc 32 §3 Path B).
//
// Answers `{ url }` with a signed, TTL'd CDN read, or 204 for text-only. The
// serving rule is `@acme/voice`'s `bakedServePlan` behind the resolver port:
// cached pieces serve; a missing ordinary piece renders ONCE and is cached; a
// missing S4 script is 204 — a crisis moment never waits on a TTS API call,
// and the fixed words are already on screen from the coach stream.
// SOT: docs/pack/32-tutor-voice-tone.md §3 · apps/web/lib/voice-baked.ts
// SOT-KEYWORDS: tutor voice baked api route signed url set piece s4 cache or nothing 204
import { NextRequest, NextResponse } from 'next/server';
import { bakedTutorVoice, type BakedClipResult } from '@acme/app/server';
import { resolveBakedClip } from '@/lib/voice-baked';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ piece: string }> },
) {
  const { piece } = await params;

  let clip: BakedClipResult;
  try {
    clip = await bakedTutorVoice(auth, request.headers, piece, { resolveBakedClip });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return new Response(null, { status: 204 });
  }

  if (clip.kind === 'text-only') return new Response(null, { status: 204 });

  // The URL is already signed with its own one-hour expiry; the response
  // itself must not be cached past it by an intermediary.
  return NextResponse.json(
    { url: clip.url, alignmentUrl: clip.alignmentUrl, alignment: clip.alignment },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}

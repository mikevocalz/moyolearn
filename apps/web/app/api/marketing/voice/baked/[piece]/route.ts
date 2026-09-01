// GET /api/marketing/voice/baked/[piece] — anonymous marketing demo set pieces.
//
// Returns a signed, TTL'd CDN read for the approved public marketing clips.
// These pieces are non-crisis and non-learner, so the worst failure is text-only.
// SOT: docs/pack/32-tutor-voice-tone.md §3 · apps/web/lib/voice-baked.ts
// SOT-KEYWORDS: marketing voice baked api route signed url demo
import { NextRequest, NextResponse } from 'next/server';
import { resolveBakedClip } from '@/lib/voice-baked';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

const MARKETING_ORIGIN = process.env.MARKETING_ORIGIN ?? '*';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': MARKETING_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders() });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ piece: string }> },
) {
  const { piece } = await params;

  try {
    const clip = await resolveBakedClip(piece);
    if (clip.kind === 'text-only') return new Response(null, { status: 204, headers: corsHeaders() });
    return NextResponse.json(
      { url: clip.url, alignmentUrl: clip.alignmentUrl },
      { headers: { ...corsHeaders(), 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
}

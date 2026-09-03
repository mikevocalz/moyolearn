// POST /api/tutor/voice — Flash playback for one server-emitted sentence
// (doc 32 §3 Path A).
//
// A SEPARATE route rather than an audio frame in the coach SSE stream, on
// purpose: the `CoachEvent` union is load-bearing (`check-fail-closed.mjs`),
// and the full argument lives with the tag scheme in
// `lib/voice-utterance.ts`. The client hands back a (text, previousText,
// tone, tag) quad it received beside a chunk frame; the service renders audio
// only if the tag verifies, so the only text that can reach ElevenLabs here
// is a sentence the Safety Plane already passed on this server.
//
// The status codes ARE the contract:
//   200 audio/mpeg stream — play it;
//   200 application/json — a PERFORMANCE (ADR-112): `{ audio: base64,
//         audioContentType, face: { fps, names, frames } }`, the audio and the
//         Audio2Face frames computed from it, so the client schedules both on
//         one clock. Only when a face host is configured;
//   204 — text-only. Budget spent, voice unconfigured, vendor down: all the
//         same silence, because a child keeps reading either way and none of
//         those states is theirs to see (doc 32 §2, CLAUDE.md §Children's
//         surfaces);
//   403 — the payload did not verify. No legitimate client produces this.
// SOT: docs/pack/32-tutor-voice-tone.md §2 §3 · apps/web/lib/voice-utterance.ts
// SOT-KEYWORDS: tutor voice api route flash stream tag verify 204 text only silent degradation
import { NextRequest, NextResponse } from 'next/server';
import { speakTutorSentence, type VoiceTurnOutcome } from '@acme/app/server';
import { loadGradeBand } from '@/lib/student-model.repository';
import { verifyUtteranceTag } from '@/lib/voice-utterance';
// The composition root: installs the durable voice ledger (module-scope
// effect, same idiom as the coach route's bare `import '@/lib/inference'`)
// and exports the egress as the port the service accepts.
import { speakSentenceViaEgress } from '@/lib/voice';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

function isVoiceBody(
  body: unknown,
): body is { text: string; previousText?: string; tone: string; tag: string } {
  if (typeof body !== 'object' || body === null) return false;
  const record = body as Record<string, unknown>;
  if (typeof record.text !== 'string' || record.text.length === 0) return false;
  if (record.previousText !== undefined && typeof record.previousText !== 'string') return false;
  return typeof record.tone === 'string' && typeof record.tag === 'string';
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!isVoiceBody(body)) {
    return NextResponse.json({ error: 'text, tone and tag are required' }, { status: 400 });
  }

  let outcome: VoiceTurnOutcome;
  try {
    outcome = await speakTutorSentence(
      auth,
      request.headers,
      { text: body.text, previousText: body.previousText, tone: body.tone, tag: body.tag },
      {
        verifyUtterance: verifyUtteranceTag,
        loadGradeBand,
        speak: speakSentenceViaEgress,
      },
    );
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    if (message === 'Unauthenticated') {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    // A server fault behind the voice route is still just a missing garnish.
    return new Response(null, { status: 204 });
  }

  if (outcome.kind === 'refused') {
    return NextResponse.json({ error: 'utterance is not server-emitted' }, { status: 403 });
  }
  if (outcome.kind === 'text-only') {
    return new Response(null, { status: 204 });
  }
  if (outcome.kind === 'performance') {
    return NextResponse.json(
      {
        audio: Buffer.from(outcome.audio).toString('base64'),
        audioContentType: outcome.contentType,
        face: { fps: outcome.face.fps, names: outcome.face.names, frames: outcome.face.frames },
      },
      { headers: { 'Cache-Control': 'private, max-age=300' } },
    );
  }

  return new Response(outcome.stream, {
    headers: {
      'Content-Type': outcome.contentType,
      // Private: it is one child's tutoring audio. Short-lived: a replayed
      // sentence within a session should not re-bill, but nothing should
      // outlive the conversation it belongs to.
      'Cache-Control': 'private, max-age=300',
    },
  });
}

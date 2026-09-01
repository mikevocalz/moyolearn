// The voice turn — chat playback for a sentence the server already spoke
// (doc 32 §3 Path A) and the baked set pieces (Path B), behind the Block.
//
// WHY A SEPARATE ROUTE AND NOT AN AUDIO FRAME IN THE COACH STREAM. The
// `CoachEvent` union is load-bearing: `check-fail-closed.mjs` pins its
// terminal frames and every exhaustive consumer switches on it, so growing it
// an `audio` kind would put vendor mp3 framing inside the safety transport and
// touch every consumer at once. Instead the coach route rides a MAC beside
// each chunk (`apps/web/lib/voice-utterance.ts` owns the scheme and the full
// argument), and this service renders audio only for a (text, previousText,
// tone) triple that verifies — which is what makes "nothing learner-authored
// reaches the TTS payload" STRUCTURAL: the session's stored turns are
// client-appendable and are deliberately not the trust anchor.
//
// This package never imports `@acme/voice` — the egress arrives as the
// `SpeakSentence`/`ResolveBakedClip` ports, injected by the route, exactly as
// the coach service takes its stores. `tooling/check-voice-egress.mjs` fails
// the build the day a feature imports the egress directly.
//
// Every degraded outcome is `text-only` and the route answers it 204: no
// error surface, no substitute voice, the child keeps the words (doc 32 §2).
// `refused` exists for a payload that does not verify — a state no legitimate
// client produces — and is the one arm that is not a degradation.
// SOT: docs/pack/32-tutor-voice-tone.md §2 §3 · apps/web/lib/voice-utterance.ts · CLAUDE.md §The block
// SOT-KEYWORDS: voice service speak sentence verify utterance tag baked piece ports protected operation text only refused
import 'server-only';
import type { Auth } from '@acme/auth/server';
import type { VoiceBand } from '@acme/student-model';
import type { BakedAlignment } from '@acme/voice';
import { protectedOperation, type ProtectedCtx } from '../../core/protected-operation.ts';
import type { LoadGradeBand } from './coach.service.ts';

/** The wire triple a chunk frame carried, back from the client verbatim. */
export interface SpokenSentenceInput {
  text: string;
  previousText?: string;
  tone: string;
  tag: string;
}

/**
 * The MAC check, as a port: the secret and the scheme live in
 * `apps/web/lib/voice-utterance.ts`, beside the route that mints.
 */
export type VerifyUtterance = (
  utterance: { text: string; previousText: string | null; tone: string },
  tag: string,
) => boolean;

/** What the live egress hands back through its port. */
export type SpeakResult =
  | { kind: 'audio'; contentType: string; stream: ReadableStream<Uint8Array> }
  | { kind: 'text-only' };

/**
 * The live render path. `learnerId` is the BUDGET key, read from `ctx` at this
 * boundary per CLAUDE.md — never from the request.
 */
export type SpeakSentence = (input: {
  learnerId: string;
  band: VoiceBand;
  tone: string;
  text: string;
  previousText?: string;
  signal?: AbortSignal;
}) => Promise<SpeakResult>;

export type BakedClipResult =
  | { kind: 'url'; url: string; alignmentUrl?: string; alignment?: BakedAlignment }
  | { kind: 'text-only' };

/**
 * The baked path: cache-or-render-once for ordinary pieces, cache-or-nothing
 * for the S4 scripts. The rule itself is `@acme/voice`'s `bakedServePlan`;
 * this port is only where its answer comes back through.
 */
export type ResolveBakedClip = (pieceId: string) => Promise<BakedClipResult>;

export interface VoicePorts {
  verifyUtterance: VerifyUtterance;
  loadGradeBand: LoadGradeBand;
  speak: SpeakSentence;
}

export type VoiceTurnOutcome = SpeakResult | { kind: 'refused' };

export async function speakTutorSentence(
  auth: Auth,
  headers: Headers,
  input: SpokenSentenceInput,
  ports: VoicePorts,
): Promise<VoiceTurnOutcome> {
  return protectedOperation(auth, headers, async (ctx) => voiceOutcome(input, ctx, ports));
}

/**
 * Exported, like `coachStream`, so the regression suite can drive the real
 * boundary with fake ports; identity is still never an input on the live path,
 * because the only caller that reaches a child is `speakTutorSentence` and
 * `ctx` there comes from `protectedOperation`.
 */
export async function voiceOutcome(
  input: SpokenSentenceInput,
  ctx: ProtectedCtx,
  ports: VoicePorts,
): Promise<VoiceTurnOutcome> {
  const verified = ports.verifyUtterance(
    { text: input.text, previousText: input.previousText ?? null, tone: input.tone },
    input.tag,
  );
  // Not a degradation: an unverifiable triple was never emitted by the server,
  // and rendering it would hand the TTS payload to whoever composed it.
  if (!verified) return { kind: 'refused' };

  try {
    // The band is server-resolved for the same reason the coach's is (doc 07
    // §3 layer 1) — here it also picks the band modulation and the voice
    // budget, neither of which a client may choose.
    const band = await ports.loadGradeBand(ctx);
    return await ports.speak({
      learnerId: ctx.learnerId,
      band,
      tone: input.tone,
      text: input.text,
      previousText: input.previousText,
    });
  } catch {
    // Voice is a garnish on words the child already has. ANY failure past
    // verification — a band read, the egress throwing on a closed-palette
    // violation, a socket — is silence, never an error surface (doc 32 §2).
    return { kind: 'text-only' };
  }
}

export interface BakedVoicePorts {
  resolveBakedClip: ResolveBakedClip;
}

/**
 * The baked set pieces, learner-authenticated like everything a learner
 * surface fetches. The piece id is a public enumeration, not a secret — the
 * gate is the session, and the asset URL that comes back is signed and TTL'd.
 */
export async function bakedTutorVoice(
  auth: Auth,
  headers: Headers,
  pieceId: string,
  ports: BakedVoicePorts,
): Promise<BakedClipResult> {
  return protectedOperation(auth, headers, async () => ports.resolveBakedClip(pieceId));
}

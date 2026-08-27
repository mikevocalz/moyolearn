// The voice egress — the sole path to ElevenLabs, and the only file in the
// repository that reads ELEVENLABS_API_KEY (doc 32; same posture as
// `packages/inference` is for Anthropic, enforced by
// `tooling/check-voice-egress.mjs`).
//
// WHAT MAY REACH THIS FILE'S PAYLOAD, structurally: Natalie's own output —
// already screened sentence-by-sentence by the Safety Plane and verified by
// the route as server-emitted (`apps/web/lib/voice-utterance.ts`) — and the
// frozen baked scripts in `baked.ts`. Nothing learner-authored has an import
// path here, and the egress check keeps `features/` and the learner-message
// modules from ever acquiring one.
//
// EVERY failure is text-only, never an error. Doc 32 §2 hard rule 1: degraded
// mode is text-only, not a substitute voice and not an error surface — to a
// six-year-old a different voice is a different person, and an error screen is
// worse than silence beside words they can still read. The single exception is
// an unknown tone, which THROWS (`UnknownTone`): the palette is closed, a
// caller holding a tenth tone is a bug, and a bug is not a degradation.
// SOT: docs/pack/32-tutor-voice-tone.md §2 §3 §5 · tooling/check-voice-egress.mjs
// SOT-KEYWORDS: voice egress elevenlabs flash stream previous text stitching baked v3 audio tags api key sole text only degradation budget debit
import 'server-only';
import type { VoiceBand } from '@acme/student-model';
import { BAKED_PIECES, type BakedPieceId } from './baked.ts';
import {
  estimatedUsdFor,
  sharedVoiceBudgetLedger,
  voiceBudgetStateFor,
  voiceDayKey,
  type VoiceBudgetLedger,
} from './budget.ts';
import { voiceRegistry, type VoiceRegistry } from './registry.ts';
import { TONE_PALETTE, assertTone, voiceSettingsFor } from './tones.ts';

const API_BASE = 'https://api.elevenlabs.io';

/**
 * The stream endpoint's output format. 64kbps mp3 is the budget-conscious
 * choice for speech over a chat surface; the baked path below uses 128 because
 * those clips render once and play forever.
 */
const LIVE_OUTPUT_FORMAT = 'mp3_44100_64';
const BAKED_OUTPUT_FORMAT = 'mp3_44100_128';

/**
 * What speaking a sentence resolves to. The degraded arm carries a reason for
 * the server's own logs and nothing a child-facing surface would render — the
 * client's contract is simply "no audio came; the text is already there".
 */
export type SpokenSentence =
  | { readonly kind: 'audio'; readonly contentType: string; readonly stream: ReadableStream<Uint8Array> }
  | {
      readonly kind: 'text-only';
      readonly reason: 'no-voice-configured' | 'voice-budget-spent' | 'voice-unavailable';
    };

export type BakedClip =
  | { readonly kind: 'audio'; readonly contentType: string; readonly bytes: Uint8Array }
  | { readonly kind: 'text-only' };

export interface SpeakSentenceInput {
  /**
   * The BUDGET key and nothing else, read from `ProtectedCtx` at the service
   * boundary per CLAUDE.md. It is not part of the TTS payload and there is no
   * field it could travel to the provider in.
   */
  readonly learnerId: string;
  readonly band: VoiceBand;
  /** A palette key. Anything else refuses — the palette is closed. */
  readonly tone: string;
  /** A plane-passed, route-verified sentence window of Natalie's output. */
  readonly text: string;
  /**
   * The previous window of the same turn, for ElevenLabs' `previous_text`
   * prosody stitching (doc 32 §3: so delivery doesn't reset at the doc 07
   * sentence boundary). Verified together with `text` — it is part of the
   * payload and gets no lighter a rule.
   */
  readonly previousText?: string;
  readonly signal?: AbortSignal;
}

export interface VoiceEgress {
  speakSentence(input: SpeakSentenceInput): Promise<SpokenSentence>;
  /**
   * Renders one baked set piece with Eleven v3 — the bake job's call, made at
   * deploy or on first use for non-crisis pieces. It is NOT on any live turn
   * and takes no learner id: a baked render is an operations cost, not a
   * child's spend.
   */
  renderBakedClip(id: BakedPieceId): Promise<BakedClip>;
}

/** Injectable for tests; production uses global fetch. */
export type VoiceTransport = (url: string, init: RequestInit) => Promise<Response>;

export interface VoiceEgressOptions {
  readonly transport?: VoiceTransport;
  readonly registry?: VoiceRegistry | null;
  readonly ledger?: VoiceBudgetLedger;
  /** Injected for tests; production reads the wall clock. */
  readonly now?: () => Date;
}

/** The API key, read here and nowhere else, and never logged. */
const apiKey = (): string | null => process.env.ELEVENLABS_API_KEY ?? null;

export function createVoiceEgress(options: VoiceEgressOptions = {}): VoiceEgress {
  const transport: VoiceTransport = options.transport ?? ((url, init) => fetch(url, init));
  const ledger = options.ledger ?? sharedVoiceBudgetLedger();
  const now = options.now ?? (() => new Date());
  // `?? voiceRegistry()` would defeat a test passing `registry: null`, and a
  // null registry is a real state (no voice asset configured -> text-only).
  const registry = 'registry' in options ? (options.registry ?? null) : voiceRegistry();

  return {
    async speakSentence(input) {
      // The refusal, before any I/O: a tone outside the closed palette is a
      // bug in the caller, not a degradation to soften.
      const tone = assertTone(input.tone);

      const key = apiKey();
      if (registry === null || key === null) return { kind: 'text-only', reason: 'no-voice-configured' };

      // Pre-call, like the inference gateway: a learner past the voice ceiling
      // gets no provider call at all. Silent by design — the shed order is
      // "voice degrades to text before tutoring degrades at all", and the
      // child keeps the words either way.
      const day = voiceDayKey(now());
      const state = voiceBudgetStateFor(await ledger.read(input.learnerId, day), input.band);
      if (state.kind === 'spent') return { kind: 'text-only', reason: 'voice-budget-spent' };

      let response: Response;
      try {
        response = await transport(
          `${API_BASE}/v1/text-to-speech/${registry.voiceId}/stream?output_format=${LIVE_OUTPUT_FORMAT}`,
          {
            method: 'POST',
            headers: { 'xi-api-key': key, 'content-type': 'application/json' },
            body: JSON.stringify({
              text: input.text,
              model_id: registry.liveModelId,
              // Flash carries emotion through the text itself (the tone's live
              // recipe is settings + the writing); tags would be spoken aloud.
              voice_settings: voiceSettingsFor(tone, input.band),
              ...(input.previousText !== undefined && input.previousText.length > 0
                ? { previous_text: input.previousText }
                : {}),
            }),
            signal: input.signal ?? null,
          },
        );
      } catch {
        return { kind: 'text-only', reason: 'voice-unavailable' };
      }

      if (!response.ok || response.body === null) {
        /*
          The body is CANCELLED, not just dropped. Under undici an unconsumed
          body keeps its socket checked out of the pool until GC, and this
          branch is the high-volume one: a 429 or 5xx during a provider outage
          means every sentence of every turn for every learner opens a
          connection nobody drains, so the leak is worst exactly when the
          provider is already struggling. `void` because a cancel that fails
          has nothing to add to a request that already failed.
        */
        void response.body?.cancel().catch(() => undefined);
        return { kind: 'text-only', reason: 'voice-unavailable' };
      }

      /*
        Debited at dispatch, characters known up front — the provider bills the
        request whether or not the child listens to the end, so waiting for the
        stream to drain would only undercount abandoned turns. Fire-and-forget:
        a slow ledger write must not sit between a sentence and its sound.
      */
      const chars = input.text.length;
      void ledger.record(input.learnerId, day, chars, estimatedUsdFor(chars)).catch(() => undefined);

      return {
        kind: 'audio',
        contentType: response.headers.get('content-type') ?? 'audio/mpeg',
        stream: response.body,
      };
    },

    async renderBakedClip(id) {
      const key = apiKey();
      if (registry === null || key === null) return { kind: 'text-only' };

      const piece = BAKED_PIECES[id];
      // v3 takes its emotional direction as audio tags, prepended HERE by the
      // egress from the tone's recipe — never authored into a script, so the
      // S4 wording stays exactly the published protocol text.
      const tagged = `${TONE_PALETTE[piece.tone].bakedTags.join('')} ${piece.text}`;

      let response: Response;
      try {
        response = await transport(
          `${API_BASE}/v1/text-to-speech/${registry.voiceId}?output_format=${BAKED_OUTPUT_FORMAT}`,
          {
            method: 'POST',
            headers: { 'xi-api-key': key, 'content-type': 'application/json' },
            body: JSON.stringify({ text: tagged, model_id: registry.bakedModelId }),
          },
        );
      } catch {
        return { kind: 'text-only' };
      }

      if (!response.ok) {
        // Same reason as the streaming path above: an abandoned error body
        // holds its socket open.
        void response.body?.cancel().catch(() => undefined);
        return { kind: 'text-only' };
      }

      return {
        kind: 'audio',
        contentType: response.headers.get('content-type') ?? 'audio/mpeg',
        bytes: new Uint8Array(await response.arrayBuffer()),
      };
    },
  };
}

let shared: VoiceEgress | undefined;

/**
 * The process-wide egress. A singleton for the reason the inference gateway is
 * one: the ledger is the counter, and an egress per call site would be a
 * budget per call site. Built on first use so a process that never speaks
 * never needs the credential; the ledger is late-bound through
 * `sharedVoiceBudgetLedger`.
 */
export function voiceEgress(): VoiceEgress {
  shared ??= createVoiceEgress();
  return shared;
}

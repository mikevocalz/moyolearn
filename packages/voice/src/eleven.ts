// SOT: docs/voice-v4-upgrade.md; docs/pack/32-tutor-voice-tone.md
// SOT-KEYWORDS: voice egress v4 dialogue streaming timestamps cancellation budget
// Sole ElevenLabs credential reader and voice egress. Only authenticated,
// signed Safety Plane output or frozen baked scripts may reach synthesis.
// Failure keeps the existing text; it never substitutes another voice.
import 'server-only';
import { z } from 'zod';
import type { VoiceBand } from '@acme/student-model';
import { BAKED_PIECES, type BakedPieceId } from './baked.ts';
import { estimatedUsdFor, sharedVoiceBudgetLedger, VOICE_BUDGETS, voiceDayKey, type VoiceBudgetLedger } from './budget.ts';
import { liveFaceConfigured, renderFace, type A2fTransport, type FacePerformance } from './a2f.ts';
import { voiceRegistry, VOICE_OUTPUT_FORMAT, type VoiceRegistry } from './registry.ts';
import { TONE_PALETTE, assertTone, voiceSettingsFor, voiceTagsFor } from './tones.ts';
import { alignmentSchema } from './schemas.ts';

const API_BASE = 'https://api.elevenlabs.io';
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * What speaking a sentence resolves to. The degraded arm carries a reason for
 * the server's own logs and nothing a child-facing surface would render — the
 * client's contract is simply "no audio came; the text is already there".
 */
export type SpokenSentence =
  | { readonly kind: 'audio'; readonly contentType: string; readonly stream: ReadableStream<Uint8Array> }
  /**
   * The audio AND its face (ADR-112): Audio2Face frames computed on Moyo's GPU
   * host from these exact bytes, so the client can schedule both on one clock.
   * Only when `AUDIO2FACE_URL` is set; a face that fails to render falls back
   * to `audio` with the same bytes, never to text.
   */
  | {
      readonly kind: 'performance';
      readonly contentType: string;
      readonly audio: Uint8Array;
      readonly face: FacePerformance;
    }
  | {
      readonly kind: 'text-only';
      readonly reason: 'no-voice-configured' | 'voice-budget-spent' | 'voice-unavailable';
    };

export interface BakedAlignment {
  readonly characters: readonly string[];
  readonly character_start_times_seconds: readonly number[];
  readonly character_end_times_seconds: readonly number[];
}

export type BakedClip =
  | { readonly kind: 'audio'; readonly contentType: string; readonly bytes: Uint8Array; readonly alignment: BakedAlignment }
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
  checkConfiguration(): Promise<VoiceConfigurationCheck>;
  speakSentence(input: SpeakSentenceInput): Promise<SpokenSentence>;
  /**
   * Renders one baked set piece with Eleven v4 — the bake job's call, made at
   * deploy or on first use for non-crisis pieces. It is NOT on any live turn
   * and takes no learner id: a baked render is an operations cost, not a
   * child's spend.
   */
  renderBakedClip(id: BakedPieceId): Promise<BakedClip>;
}

export interface VoiceConfigurationCheck {
  readonly configured: boolean;
  readonly modelAvailable: boolean;
  readonly voiceCategory: string | null;
  readonly fineTuningState: string | null;
}

/** Injectable; credentials never leave this module except to ElevenLabs. */
export type VoiceTransport = (url: string, init: RequestInit) => Promise<Response>;
export interface VoiceEgressOptions {
  readonly transport?: VoiceTransport;
  readonly faceTransport?: A2fTransport;
  readonly registry?: VoiceRegistry | null;
  readonly ledger?: VoiceBudgetLedger;
  readonly now?: () => Date;
}
const apiKey = (): string | null => process.env.ELEVENLABS_API_KEY || null;
const unavailable = (): SpokenSentence => ({ kind: 'text-only', reason: 'voice-unavailable' });
const timestampResponseSchema = z.object({
  audio_base64: z.string().min(1),
  alignment: alignmentSchema.nullish(),
  normalized_alignment: alignmentSchema.nullish(),
});
const modelsSchema = z.array(z.object({ model_id: z.string(), can_do_text_to_speech: z.boolean() }));
const voiceSchema = z.object({
  category: z.string().nullish(),
  fine_tuning: z.object({ state: z.record(z.string(), z.string()).optional() }).nullish(),
});

/** Neutralize prose delivery tags before adding trusted ones. Preserve numeric
 * intervals, indices and symbolic math (e.g. [0, 1], a[i], [x + y]). Only the
 * provider copy changes; signed text and displayed captions remain exact. */
const literalText = (text: string): string => text.replace(/\[([a-z][a-z -]+)\]/gi, '($1)');
const synthesisText = (text: string, tone: string, band: VoiceBand): string =>
  `${voiceTagsFor(tone, band).join(' ')} ${literalText(text)}`;
const requestSignal = (signal?: AbortSignal): AbortSignal =>
  signal ? AbortSignal.any([signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS)]) : AbortSignal.timeout(REQUEST_TIMEOUT_MS);

export function createVoiceEgress(options: VoiceEgressOptions = {}): VoiceEgress {
  const transport = options.transport ?? fetch;
  const ledger = options.ledger ?? sharedVoiceBudgetLedger();
  const now = options.now ?? (() => new Date());
  const registry = 'registry' in options ? (options.registry ?? null) : voiceRegistry();

  return {
    async checkConfiguration() {
      const missing: VoiceConfigurationCheck = { configured: false, modelAvailable: false, voiceCategory: null, fineTuningState: null };
      const key = apiKey();
      if (!key || !registry) return missing;
      try {
        const init = { headers: { 'xi-api-key': key }, signal: requestSignal() };
        const [models, voice] = await Promise.all([
          transport(`${API_BASE}/v1/models`, init),
          transport(`${API_BASE}/v1/voices/${encodeURIComponent(registry.voiceId)}`, init),
        ]);
        if (!models.ok || !voice.ok) {
          await Promise.allSettled([models.body?.cancel(), voice.body?.cancel()]);
          return { ...missing, configured: true };
        }
        const modelData = modelsSchema.safeParse(await models.json());
        const voiceData = voiceSchema.safeParse(await voice.json());
        return {
          configured: true,
          modelAvailable: modelData.success && modelData.data.some((model) => model.model_id === registry.liveModelId && model.can_do_text_to_speech),
          voiceCategory: voiceData.success ? voiceData.data.category ?? null : null,
          fineTuningState: voiceData.success ? voiceData.data.fine_tuning?.state?.[registry.liveModelId] ?? null : null,
        };
      } catch { return { ...missing, configured: true }; }
    },

    async speakSentence(input) {
      const tone = assertTone(input.tone);
      const key = apiKey();
      if (!registry || !key) return { kind: 'text-only', reason: 'no-voice-configured' };
      if (input.signal?.aborted || !input.text.trim()) return unavailable();
      const text = synthesisText(input.text, tone, input.band);
      // HTTP dialogue's documented reliable limit includes tags. Never truncate
      // a signed sentence into a different lesson; keep its full text onscreen.
      if (text.length > 2000) return unavailable();
      const signal = requestSignal(input.signal);
      try {
        // Atomic reservation includes the incoming request, so concurrent
        // prefetches cannot both consume the last remaining budget.
        const reserved = await ledger.reserve(input.learnerId, voiceDayKey(now()), text.length,
          estimatedUsdFor(text.length), VOICE_BUDGETS[input.band].dailyUsdCeiling);
        if (!reserved) return { kind: 'text-only', reason: 'voice-budget-spent' };
        if (signal.aborted) return unavailable();
        const response = await transport(`${API_BASE}/v1/text-to-dialogue/stream?output_format=${VOICE_OUTPUT_FORMAT}`, {
          method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, signal,
          body: JSON.stringify({
            inputs: [{ text, voice_id: registry.voiceId }],
            model_id: registry.liveModelId,
            settings: voiceSettingsFor(tone, input.band),
            ...(input.previousText ? { previous_text: literalText(input.previousText).slice(-100) } : {}),
          }),
        });
        const contentType = response.headers.get('content-type')?.split(';')[0]?.trim();
        if (!response.ok || !response.body || contentType !== 'audio/mpeg' || signal.aborted) {
          await response.body?.cancel().catch(() => undefined);
          return unavailable();
        }
        // Existing clients decode a whole sentence. Keep that contract and feed
        // A2F the exact returned bytes; no playback-rate or face-clock changes.
        if (options.faceTransport !== undefined || liveFaceConfigured()) {
          const audio = new Uint8Array(await response.arrayBuffer());
          if (!audio.length || signal.aborted) return unavailable();
          const face = await renderFace(audio, contentType, TONE_PALETTE[tone].a2f,
            { transport: options.faceTransport, signal });
          if (signal.aborted) return unavailable();
          if (face) return { kind: 'performance', contentType, audio, face };
          return { kind: 'audio', contentType, stream: new Response(audio).body! };
        }
        return { kind: 'audio', contentType, stream: response.body };
      } catch { return unavailable(); }
    },

    async renderBakedClip(id) {
      const key = apiKey();
      if (!registry || !key) return { kind: 'text-only' };
      const piece = BAKED_PIECES[id];
      const band: VoiceBand = id === 's4-young' ? 'k-2' : '6-8';
      const text = synthesisText(piece.text, piece.tone, band);
      if (text.length > 2000) return { kind: 'text-only' };
      try {
        const response = await transport(`${API_BASE}/v1/text-to-dialogue/with-timestamps?output_format=${VOICE_OUTPUT_FORMAT}`, {
          method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, signal: requestSignal(),
          body: JSON.stringify({ inputs: [{ text, voice_id: registry.voiceId }], model_id: registry.bakedModelId,
            settings: voiceSettingsFor(piece.tone, band) }),
        });
        if (!response.ok) {
          await response.body?.cancel().catch(() => undefined);
          return { kind: 'text-only' };
        }
        const parsed = timestampResponseSchema.safeParse(await response.json());
        if (!parsed.success) return { kind: 'text-only' };
        const alignment = parsed.data.normalized_alignment ?? parsed.data.alignment;
        if (!alignment) return { kind: 'text-only' };
        const bytes = Uint8Array.from(atob(parsed.data.audio_base64), (c) => c.charCodeAt(0));
        if (!bytes.length) return { kind: 'text-only' };
        return { kind: 'audio', contentType: 'audio/mpeg', bytes, alignment };
      } catch { return { kind: 'text-only' }; }
    },
  };
}

let shared: VoiceEgress | undefined;
export function voiceEgress(): VoiceEgress {
  return shared ??= createVoiceEgress();
}

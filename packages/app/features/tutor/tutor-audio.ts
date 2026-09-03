'use client';
// Tutor audio queue — renders ElevenLabs sentences AHEAD of playback and plays
// them in the order the coach emitted them.
//
// Sentences are kept in the order the coach emits them. Each is POSTed to
// `/api/tutor/voice` with the signed tag and tone from the stream; the tag
// verifies the server emitted the sentence. A 204 or failed request degrades
// that sentence to text without stopping the session.
//
// WHY THE PIPELINE. This queue used to fetch sentence N, await its whole body,
// decode it, play it, and only start N+1 once `onEnded` fired. Every sentence
// boundary therefore cost a full ElevenLabs round trip — TTFB, generation,
// download, decode — of silence, so a four-sentence coaching turn stuttered
// four times. Rendering runs `PREFETCH_DEPTH` sentences ahead of the one
// playing, which takes the whole round trip off the boundary and leaves only
// the JS turnaround between `onEnded` and `start()`.
//
// WHY NOT CHUNKED PLAYBACK. `react-native-audio-api@0.13.3` has no way to
// decode a partial body: `AudioDecoder:decodeAudioData` takes a
// `types.ts:DecodeDataInput` (`number | string | ArrayBuffer`) and resolves one
// complete `AudioBuffer`. Its two incremental sources both want a URL they can
// pull themselves, which this sentence is not — it is a POST carrying the
// signed tag that proves the server emitted the text (`voice-utterance.ts`),
// so there is no address to hand either of them. `core/StreamerNode` is also
// deprecated here and FFmpeg-gated (`utils/flags:isFfmpegEnabled`), and the
// `MediaElementAudioSourceNode` its deprecation note redirects to takes an
// `<Audio>` source, not a request. So a sentence is the smallest unit that can
// be made audible, and the pipeline is what removes the wait between them.
//
// The queue also doubles as the avatar's `SpeechDriver`: it samples the
// sentence's face on the audio clock. Two sources, one clock (ADR-112):
//
//   · a PERFORMANCE — the route answered JSON: the audio plus Audio2Face's
//     blendshape frames computed from those exact bytes on the server. Frame k
//     plays at `start + k / fps` on `AudioContext.currentTime`, so it cannot
//     drift from the sound it was made from;
//   · plain AUDIO — the route answered `audio/mpeg`: the mouth comes from
//     `analyseSpeech` over the decoded PCM, as before. Same clock, mouth only.
//
// THE ONSET LEAD. The first sentence of a turn is scheduled `ONSET_LEAD_MS`
// out rather than started at once. That is the idle engine's anticipation
// window — the breath and the small settle a person makes before speaking —
// and it needs to know the onset BEFORE it happens, which only a scheduled
// start can give it. Later sentences of the same turn start immediately: the
// lead is paid once per turn, not once per sentence.
// SOT: packages/app/features/tutor/tutor.store.ts · apps/web/app/api/tutor/voice/route.ts · docs/decisions/adr-112-live-audio2face.md
// SOT-KEYWORDS: tutor audio queue elevenlabs voice playback captions barge-in viseme prefetch pipeline abort generation a2f face frames performance onset lead

import { API_URL, VOICE_SENTENCE_TIMEOUT_MS } from './tutor-constants.ts';
import {
  createTutorBufferSource,
  decodeTutorAudioBuffer,
  getTutorAudioContextTime,
  resumeTutorAudioContext,
  setTutorSourceEnded,
  type TutorAudioBuffer,
  type TutorAudioSource,
} from './tutor-audio-context';
import {
  ONSET_LEAD_MS,
  analyseSpeech,
  sampleTrack,
  type Shape,
  type Track,
  type SpeechSample,
} from '@acme/avatar';

export interface TutorVoiceRef {
  /** The closed tone palette key for this turn. */
  tone: string;
  /** A server-signed tag proving this sentence was emitted by the stream. */
  tag: string;
}

/**
 * How many sentences may be rendering at once, counted from the head of the
 * queue. Two is the useful depth and the safe one: it covers N+1 and N+2 while
 * N plays, which is deeper than any inter-sentence gap can be heard through,
 * and it holds the concurrent load on one ElevenLabs plan to two live requests
 * per speaking learner. Going deeper buys nothing — a third sentence finishing
 * early only waits longer — while multiplying the 429 risk.
 */
const PREFETCH_DEPTH = 2;

/**
 * After a 429 the pipeline renders one sentence at a time for this long. The
 * concurrency we added is the likeliest cause of a rate limit we did not have
 * before, so the pipeline is what yields; the turn keeps its old serial
 * behaviour rather than degrading further.
 */
const RATE_LIMIT_COOLDOWN_MS = 20_000;

/** Audio2Face's frames for one sentence, as the voice route ships them. */
export interface FaceFrames {
  readonly fps: number;
  readonly names: readonly string[];
  readonly frames: readonly (readonly number[])[];
}

/** The route's JSON envelope when a live face is configured (ADR-112). */
interface PerformanceEnvelope {
  readonly audio: string;
  readonly audioContentType?: string;
  readonly face: FaceFrames;
}

interface RenderedSentence {
  readonly decoded: TutorAudioBuffer;
  readonly face: FaceFrames | null;
}

interface QueuedSentence {
  readonly text: string;
  readonly previousText: string | undefined;
  readonly voice: TutorVoiceRef;
  /** The fetch+decode, started ahead of playback. Null until the pump reaches it. */
  render: Promise<RenderedSentence | null> | null;
  /** Aborts that render. `stop()` fires it so barge-in leaves no live request. */
  controller: AbortController | null;
  /** Whether the render has resolved. A finished render frees a concurrency slot. */
  settled: boolean;
  /** Armed only once playback is waiting on this sentence. Cleared when it settles. */
  deadline: ReturnType<typeof setTimeout> | null;
  renderStartedAt: number;
  renderedAt: number;
}

/** Injectable for tests; production uses global fetch. Mirrors `VoiceTransport`. */
export type TutorVoiceTransport = (url: string, init: RequestInit) => Promise<Response>;

/**
 * The platform audio seam as a value. The functions behind it are the same
 * `tutor-audio-context` fork the queue always used — this only makes them
 * substitutable, so the pipelining and barge-in rules can be tested without a
 * device. Same reason `createVoiceEgress` accepts a `transport`.
 */
export interface TutorAudioPort {
  resume(): void;
  currentTime(): number;
  decode(buffer: ArrayBuffer): Promise<TutorAudioBuffer>;
  createSource(decoded: TutorAudioBuffer): TutorAudioSource;
  onEnded(source: TutorAudioSource, handler: () => void): void;
}

const platformAudioPort: TutorAudioPort = {
  resume: resumeTutorAudioContext,
  currentTime: getTutorAudioContextTime,
  decode: decodeTutorAudioBuffer,
  createSource: createTutorBufferSource,
  onEnded: setTutorSourceEnded,
};

export interface TutorAudioQueueOptions {
  readonly transport?: TutorVoiceTransport;
  readonly audio?: TutorAudioPort;
  readonly prefetchDepth?: number;
}

/**
 * Dev-only playback timeline for the demo smoke pass
 * (`qa/walkthroughs/DEMO-SMOKE-2026-09-03.md` Appendix A). Read it off the
 * METRO terminal, not `adb logcat`: on the New Architecture `console.log` is
 * forwarded to Metro and never reaches the `ReactNativeJS` logcat tag. It is
 * the ruler the pipelining above is measured with, so it lives beside it;
 * `__DEV__` keeps it out of every shipped bundle.
 */
const timingEnabled = (): boolean => typeof __DEV__ !== 'undefined' && __DEV__;

/**
 * A session-scoped audio controller for the live tutor voice.
 *
 * It owns render ordering, play, stop, and cleanup. The public surface is
 * intentionally tiny: `enqueue`, `stop`, `now`, and `sampleSpeech`. Playback
 * clock and viseme sampling live here; the face bus consumes `sampleSpeech`.
 */
export class TutorAudioQueue {
  private readonly transport: TutorVoiceTransport;
  private readonly audio: TutorAudioPort;
  private readonly prefetchDepth: number;

  private queue: QueuedSentence[] = [];
  /** The sentence that has left the queue and is rendering or playing. */
  private active: QueuedSentence | null = null;
  private previousText: string | undefined;
  private isPlaying = false;
  /**
   * Bumped by `stop()`. Every continuation captures the generation it started
   * in and bails if it no longer matches, which is what keeps a superseded
   * sentence from speaking over the turn that replaced it.
   */
  private generation = 0;
  private rateLimitedUntil = 0;
  private activeSource: TutorAudioSource | null = null;
  private activeTrack: Track | null = null;
  private activeFace: FaceFrames | null = null;
  private activeTrackIdx = 0;
  private activeDuration = 0;
  private drainedHandler: (() => void) | null = null;
  private playbackStartAt = 0;

  /** Wall-clock marks for the dev timeline only; never read by playback. */
  private turnStartedAt = 0;
  private turnSentenceIdx = 0;
  private lastEndedAt = 0;

  constructor(options: TutorAudioQueueOptions = {}) {
    this.transport = options.transport ?? ((url, init) => fetch(url, init));
    this.audio = options.audio ?? platformAudioPort;
    this.prefetchDepth = options.prefetchDepth ?? PREFETCH_DEPTH;
  }

  /** Enqueue a sentence the coach has emitted with its voice metadata. */
  enqueue(text: string, voice: TutorVoiceRef): void {
    this.queue.push({
      text,
      previousText: this.previousText,
      voice,
      render: null,
      controller: null,
      settled: false,
      deadline: null,
      renderStartedAt: 0,
      renderedAt: 0,
    });
    this.previousText = text;

    // Rendering starts HERE rather than at playback: this call is the whole
    // fix. A sentence enqueued while an earlier one is still speaking is
    // fetched and decoded during that speech, not after it.
    this.pump();
    if (!this.isPlaying) void this.playNext();
  }

  /** Stop the active sentence and throw away the rest of the turn. */
  stop(): void {
    /*
      Order matters. The generation moves FIRST so that any continuation
      already sitting past an `await` bails before it can touch live state —
      the old guard read `isPlaying`, which cannot tell "stopped" from "a new
      turn is playing now", so a sentence whose fetch landed after a barge-in
      seized `activeSource` and spoke over the reply that superseded it.
      Aborting comes second: an in-flight render nobody will play is a request
      that should not finish, on a metered vendor, on a hotspot.
    */
    this.generation += 1;
    this.activeSource?.stop();
    this.activeSource = null;
    if (this.active !== null) this.abandon(this.active);
    this.active = null;
    for (const item of this.queue) this.abandon(item);
    // Dropping the queue drops the decoded-but-unplayed buffers with it.
    this.queue = [];
    this.previousText = undefined;
    this.isPlaying = false;
    this.activeTrack = null;
    this.activeFace = null;
    this.activeTrackIdx = 0;
    this.activeDuration = 0;
    this.playbackStartAt = 0;

    // `tutor.store.ts:coach` stops the queue immediately before it opens the
    // coach stream, so this is the closest mark the queue has to "the child
    // finished their turn" — the zero point for first-word latency.
    this.turnStartedAt = Date.now();
    this.turnSentenceIdx = 0;
    this.lastEndedAt = 0;
  }

  /**
   * Drop a sentence the turn no longer wants: cancel its request and disarm its
   * deadline. The timer is cleared here rather than left to the render's own
   * continuation so nothing keeps a timer alive after the queue is emptied.
   */
  private abandon(item: QueuedSentence): void {
    if (item.deadline !== null) {
      clearTimeout(item.deadline);
      item.deadline = null;
    }
    item.controller?.abort();
  }

  /**
   * Playback position in seconds, or 0 when nothing is playing. Negative
   * during the onset lead: scheduled, not yet audible.
   */
  now(): number {
    if ((!this.activeTrack && !this.activeFace) || this.playbackStartAt === 0) return 0;
    const t = this.audio.currentTime() - this.playbackStartAt;
    return t;
  }

  /**
   * Seconds until the scheduled onset of the sentence about to play, for the
   * idle engine's anticipation (`timeUntilOnset`). Null when nothing is
   * scheduled — including while a first sentence is still rendering, because
   * an estimate would arm an anticipation that lands on silence.
   */
  timeUntilOnset(): number | null {
    if (this.activeSource === null || this.playbackStartAt === 0) return null;
    const until = this.playbackStartAt - this.audio.currentTime();
    return until > 0 ? until : null;
  }

  /**
   * The Audio2Face frame for the playing instant, as named ARKit weights, or
   * null when this sentence has no face (plain audio, or nothing playing).
   * Linear between frames — at 30 fps a held frame is a visible stutter.
   */
  sampleFace(): Shape | null {
    const face = this.activeFace;
    if (!face || this.playbackStartAt === 0) return null;
    const t = this.now();
    if (t < 0 || t >= this.activeDuration) return null;
    const f = t * face.fps;
    const i = Math.min(Math.floor(f), face.frames.length - 1);
    const j = Math.min(i + 1, face.frames.length - 1);
    const k = f - i;
    const a = face.frames[i] as readonly number[];
    const b = face.frames[j] as readonly number[];
    const shape: Shape = {};
    for (let n = 0; n < face.names.length; ++n) {
      const v = (a[n] as number) * (1 - k) + (b[n] as number) * k;
      if (v > 1e-4) shape[face.names[n] as string] = v;
    }
    return shape;
  }

  /**
   * Is sound coming out of the speaker RIGHT NOW.
   *
   * Not the question the store's `state.kind === 'speaking'` answers — that one
   * means "the turn's text is complete" and is never left (`remember(spoken)`
   * is the normal exit and sets no new state). The avatar read it as "she is
   * talking", so beats went on scheduling into the silence indefinitely.
   */
  /** Called when the last queued sentence has finished playing. */
  onDrained(handler: (() => void) | null): void {
    this.drainedHandler = handler;
  }

  isSpeaking(): boolean {
    return (
      this.activeSource !== null &&
      this.playbackStartAt !== 0 &&
      this.audio.currentTime() >= this.playbackStartAt
    );
  }

  /**
   * Sample the active utterance's face. Matches `SpeechDriver.sampleSpeech`.
   * A performance answers with the whole A2F face; plain audio with the
   * analysis track's mouth. Silent during the onset lead.
   */
  sampleSpeech(_nowMs: number): SpeechSample {
    if (this.playbackStartAt === 0) return { shape: {}, active: false, gap: false };
    const t = this.now();
    if (t < 0) return { shape: {}, active: false, gap: false };
    const face = this.sampleFace();
    if (face) return { shape: face, active: true, gap: false };
    if (!this.activeTrack) return { shape: {}, active: false, gap: false };
    const sampled = sampleTrack(this.activeTrack, t, this.activeTrackIdx);
    this.activeTrackIdx = sampled.idx;
    const active = t < this.activeDuration;
    return { shape: lipsFromAnalysis(sampled.shape), active, gap: false };
  }

  /**
   * Starts renders for the head of the queue, up to the prefetch depth. Called
   * on every enqueue and every advance, and idempotent per sentence.
   *
   * The depth is a ceiling on CONCURRENT renders, not on queued ones. A
   * sentence that has left the queue but has not resolved yet still spends a
   * slot; one that has already decoded no longer does. Counting positions
   * instead stalled the tail of a turn — the sentence behind a finished render
   * waited for the next enqueue that may never come.
   */
  private pump(): void {
    const depth = Date.now() < this.rateLimitedUntil ? 1 : this.prefetchDepth;
    let inFlight = this.active !== null && !this.active.settled ? 1 : 0;
    for (const item of this.queue) {
      if (inFlight >= depth) return;
      this.startRender(item);
      if (!item.settled) inFlight += 1;
    }
  }

  private startRender(item: QueuedSentence): Promise<RenderedSentence | null> {
    const started = item.render;
    if (started !== null) return started;
    const controller = new AbortController();
    item.controller = controller;
    item.renderStartedAt = Date.now();
    const render = this.render(item, controller.signal);
    item.render = render;
    // `render` never rejects, so this always runs. Refilling here rather than
    // only on enqueue/advance is what keeps the last sentences of a turn from
    // waiting on a boundary that has not arrived yet.
    void render.then(() => {
      if (item.deadline !== null) {
        clearTimeout(item.deadline);
        item.deadline = null;
      }
      item.settled = true;
      this.pump();
    });
    return render;
  }

  /**
   * Fetch and decode one sentence. Never rejects: every failure is text-only,
   * which is the route's own contract (204 for budget/vendor/unconfigured, 403
   * for an unverified payload) and doc 32's degraded mode.
   */
  private async render(item: QueuedSentence, signal: AbortSignal): Promise<RenderedSentence | null> {
    try {
      const response = await this.transport(`${API_URL}/api/tutor/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal,
        body: JSON.stringify({
          text: item.text,
          previousText: item.previousText,
          tone: item.voice.tone,
          tag: item.voice.tag,
        }),
      });

      if (response.status === 429) {
        this.rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        return null;
      }
      if (!response.ok || response.status === 204) return null;

      /*
        JSON is a PERFORMANCE: the audio and its face, together, because they
        were computed from the same bytes and must never race. Anything else
        is the audio alone, as the route has always answered.
      */
      const contentType = response.headers?.get?.('content-type') ?? '';
      let bytes: ArrayBuffer;
      let face: FaceFrames | null = null;
      if (contentType.startsWith('application/json')) {
        const envelope = (await response.json()) as PerformanceEnvelope;
        bytes = decodeBase64(envelope.audio);
        face = isFaceFrames(envelope.face) ? envelope.face : null;
      } else {
        bytes = await response.arrayBuffer();
      }
      const decoded = await this.audio.decode(bytes);
      item.renderedAt = Date.now();
      return { decoded, face };
    } catch {
      // An abort from `stop()` arrives here too, and is the same nothing.
      return null;
    }
  }

  private async playNext(): Promise<void> {
    const item = this.queue.shift();
    if (item === undefined) {
      this.isPlaying = false;
      return;
    }
    this.isPlaying = true;
    this.active = item;
    const generation = this.generation;

    /*
      THE WHOLE BODY IS GUARDED, and that is not defensive padding.

      Both call sites are `void this.playNext()`, so anything thrown here
      becomes an unhandled rejection that leaves `isPlaying` true with an
      `activeSource` that will never fire `onEnded` — `advance()` never runs
      again and every later sentence piles into the queue for the rest of the
      session. The realistic throw is the audio context itself: on native
      `new AudioContext()` is a TypeError whenever the JSI module has not
      registered (a stale dev client, a bundle loaded too early), and on web
      wherever only `webkitAudioContext` exists. That used to cost one
      text-only sentence; unguarded it costs the tutor's voice entirely.
    */
    try {
      this.audio.resume();
      // Already in flight whenever an earlier sentence was speaking; only the
      // first sentence of a turn actually starts its render here.
      const render = this.startRender(item);

      /*
        The deadline starts HERE, not at prefetch.

        `VOICE_SENTENCE_TIMEOUT_MS` budgets a sentence the child is WAITING on.
        Armed when the render was queued instead, a sentence rendered two ahead
        would be aborted for taking nine seconds even though fifteen seconds of
        earlier audio still stood between it and its slot — silence bought at
        the cost of a sentence nobody was waiting for. A prefetch that hangs is
        bounded anyway: it holds a concurrency slot until this queue reaches it,
        and then this timer applies.
      */
      if (!item.settled) {
        item.deadline = setTimeout(() => item.controller?.abort(), VOICE_SENTENCE_TIMEOUT_MS);
      }

      const rendered = await render;

      if (generation !== this.generation) return;
      // This sentence stops counting against the concurrency budget the moment
      // it is rendered, so the one after next can start while it speaks.
      this.active = null;
      this.pump();
      if (rendered === null) {
        this.advance();
        return;
      }
      const decoded = rendered.decoded;

      // An AudioBufferSourceNode is single-use, so the node is built at playback
      // even though the buffer behind it was decoded ahead of time.
      const source = this.audio.createSource(decoded);
      this.activeSource = source;
      this.activeDuration = decoded.duration;
      this.activeFace = rendered.face;
      /*
        THE MOUTH COMES FROM THE AUDIO, NOT THE SPELLING.

        This was `evenTrack(item.text, duration)` — one keyframe per letter,
        spaced by character index, jaw 0.5 for a vowel and 0.2 otherwise. Its
        own docstring calls it the fallback for an aligner nobody wired, and it
        reads exactly like what it is: an even chew with no pauses and no
        stress. We have already decoded the whole buffer (we have to — this
        backend cannot decode a partial body), so the samples are in hand and
        `analyseSpeech` is one pass over them.
      */
      /*
        WRAPPED, because this runs inside `playNext`'s catch-all and that catch
        turns any throw into a text-only sentence. An analysis that cannot read
        this buffer must cost her the LIPSYNC, never the voice.
      */
      try {
        this.activeTrack = analyseSpeech(decoded.getChannelData(0), decoded.sampleRate);
      } catch {
        this.activeTrack = null;
      }
      this.activeTrackIdx = 0;

      this.audio.onEnded(source, () => {
        if (generation !== this.generation) return;
        this.activeSource = null;
        this.playbackStartAt = 0;
        this.lastEndedAt = Date.now();
        this.advance();
      });

      // The first sentence of a turn is scheduled a lead out — the idle
      // engine's anticipation window (see the header). The rest start now.
      const lead = this.turnSentenceIdx === 0 ? ONSET_LEAD_MS / 1000 : 0;
      const startAt = this.audio.currentTime() + lead;
      source.start(startAt);
      this.playbackStartAt = startAt;
      this.markPlayed(item);
    } catch {
      // One sentence lost to text, exactly as a failed render is. The turn
      // continues; a broken audio context degrades the garnish, not the lesson.
      if (generation !== this.generation) return;
      this.active = null;
      this.activeSource = null;
      this.advance();
    }
  }

  private advance(): void {
    this.pump();
    if (this.queue.length > 0) {
      void this.playNext();
    } else {
      this.isPlaying = false;
      // The turn is audibly over. Nothing else in the app knows this: the
      // store's `speaking` means "the text is complete" and is never left.
      this.drainedHandler?.();
    }
  }

  private markPlayed(item: QueuedSentence): void {
    this.turnSentenceIdx += 1;
    if (!timingEnabled()) return;
    const at = Date.now();
    const render = item.renderedAt - item.renderStartedAt;
    // Positive lead means the buffer was decoded and waiting when its turn
    // came — the pipeline paid off. Near zero means playback waited on it.
    const lead = at - item.renderedAt;
    const boundary =
      this.turnSentenceIdx === 1
        ? `firstWord=${at - this.turnStartedAt}ms`
        : `gap=${this.lastEndedAt === 0 ? -1 : at - this.lastEndedAt}ms`;
    console.log(`[voice-timing] s${this.turnSentenceIdx} ${boundary} render=${render}ms lead=${lead}ms`);
  }
}

/**
 * `analyseSpeech` speaks in its own two words — `open` (how wide) and
 * `spread` (how sibilant) — and every consumer of this queue speaks ARKit:
 * the 2D face bus encodes `jawOpen`, the 3D writer reads `jawOpen`. Nothing
 * translated between them, so the mouth read zero for the whole sentence
 * while the voice played (Duo, 2026-09-03: "her mouth isn't even moving").
 * A spread mouth is a narrower one with the corners pulled back.
 */
function lipsFromAnalysis(shape: Shape): Shape {
  const open = shape.open ?? shape.jawOpen ?? 0;
  const spread = shape.spread ?? 0;
  if (open <= 0 && spread <= 0) return {};
  return {
    jawOpen: open * (1 - 0.35 * spread),
    mouthStretchLeft: spread * 0.5,
    mouthStretchRight: spread * 0.5,
  };
}

function isFaceFrames(value: unknown): value is FaceFrames {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.fps === 'number' &&
    v.fps > 0 &&
    Array.isArray(v.names) &&
    Array.isArray(v.frames) &&
    v.frames.length > 0 &&
    (v.frames as unknown[]).every((f) => Array.isArray(f) && f.length === (v.names as unknown[]).length)
  );
}

/** Base64 → bytes without `Buffer`; Hermes and the browser both have `atob`. */
function decodeBase64(text: string): ArrayBuffer {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; ++i) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

/** The single session audio queue, shared by the store and the avatar. */
export const audioQueue = new TutorAudioQueue();

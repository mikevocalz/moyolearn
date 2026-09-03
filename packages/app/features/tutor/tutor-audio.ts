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
// The queue also doubles as the avatar's `SpeechDriver`: it computes an even
// viseme track from the text and duration, then samples it on the audio clock.
// The 2D/3D face bus reads `sampleSpeech` to drive the mouth.
// SOT: packages/app/features/tutor/tutor.store.ts · apps/web/app/api/tutor/voice/route.ts
// SOT-KEYWORDS: tutor audio queue elevenlabs voice playback captions barge-in viseme prefetch pipeline abort generation

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
import { analyseSpeech, sampleTrack, type Track, type SpeechSample } from '@acme/avatar';

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

interface QueuedSentence {
  readonly text: string;
  readonly previousText: string | undefined;
  readonly voice: TutorVoiceRef;
  /** The fetch+decode, started ahead of playback. Null until the pump reaches it. */
  render: Promise<TutorAudioBuffer | null> | null;
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
  private activeTrackIdx = 0;
  private activeDuration = 0;
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

  /** Playback position in seconds, or 0 when nothing is playing. */
  now(): number {
    if (!this.activeTrack || this.playbackStartAt === 0) return 0;
    const t = this.audio.currentTime() - this.playbackStartAt;
    return t;
  }

  /**
   * Is sound coming out of the speaker RIGHT NOW.
   *
   * Not the question the store's `state.kind === 'speaking'` answers — that one
   * means "the turn's text is complete" and is never left (`remember(spoken)`
   * is the normal exit and sets no new state). The avatar read it as "she is
   * talking", so beats went on scheduling into the silence indefinitely.
   */
  isSpeaking(): boolean {
    return this.activeSource !== null && this.playbackStartAt !== 0;
  }

  /** Sample the active utterance's viseme track. Matches `SpeechDriver.sampleSpeech`. */
  sampleSpeech(_nowMs: number): SpeechSample {
    if (!this.activeTrack || this.playbackStartAt === 0) {
      return { shape: {}, active: false, gap: false };
    }
    const t = this.now();
    const sampled = sampleTrack(this.activeTrack, t, this.activeTrackIdx);
    this.activeTrackIdx = sampled.idx;
    const active = t < this.activeDuration;
    return { shape: sampled.shape, active, gap: false };
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

  private startRender(item: QueuedSentence): Promise<TutorAudioBuffer | null> {
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
  private async render(item: QueuedSentence, signal: AbortSignal): Promise<TutorAudioBuffer | null> {
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

      const decoded = await this.audio.decode(await response.arrayBuffer());
      item.renderedAt = Date.now();
      return decoded;
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

      const decoded = await render;

      if (generation !== this.generation) return;
      // This sentence stops counting against the concurrency budget the moment
      // it is rendered, so the one after next can start while it speaks.
      this.active = null;
      this.pump();
      if (decoded === null) {
        this.advance();
        return;
      }

      // An AudioBufferSourceNode is single-use, so the node is built at playback
      // even though the buffer behind it was decoded ahead of time.
      const source = this.audio.createSource(decoded);
      this.activeSource = source;
      this.activeDuration = decoded.duration;
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

      source.start(0);
      this.playbackStartAt = this.audio.currentTime();
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

/** The single session audio queue, shared by the store and the avatar. */
export const audioQueue = new TutorAudioQueue();

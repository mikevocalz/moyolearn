'use client';
// Tutor audio queue — fetches and plays one ElevenLabs sentence at a time.
//
// Sentences are kept in the order the coach emits them. Each is POSTed to
// `/api/tutor/voice` with the signed tag and tone from the stream; the tag
// verifies the server emitted the sentence. A 204 or failed request degrades
// that sentence to text without stopping the session.
//
// The queue also doubles as the avatar's `SpeechDriver`: it computes an even
// viseme track from the text and duration, then samples it on the audio clock.
// The 2D/3D face bus reads `sampleSpeech` to drive the mouth.
// SOT: packages/app/features/tutor/tutor.store.ts · apps/web/app/api/tutor/voice/route.ts
// SOT-KEYWORDS: tutor audio queue elevenlabs voice playback captions barge-in viseme

import { API_URL } from './tutor-constants.ts';
import {
  createTutorBufferSource,
  decodeTutorAudioBuffer,
  getTutorAudioContextTime,
  resumeTutorAudioContext,
  setTutorSourceEnded,
  type TutorAudioSource,
} from './tutor-audio-context';
import { evenTrack, sampleTrack, type Track, type SpeechSample } from '@acme/avatar';

export interface TutorVoiceRef {
  /** The closed tone palette key for this turn. */
  tone: string;
  /** A server-signed tag proving this sentence was emitted by the stream. */
  tag: string;
}

interface QueuedSentence {
  text: string;
  previousText: string | undefined;
  voice: TutorVoiceRef;
}

/**
 * A session-scoped audio controller for the live tutor voice.
 *
 * It owns fetch/decode ordering, play, stop, and cleanup. The public surface is
 * intentionally tiny: `enqueue`, `stop`, `now`, and `sampleSpeech`. Playback
 * clock and viseme sampling live here; the face bus consumes `sampleSpeech`.
 */
export class TutorAudioQueue {
  private queue: QueuedSentence[] = [];
  private previousText: string | undefined;
  private isPlaying = false;
  private activeSource: TutorAudioSource | null = null;
  private activeText: string = '';
  private activeTrack: Track | null = null;
  private activeTrackIdx = 0;
  private activeDuration = 0;
  private playbackStartAt = 0;

  /** Enqueue a sentence the coach has emitted with its voice metadata. */
  enqueue(text: string, voice: TutorVoiceRef): void {
    const item: QueuedSentence = { text, previousText: this.previousText, voice };
    this.previousText = text;
    this.queue.push(item);
    if (!this.isPlaying) {
      void this.playNext();
    }
  }

  /** Stop the active sentence and throw away the rest of the turn. */
  stop(): void {
    this.activeSource?.stop();
    this.activeSource = null;
    this.queue = [];
    this.previousText = undefined;
    this.isPlaying = false;
    this.activeTrack = null;
    this.activeTrackIdx = 0;
    this.activeDuration = 0;
    this.playbackStartAt = 0;
  }

  /** Playback position in seconds, or 0 when nothing is playing. */
  now(): number {
    if (!this.activeTrack || this.playbackStartAt === 0) return 0;
    const t = getTutorAudioContextTime() - this.playbackStartAt;
    return t;
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

  private async playNext(): Promise<void> {
    const item = this.queue.shift();
    if (!item) {
      this.isPlaying = false;
      return;
    }
    this.isPlaying = true;

    try {
      resumeTutorAudioContext();

      const response = await fetch(`${API_URL}/api/tutor/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          text: item.text,
          previousText: item.previousText,
          tone: item.voice.tone,
          tag: item.voice.tag,
        }),
      });

      if (response.status === 204 || !response.ok) {
        // Text-only degradation: move on. For 403 the client has no recourse;
        // for other failures the server already logged and the child keeps reading.
        this.advance();
        return;
      }

      const buffer = await response.arrayBuffer();
      const decoded = await decodeTutorAudioBuffer(buffer);
      const source = createTutorBufferSource(decoded);
      this.activeSource = source;

      // If `stop()` was called while we were fetching/decoding, do not start.
      if (!this.isPlaying) {
        this.activeSource = null;
        this.advance();
        return;
      }

      this.activeText = item.text;
      this.activeDuration = (decoded as { duration: number }).duration;
      this.activeTrack = evenTrack(item.text, this.activeDuration);
      this.activeTrackIdx = 0;

      setTutorSourceEnded(source, () => {
        this.activeSource = null;
        this.playbackStartAt = 0;
        this.advance();
      });

      source.start(0);
      this.playbackStartAt = getTutorAudioContextTime();
    } catch {
      // Decode or network failure: continue the turn in text.
      this.advance();
    }
  }

  private advance(): void {
    if (this.queue.length > 0) {
      void this.playNext();
    } else {
      this.isPlaying = false;
    }
  }
}

/** The single session audio queue, shared by the store and the avatar. */
export const audioQueue = new TutorAudioQueue();

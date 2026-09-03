// The tutor voice pipeline, and the two ways it can go wrong out loud.
//
// The queue renders sentences ahead of playback (D1), which buys back a whole
// ElevenLabs round trip at every sentence boundary and introduces exactly one
// new hazard: a render that outlives the turn that asked for it. Both halves
// are asserted here — that N+1 really is in flight while N speaks, and that a
// barge-in leaves nothing behind that can still make sound.
//
// The audio and transport seams are injected rather than mocked at module
// scope, the way `createVoiceEgress({ transport })` is injected in
// `packages/voice/src/eleven.ts`, so this runs on `node --test` with no device
// and no Web Audio implementation.
//
// The queue imports its platform fork EXTENSIONLESS on purpose — spelling the
// extension would pin every platform to the web anchor — so Node needs a
// resolve hook to find it. That is a test concern, not a bundler one.
// SOT: packages/app/features/tutor/tutor-audio.ts · docs/pack/32-tutor-voice-tone.md §3
// SOT-KEYWORDS: tutor audio queue test prefetch pipeline barge-in abort orphan rate limit order

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { registerHooks } from 'node:module';
import { VOICE_SENTENCE_TIMEOUT_MS } from './tutor-constants.ts';
// Aliased: the value of the same name is bound below by the dynamic import.
import type { TutorAudioQueue as Queue, TutorAudioPort, TutorVoiceRef } from './tutor-audio.ts';
import type { TutorAudioBuffer, TutorAudioSource } from './tutor-audio-context.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === './tutor-audio-context') {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { TutorAudioQueue } = await import('./tutor-audio.ts');

const VOICE: TutorVoiceRef = { tone: 'warm', tag: 'signed' };

/** Carries the sentence through decode so playback order is observable. */
interface TaggedBuffer extends TutorAudioBuffer {
  readonly text: string;
}

interface FakeSource extends TutorAudioSource {
  text: string;
  started: boolean;
  stopped: boolean;
  fireEnded: () => void;
}

interface PendingRequest {
  readonly text: string;
  readonly previousText: string | undefined;
  readonly signal: AbortSignal;
  readonly reply: (response: Response) => void;
}

/** Flushes every pending microtask chain the queue is sitting on. */
const settle = async (): Promise<void> => {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
};

const audioReply = (text: string): Response =>
  ({
    ok: true,
    status: 200,
    headers: { get: () => 'audio/mpeg' },
    arrayBuffer: async () => new TextEncoder().encode(text).buffer,
  }) as unknown as Response;

/** The route's JSON envelope: the audio plus its Audio2Face frames (ADR-112). */
const performanceReply = (text: string, frames: number[][], names: string[], fps = 30): Response =>
  ({
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => ({
      audio: btoa(text),
      audioContentType: 'audio/mpeg',
      face: { fps, names, frames },
    }),
  }) as unknown as Response;

const statusReply = (status: number): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    arrayBuffer: async () => new ArrayBuffer(0),
  }) as unknown as Response;

/*
  Most tests end with a request deliberately left unanswered, which leaves that
  sentence's 8s deadline armed — and `node --test` will not exit while a timer
  is pending, so the suite sat for ~16s of wall clock doing nothing. `stop()`
  disarms them, so every queue gets stopped when its test ends.
*/
const live: Queue[] = [];
afterEach(() => {
  for (const queue of live.splice(0)) queue.stop();
});

function harness(prefetchDepth?: number) {
  const requests: PendingRequest[] = [];
  const sources: FakeSource[] = [];
  const started: string[] = [];

  /** The fake audio clock, in seconds. Tests that need time advance it. */
  const clock = { now: 1 };
  const audio: TutorAudioPort = {
    resume: () => undefined,
    currentTime: () => clock.now,
    decode: async (buffer) =>
      ({
        duration: 1,
        // The queue now analyses the decoded PCM for the viseme track, so a
        // fake buffer has to carry samples. One second of silence: these tests
        // are about ORDER and degradation, not about her mouth.
        sampleRate: 24000,
        getChannelData: () => new Float32Array(24000),
        text: new TextDecoder().decode(buffer),
      }) satisfies TaggedBuffer,
    createSource: (decoded) => {
      const source: FakeSource = {
        text: (decoded as TaggedBuffer).text,
        started: false,
        stopped: false,
        fireEnded: () => undefined,
        start: () => {
          source.started = true;
          started.push(source.text);
        },
        stop: () => {
          source.stopped = true;
        },
      };
      sources.push(source);
      return source;
    },
    onEnded: (source, handler) => {
      (source as FakeSource).fireEnded = handler;
    },
  };

  const queue = new TutorAudioQueue({
    audio,
    prefetchDepth,
    transport: async (_url, init) => {
      const body = JSON.parse(String(init.body)) as { text: string; previousText?: string };
      const signal = init.signal as AbortSignal;
      return await new Promise<Response>((reply, fail) => {
        // Faithful to fetch: an abort rejects the request that is still open.
        signal.addEventListener('abort', () => fail(new Error('aborted')));
        requests.push({ text: body.text, previousText: body.previousText, signal, reply });
      });
    },
  });

  /** Answers the request for `text` with audio, without advancing the queue. */
  const replyTo = (text: string): void => {
    const pending = requests.find((r) => r.text === text);
    assert.ok(pending, `no request was issued for "${text}"`);
    pending.reply(audioReply(text));
  };

  /** Answers the request for `text` and lets playback catch up. */
  const speak = async (text: string): Promise<void> => {
    replyTo(text);
    await settle();
  };

  const endPlaybackOf = async (text: string): Promise<void> => {
    const source = sources.find((s) => s.text === text);
    assert.ok(source, `"${text}" never started playing`);
    source.fireEnded();
    await settle();
  };

  live.push(queue);
  return { queue, audio, clock, requests, sources, started, replyTo, speak, endPlaybackOf };
}

describe('the face rides the audio clock (ADR-112)', () => {
  it('a JSON performance decodes its audio and samples its frames by name', async () => {
    const h = harness();
    h.queue.enqueue('One.', VOICE);
    await settle();
    const pending = h.requests.find((r) => r.text === 'One.');
    assert.ok(pending);
    // Two frames a second apart at 1 fps: brow up at t=0, jaw open at t=1.
    pending.reply(performanceReply('One.', [[1, 0], [0, 1]], ['browInnerUp', 'jawOpen'], 1));
    await settle();
    assert.deepEqual(h.started, ['One.'], 'the performance audio did not play');

    // Scheduled a lead out: during the lead nothing is audible and no face.
    assert.equal(h.queue.isSpeaking(), false);
    assert.equal(h.queue.sampleFace(), null);
    const until = h.queue.timeUntilOnset();
    assert.ok(until !== null && until > 0.2 && until <= 0.3 + 1e-9, `lead was ${until}`);

    h.clock.now += 0.3;
    assert.equal(h.queue.isSpeaking(), true);
    assert.equal(h.queue.timeUntilOnset(), null);
    assert.deepEqual(h.queue.sampleFace(), { browInnerUp: 1 });
    const speech = h.queue.sampleSpeech(0);
    assert.equal(speech.active, true);
    assert.deepEqual(speech.shape, { browInnerUp: 1 });

    h.clock.now += 0.5;
    const mid = h.queue.sampleFace();
    assert.ok(mid && Math.abs(mid.browInnerUp! - 0.5) < 1e-9 && Math.abs(mid.jawOpen! - 0.5) < 1e-9, 'not interpolating');
  });

  it('plain audio still drives the mouth from the analysis track, with no face', async () => {
    const h = harness();
    h.queue.enqueue('One.', VOICE);
    await settle();
    await h.speak('One.');
    h.clock.now += 0.3;
    assert.equal(h.queue.sampleFace(), null);
    assert.equal(h.queue.isSpeaking(), true);
  });

  it('only the first sentence of a turn pays the onset lead', async () => {
    const h = harness();
    h.queue.enqueue('One.', VOICE);
    h.queue.enqueue('Two.', VOICE);
    await settle();
    await h.speak('One.');
    await h.speak('Two.');
    assert.ok((h.queue.timeUntilOnset() ?? 0) > 0, 'first sentence should be scheduled ahead');
    h.clock.now += 0.3;
    await h.endPlaybackOf('One.');
    assert.deepEqual(h.started, ['One.', 'Two.']);
    assert.equal(h.queue.timeUntilOnset(), null, 'the second sentence must start at once');
    assert.equal(h.queue.isSpeaking(), true);
  });
});

describe('the tutor voice pipeline', () => {
  it('renders the next sentences while the current one is still speaking', async () => {
    const h = harness();

    h.queue.enqueue('One.', VOICE);
    await settle();
    await h.speak('One.');
    assert.deepEqual(h.started, ['One.'], 'the first sentence should be playing');

    // The whole point of D1: these two are fetched and decoded DURING "One.",
    // not after it ends.
    h.queue.enqueue('Two.', VOICE);
    h.queue.enqueue('Three.', VOICE);
    await settle();

    assert.deepEqual(
      h.requests.map((r) => r.text),
      ['One.', 'Two.', 'Three.'],
      'the queue waited for playback to end before fetching the next sentences',
    );

    await h.speak('Two.');
    await h.speak('Three.');
    // Still only one sentence has been spoken — the other two are decoded and
    // waiting, which is what makes the boundary free.
    assert.deepEqual(h.started, ['One.']);

    await h.endPlaybackOf('One.');
    assert.deepEqual(h.started, ['One.', 'Two.'], 'the next sentence did not start immediately');
  });

  it('plays in the coach’s order even when a later sentence renders first', async () => {
    const h = harness();

    h.queue.enqueue('One.', VOICE);
    h.queue.enqueue('Two.', VOICE);
    await settle();

    // "Two." comes back from ElevenLabs first. It must still wait its turn.
    await h.speak('Two.');
    assert.deepEqual(h.started, [], 'a later sentence jumped the queue');

    await h.speak('One.');
    assert.deepEqual(h.started, ['One.']);
    await h.endPlaybackOf('One.');
    assert.deepEqual(h.started, ['One.', 'Two.']);
  });

  it('carries previousText forward for prosody stitching', async () => {
    const h = harness();

    h.queue.enqueue('One.', VOICE);
    h.queue.enqueue('Two.', VOICE);
    await settle();

    assert.equal(h.requests[0]?.previousText, undefined);
    assert.equal(h.requests[1]?.previousText, 'One.');
  });

  it('degrades one failed sentence to text and keeps the turn going', async () => {
    const h = harness();

    h.queue.enqueue('One.', VOICE);
    h.queue.enqueue('Two.', VOICE);
    await settle();

    // 204 is the route's text-only answer: budget spent, voice unconfigured or
    // vendor down. The child keeps reading and the next sentence still speaks.
    h.requests[0]?.reply(statusReply(204));
    await settle();
    await h.speak('Two.');

    assert.deepEqual(h.started, ['Two.']);
  });

  describe('barge-in', () => {
    it('aborts every in-flight render', async () => {
      const h = harness();

      h.queue.enqueue('One.', VOICE);
      h.queue.enqueue('Two.', VOICE);
      await settle();
      assert.equal(h.requests.length, 2);
      assert.ok(h.requests.every((r) => !r.signal.aborted));

      h.queue.stop();

      // Both the sentence that had left the queue to play and the one still
      // queued behind it. A live request on a metered vendor is not free.
      assert.ok(
        h.requests.every((r) => r.signal.aborted),
        'stop() left a voice request in flight',
      );
    });

    it('stops the sentence that is speaking', async () => {
      const h = harness();

      h.queue.enqueue('One.', VOICE);
      await settle();
      await h.speak('One.');

      h.queue.stop();
      assert.equal(h.sources[0]?.stopped, true);
    });

    it('never speaks a sentence whose render lands after the turn was cut', async () => {
      const h = harness();

      h.queue.enqueue('One.', VOICE);
      await settle();

      // The race that matters: the body was already on the wire when the child
      // barged in, so the render still decodes — after `stop()` has run.
      h.replyTo('One.');
      h.queue.stop();
      await settle();

      assert.deepEqual(h.started, [], 'a superseded sentence still played');
    });

    it('does not let a superseded sentence speak over the turn that replaced it', async () => {
      // The regression this file exists for. The old guard read `isPlaying`,
      // which is true again as soon as the NEXT turn starts, so a sentence
      // from the abandoned turn seized the active source and spoke over the
      // reply that superseded it.
      const h = harness();

      h.queue.enqueue('Old.', VOICE);
      await settle();

      // "Old." decodes, then the child barges in before the continuation runs.
      h.replyTo('Old.');
      h.queue.stop();
      h.queue.enqueue('New.', VOICE);
      await settle();

      await h.speak('New.');

      assert.deepEqual(h.started, ['New.']);
    });

    it('starts the next turn from a clean previousText', async () => {
      const h = harness();

      h.queue.enqueue('Old.', VOICE);
      await settle();
      h.queue.stop();
      h.queue.enqueue('New.', VOICE);
      await settle();

      const fresh = h.requests.find((r) => r.text === 'New.');
      assert.equal(fresh?.previousText, undefined, 'the abandoned turn leaked into the new one');
    });
  });

  it('loses one sentence, not the session, when the audio context throws', async () => {
    // Both playNext call sites are `void`, so an unguarded throw here would be
    // an unhandled rejection that leaves isPlaying true forever — the tutor
    // goes mute for the rest of the session rather than for one sentence. The
    // realistic cause is `new AudioContext()` on a runtime where the JSI module
    // has not registered.
    const h = harness();
    let thrown = false;
    h.audio.resume = () => {
      if (thrown) return;
      thrown = true;
      throw new TypeError('createAudioContext is not a function');
    };

    h.queue.enqueue('One.', VOICE);
    await settle();
    assert.equal(thrown, true, 'the first sentence never reached the audio context');

    h.queue.enqueue('Two.', VOICE);
    await settle();
    await h.speak('Two.');

    assert.deepEqual(h.started, ['Two.'], 'the queue wedged instead of continuing');
  });

  it('gives up on a hung sentence instead of silencing the rest of the turn', async (t) => {
    // The failure this prevents: one POST that never answers used to leave the
    // queue "playing" forever with every later sentence stuck behind it.
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const h = harness();

    h.queue.enqueue('One.', VOICE);
    h.queue.enqueue('Two.', VOICE);
    await settle();

    // "One." is never answered. "Two." is.
    await h.speak('Two.');
    assert.deepEqual(h.started, [], 'nothing should play while the first sentence hangs');

    t.mock.timers.tick(VOICE_SENTENCE_TIMEOUT_MS);
    await settle();

    assert.ok(h.requests[0]?.signal.aborted, 'the hung request was never aborted');
    assert.deepEqual(h.started, ['Two.'], 'the turn did not continue past the hung sentence');
  });

  describe('the concurrency ceiling', () => {
    it('holds in-flight renders to the prefetch depth', async () => {
      const h = harness();

      h.queue.enqueue('One.', VOICE);
      await settle();
      await h.speak('One.');

      h.queue.enqueue('Two.', VOICE);
      h.queue.enqueue('Three.', VOICE);
      h.queue.enqueue('Four.', VOICE);
      await settle();

      // Depth 2, so "Four." waits until one of the two ahead of it resolves.
      assert.deepEqual(
        h.requests.map((r) => r.text),
        ['One.', 'Two.', 'Three.'],
      );

      await h.speak('Two.');
      await settle();
      assert.ok(
        h.requests.some((r) => r.text === 'Four.'),
        'the pipeline stalled instead of refilling',
      );
    });

    it('backs off to one render at a time after a 429', async () => {
      const h = harness();

      h.queue.enqueue('One.', VOICE);
      await settle();
      h.requests[0]?.reply(statusReply(429));
      await settle();

      h.queue.enqueue('Two.', VOICE);
      await settle();
      await h.speak('Two.');

      h.queue.enqueue('Three.', VOICE);
      h.queue.enqueue('Four.', VOICE);
      await settle();

      // Without the cooldown both would be in flight; the plan's concurrency is
      // finite and our own pipelining is the new load on it.
      assert.deepEqual(
        h.requests.map((r) => r.text),
        ['One.', 'Two.', 'Three.'],
      );
    });

    it('runs two ahead when nothing has been rate limited', async () => {
      // The control for the case above: same shape, no 429.
      const h = harness();

      h.queue.enqueue('One.', VOICE);
      await settle();
      await h.speak('One.');
      await h.endPlaybackOf('One.');

      h.queue.enqueue('Two.', VOICE);
      await settle();
      await h.speak('Two.');

      h.queue.enqueue('Three.', VOICE);
      h.queue.enqueue('Four.', VOICE);
      await settle();

      assert.deepEqual(
        h.requests.map((r) => r.text),
        ['One.', 'Two.', 'Three.', 'Four.'],
      );
    });
  });
});

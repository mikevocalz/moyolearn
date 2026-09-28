// The doc 32 regression suite, failing-first by construction: each block below
// is one of the doc's hard lines, held as an assertion rather than a memory.
//
//   1. the palette is CLOSED — nine entries, frozen, unknown tone refused;
//   2. band modulation multiplies the palette (K-2 slower/more melodic, 9-12
//      style pulled down) instead of duplicating it;
//   3. the S4 path NEVER calls the live API — cache or text-only, no render;
//   4. budget exhaustion is silent text-only, with no provider call at all;
//   5. degraded mode is text-only, never a substitute voice (no registry ->
//      no call, not a fallback voice id).
// SOT: docs/pack/32-tutor-voice-tone.md §2 §3 §4 §5
// SOT-KEYWORDS: voice test palette closed band modulation s4 never live budget silent text only
import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import { S4_SCRIPTS } from '@acme/safety';
import {
  BAKED_PIECES,
  BAKED_PIECE_IDS,
  bakedServePlan,
  bakedBundlePrefix,
  bakedManifestSchema,
} from './baked.ts';
import { inMemoryVoiceLedger, VOICE_BUDGETS, type VoiceBudgetLedger } from './budget.ts';
import { liveFaceConfigured, probeFaceHost, renderFace } from './a2f.ts';
import { createVoiceEgress, type VoiceTransport } from './eleven.ts';
import {
  TONES,
  TONE_PALETTE,
  UnknownTone,
  assertTone,
  isTone,
  voiceSettingsFor,
  voiceTagsFor,
} from './tones.ts';

/** A transport that records every call and answers with streamable audio. */
const recordingTransport = (): { transport: VoiceTransport; calls: string[] } => {
  const calls: string[] = [];
  const transport: VoiceTransport = async (url) => {
    calls.push(url);
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'audio/mpeg' },
    });
  };
  return { transport, calls };
};

const REGISTRY = {
  voiceId: 'test-voice',
  liveModelId: 'eleven_v4',
  bakedModelId: 'eleven_v4',
  version: 1,
} as const;

/** The key the egress reads. Set for the suite; the value is not a secret. */
process.env.ELEVENLABS_API_KEY = 'test-key';

describe('the tone palette is closed (doc 32 §4)', () => {
  it('holds exactly the nine documented entries, no more and no fewer', () => {
    assert.deepEqual(
      [...TONES].sort(),
      [
        'calm-refocus',
        'celebrate-big',
        'celebrate-small',
        'gentle-after-miss',
        'naming-the-mistake',
        'quiet-encourage',
        'safety-serious',
        'thinking-together',
        'warm-open',
      ],
    );
  });

  it('is frozen — a runtime cannot grow a tenth tone', () => {
    assert.ok(Object.isFrozen(TONE_PALETTE));
    assert.ok(Object.isFrozen(TONES));
  });

  it('refuses an unknown tone at runtime, without echoing it', () => {
    assert.equal(isTone('whispers-affectionately'), false);
    assert.throws(() => assertTone('whispers-affectionately'), UnknownTone);
    try {
      assertTone('i-missed-you');
    } catch (error) {
      // The refusal must not put attacker-influenced text into a log line.
      assert.ok(error instanceof UnknownTone);
      assert.ok(!error.message.includes('i-missed-you'));
    }
  });

  it('settings lookup refuses the same way — no nearest match, no default', () => {
    assert.throws(() => voiceSettingsFor('seductive', 'k-2'), UnknownTone);
  });
});

describe('v4 tone and pacing intent', () => {
  it('uses only documented settings across all nine tones and four bands', () => {
    for (const tone of TONES) for (const band of ['k-2', '3-5', '6-8', '9-12'] as const) {
      const settings = voiceSettingsFor(tone, band);
      assert.deepEqual(Object.keys(settings).sort(), ['similarity', 'stability']);
      assert.ok(settings.stability >= 0 && settings.stability <= 1);
      assert.equal(settings.similarity, 0.75);
    }
  });
  it('retains young-child pacing and a restrained teen delivery as tags', () => {
    assert.ok(voiceTagsFor('thinking-together', 'k-2').includes('[slowly]'));
    assert.ok(voiceTagsFor('thinking-together', 'k-2').includes('[clearly]'));
    assert.ok(voiceTagsFor('celebrate-big', '9-12').includes('[matter-of-fact]'));
  });
  it('rejects inherited object properties as tones', () => {
    assert.equal(isTone('constructor'), false);
    assert.throws(() => assertTone('__proto__'), UnknownTone);
  });
});

describe('the S4 path never calls the live API (doc 32 §3)', () => {
  it('renders S4 audio from the exact frozen scripts, not a copy', () => {
    assert.equal(BAKED_PIECES['s4-young'].text, S4_SCRIPTS.young);
    assert.equal(BAKED_PIECES['s4-older'].text, S4_SCRIPTS.older);
  });

  it('a missing S4 cache is TEXT-ONLY, never a render', () => {
    assert.equal(bakedServePlan('s4-young', false), 'text-only');
    assert.equal(bakedServePlan('s4-older', false), 'text-only');
    assert.equal(bakedServePlan('s4-young', true), 'serve-cache');
  });

  it('ordinary pieces may render once on a miss; every cached piece serves', () => {
    assert.equal(bakedServePlan('greeting-first', false), 'render-then-cache');
    for (const id of BAKED_PIECE_IDS) {
      assert.equal(bakedServePlan(id, true), 'serve-cache');
    }
  });
});

describe('budget exhaustion is silent text-only (doc 32 §5)', () => {
  const spentLedger = (band: 'k-2'): VoiceBudgetLedger => ({
    reserve: async () => false,
    read: async () => ({ chars: 100_000, usd: VOICE_BUDGETS[band].dailyUsdCeiling }),
    record: async () => {
      throw new Error('a spent day must record nothing');
    },
  });

  it('makes NO provider call and returns text-only, not an error', async () => {
    const { transport, calls } = recordingTransport();
    const egress = createVoiceEgress({
      transport,
      registry: REGISTRY,
      ledger: spentLedger('k-2'),
    });

    const spoken = await egress.speakSentence({
      learnerId: 'learner-1',
      band: 'k-2',
      tone: 'thinking-together',
      text: 'Let’s look at the ones column together.',
    });

    assert.deepEqual(spoken, { kind: 'text-only', reason: 'voice-budget-spent' });
    assert.equal(calls.length, 0);
  });

  it('an open day speaks, and the debit lands against the learner-day', async () => {
    const { transport, calls } = recordingTransport();
    const ledger = inMemoryVoiceLedger();
    const egress = createVoiceEgress({ transport, registry: REGISTRY, ledger });

    const text = 'Subtract. That means take away.';
    const spoken = await egress.speakSentence({
      learnerId: 'learner-1',
      band: 'k-2',
      tone: 'gentle-after-miss',
      text,
      previousText: 'So close!',
    });

    assert.equal(spoken.kind, 'audio');
    assert.equal(calls.length, 1);
    assert.ok(calls[0]?.includes('/v1/text-to-dialogue/stream'));
    const day = await ledger.read('learner-1', new Date().toISOString().slice(0, 10));
    assert.equal(day.chars, `${voiceTagsFor('gentle-after-miss', 'k-2').join(' ')} ${text}`.length);
    assert.ok(day.usd > 0);
  });
});

describe('degraded mode is text-only, never a substitute voice (doc 32 §2)', () => {
  it('no configured voice asset -> no call, no fallback voice id', async () => {
    const { transport, calls } = recordingTransport();
    const egress = createVoiceEgress({ transport, registry: null, ledger: inMemoryVoiceLedger() });

    const spoken = await egress.speakSentence({
      learnerId: 'learner-1',
      band: '6-8',
      tone: 'thinking-together',
      text: 'What is a negative times a negative?',
    });

    assert.deepEqual(spoken, { kind: 'text-only', reason: 'no-voice-configured' });
    assert.equal(calls.length, 0);

    const clip = await egress.renderBakedClip('greeting-first');
    assert.deepEqual(clip, { kind: 'text-only' });
    assert.equal(calls.length, 0);
  });

  it('a provider failure degrades to text-only rather than throwing', async () => {
    const failing: VoiceTransport = async () => new Response(null, { status: 500 });
    const egress = createVoiceEgress({
      transport: failing,
      registry: REGISTRY,
      ledger: inMemoryVoiceLedger(),
    });

    const spoken = await egress.speakSentence({
      learnerId: 'learner-1',
      band: '3-5',
      tone: 'celebrate-small',
      text: 'That was the right move!',
    });
    assert.deepEqual(spoken, { kind: 'text-only', reason: 'voice-unavailable' });
  });
});

describe('the live face rides the sentence (ADR-112)', () => {
  const FACE = { fps: 30, names: ['jawOpen', 'browInnerUp'], frames: [[0.1, 0], [0.5, 0.2]], emotion: 'joy' };

  it('with a face host, a sentence is a performance: the SAME bytes go to A2F and to the client', async () => {
    const { transport } = recordingTransport();
    const seen: { bytes: number[]; emotion: string; intensity: string }[] = [];
    const egress = createVoiceEgress({
      transport,
      registry: REGISTRY,
      ledger: inMemoryVoiceLedger(),
      faceTransport: async ({ audio, emotion }) => {
        seen.push({
          bytes: [...audio],
          emotion: emotion.emotion,
          intensity: emotion.emotion === 'neutral' ? 'none' : emotion.intensity,
        });
        return new Response(JSON.stringify(FACE), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });
    const spoken = await egress.speakSentence({ learnerId: 'L', band: '3-5', tone: 'celebrate-small', text: 'Nice.' });
    assert.equal(spoken.kind, 'performance');
    if (spoken.kind !== 'performance') return;
    assert.deepEqual([...spoken.audio], [1, 2, 3]);
    assert.deepEqual(seen, [{ bytes: [1, 2, 3], emotion: 'joy', intensity: 'med' }]);
    assert.deepEqual(spoken.face.names, FACE.names);
    assert.equal(spoken.face.frames.length, 2);
  });

  it('a face host that fails costs the FACE, never the voice', async () => {
    const { transport } = recordingTransport();
    const egress = createVoiceEgress({
      transport,
      registry: REGISTRY,
      ledger: inMemoryVoiceLedger(),
      faceTransport: async () => new Response('boom', { status: 503 }),
    });
    const spoken = await egress.speakSentence({ learnerId: 'L', band: '3-5', tone: 'warm-open', text: 'Hi.' });
    assert.equal(spoken.kind, 'audio');
    if (spoken.kind !== 'audio') return;
    assert.deepEqual([...new Uint8Array(await new Response(spoken.stream).arrayBuffer())], [1, 2, 3]);
  });

  it('a malformed face is no face', async () => {
    const { transport } = recordingTransport();
    const egress = createVoiceEgress({
      transport,
      registry: REGISTRY,
      ledger: inMemoryVoiceLedger(),
      faceTransport: async () =>
        new Response(JSON.stringify({ fps: 30, names: ['a'], frames: [[1, 2]] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    });
    const spoken = await egress.speakSentence({ learnerId: 'L', band: '3-5', tone: 'warm-open', text: 'Hi.' });
    assert.equal(spoken.kind, 'audio');
  });

  it('without a face host nothing changes: a stream, and no A2F call', async () => {
    const { transport } = recordingTransport();
    delete process.env.AUDIO2FACE_URL;
    const egress = createVoiceEgress({ transport, registry: REGISTRY, ledger: inMemoryVoiceLedger() });
    const spoken = await egress.speakSentence({ learnerId: 'L', band: '3-5', tone: 'warm-open', text: 'Hi.' });
    assert.equal(spoken.kind, 'audio');
  });
});

describe('the face host is addressed with its bearer (ADR-112 host auth)', () => {
  const FACE = { fps: 30, names: ['jawOpen'], frames: [[0.1], [0.5]], emotion: 'joy' };
  const AUDIO = new Uint8Array([1, 2, 3]);
  const JOY = { emotion: 'joy', intensity: 'med' } as const;
  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  /** Replaces global fetch for one test, recording each call's URL and headers. */
  const stubFetch = (respond: (url: string, init: RequestInit) => Promise<Response>) => {
    const calls: { url: string; headers: Headers }[] = [];
    const stub = mock.method(globalThis, 'fetch', async (input: string | URL | Request, init: RequestInit = {}) => {
      const url = String(input);
      calls.push({ url, headers: new Headers(init.headers) });
      return respond(url, init);
    });
    return { calls, restore: () => stub.mock.restore() };
  };

  /** Sets the host env for one test and puts it back afterwards, whatever happens. */
  const withHostEnv = async (env: { url?: string; token?: string }, run: () => Promise<void>): Promise<void> => {
    const before = { url: process.env.AUDIO2FACE_URL, token: process.env.AUDIO2FACE_TOKEN };
    const apply = (url: string | undefined, token: string | undefined): void => {
      if (url === undefined) delete process.env.AUDIO2FACE_URL;
      else process.env.AUDIO2FACE_URL = url;
      if (token === undefined) delete process.env.AUDIO2FACE_TOKEN;
      else process.env.AUDIO2FACE_TOKEN = token;
    };
    apply(env.url, env.token);
    try {
      await run();
    } finally {
      apply(before.url, before.token);
    }
  };

  it('sends `Authorization: Bearer <token>` when AUDIO2FACE_TOKEN is set, trimmed', async () => {
    const { calls, restore } = stubFetch(async () => json(FACE));
    try {
      await withHostEnv({ url: 'http://face.test/', token: '  secret-token \n' }, async () => {
        const face = await renderFace(AUDIO, 'audio/mpeg', JOY);
        assert.notEqual(face, null);
        assert.equal(calls.length, 1);
        assert.equal(calls[0]?.url, 'http://face.test/v1/face');
        assert.equal(calls[0]?.headers.get('authorization'), 'Bearer secret-token');
        assert.equal(calls[0]?.headers.get('x-a2f-emotion'), 'joy');
      });
    } finally {
      restore();
    }
  });

  it('sends no Authorization header at all when the token is unset or blank', async () => {
    const { calls, restore } = stubFetch(async () => json(FACE));
    try {
      await withHostEnv({ url: 'http://face.test' }, async () => {
        await renderFace(AUDIO, 'audio/mpeg', JOY);
      });
      await withHostEnv({ url: 'http://face.test', token: '   ' }, async () => {
        await renderFace(AUDIO, 'audio/mpeg', JOY);
      });
      assert.equal(calls.length, 2);
      for (const call of calls) assert.equal(call.headers.has('authorization'), false);
    } finally {
      restore();
    }
  });

  it('an unset or blank URL is audio only: no face, and no fetch, token or not', async () => {
    const { calls, restore } = stubFetch(async () => json(FACE));
    try {
      await withHostEnv({ token: 'secret-token' }, async () => {
        assert.equal(liveFaceConfigured(), false);
        assert.equal(await renderFace(AUDIO, 'audio/mpeg', JOY), null);
      });
      await withHostEnv({ url: '  ', token: 'secret-token' }, async () => {
        assert.equal(liveFaceConfigured(), false);
        assert.equal(await renderFace(AUDIO, 'audio/mpeg', JOY), null);
      });
      assert.equal(calls.length, 0);
    } finally {
      restore();
    }
  });
});

describe('the health probe reports the face host without naming it (ADR-112)', () => {
  const calls: { url: string; headers: Headers }[] = [];
  const transport =
    (respond: (url: string, init: RequestInit) => Promise<Response>) =>
    async (url: string, init: RequestInit): Promise<Response> => {
      calls.push({ url, headers: new Headers(init.headers) });
      return respond(url, init);
    };
  const withHostEnv = async (env: { url?: string; token?: string }, run: () => Promise<void>): Promise<void> => {
    const before = { url: process.env.AUDIO2FACE_URL, token: process.env.AUDIO2FACE_TOKEN };
    const apply = (url: string | undefined, token: string | undefined): void => {
      if (url === undefined) delete process.env.AUDIO2FACE_URL;
      else process.env.AUDIO2FACE_URL = url;
      if (token === undefined) delete process.env.AUDIO2FACE_TOKEN;
      else process.env.AUDIO2FACE_TOKEN = token;
    };
    apply(env.url, env.token);
    calls.length = 0;
    try {
      await run();
    } finally {
      apply(before.url, before.token);
    }
  };

  it('no host configured: configured false, reachable null, nothing fetched', async () => {
    await withHostEnv({}, async () => {
      const health = await probeFaceHost({ transport: transport(async () => new Response('ok')) });
      assert.deepEqual(health, { configured: false, reachable: null });
      assert.equal(calls.length, 0);
    });
  });

  it('a host answering /v1/health 2xx is reachable, and the probe carries the bearer', async () => {
    await withHostEnv({ url: 'http://face.test/', token: 'secret-token' }, async () => {
      const health = await probeFaceHost({
        transport: transport(async (url) => (url.endsWith('/v1/health') ? new Response('ok') : new Response('', { status: 404 }))),
      });
      assert.deepEqual(health, { configured: true, reachable: true });
      assert.equal(calls.length, 1);
      assert.equal(calls[0]?.url, 'http://face.test/v1/health');
      assert.equal(calls[0]?.headers.get('authorization'), 'Bearer secret-token');
    });
  });

  it('a host without /v1/health is reachable when its base URL answers below 500 — an auth wall counts', async () => {
    await withHostEnv({ url: 'http://face.test' }, async () => {
      const health = await probeFaceHost({
        transport: transport(async (url) =>
          url.endsWith('/v1/health') ? new Response('', { status: 404 }) : new Response('', { status: 401 }),
        ),
      });
      assert.deepEqual(health, { configured: true, reachable: true });
      assert.deepEqual(
        calls.map((c) => c.url),
        ['http://face.test/v1/health', 'http://face.test'],
      );
      assert.equal(calls[0]?.headers.has('authorization'), false);
    });
  });

  it('a host answering /v1/health with a 5xx is configured but not reachable', async () => {
    await withHostEnv({ url: 'http://face.test' }, async () => {
      const health = await probeFaceHost({ transport: transport(async () => new Response('', { status: 503 })) });
      assert.deepEqual(health, { configured: true, reachable: false });
    });
  });

  it('a network failure is configured but not reachable, never a throw', async () => {
    await withHostEnv({ url: 'http://face.test' }, async () => {
      const health = await probeFaceHost({
        transport: transport(async () => {
          throw new TypeError('fetch failed');
        }),
      });
      assert.deepEqual(health, { configured: true, reachable: false });
    });
  });

  it('a hung host is not reachable once the probe budget is spent', async () => {
    await withHostEnv({ url: 'http://face.test' }, async () => {
      const health = await probeFaceHost({
        timeoutMs: 20,
        transport: transport(
          (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
              init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
            }),
        ),
      });
      assert.deepEqual(health, { configured: true, reachable: false });
    });
  });
});


describe('v4 dialogue contracts and failures', () => {
  const input = { learnerId: 'L', band: '6-8', tone: 'warm-open', text: 'Hello.' } as const;
  const alignment = { characters: ['H', 'i'], character_start_times_seconds: [0, 0.1], character_end_times_seconds: [0.1, 0.2] };
  it('sends one voice, v4 settings, and bounded context with no learner identity', async () => {
    const egress = createVoiceEgress({ registry: REGISTRY, ledger: inMemoryVoiceLedger(), transport: async (url, init) => {
      assert.ok(url.endsWith('/text-to-dialogue/stream?output_format=mp3_44100_128'));
      assert.deepEqual(JSON.parse(String(init.body)), {
        inputs: [{ text: '[warmly] Hello. (whispers) [0, 1] a[i] [x + y]', voice_id: 'test-voice' }], model_id: 'eleven_v4',
        settings: { stability: 0.5, similarity: 0.75 }, previous_text: 'x'.repeat(100),
      });
      return new Response('mp3', { headers: { 'content-type': 'audio/mpeg' } });
    } });
    assert.equal((await egress.speakSentence({ ...input, text: 'Hello. [whispers] [0, 1] a[i] [x + y]', previousText: 'x'.repeat(200) })).kind, 'audio');
  });
  it('refuses empty, oversized, and pre-cancelled requests before budget or network', async () => {
    const { transport, calls } = recordingTransport();
    const ledger = inMemoryVoiceLedger();
    const egress = createVoiceEgress({ registry: REGISTRY, ledger, transport });
    for (const extra of [{ text: ' ' }, { text: 'x'.repeat(2000) }, { signal: AbortSignal.abort() }]) {
      assert.equal((await egress.speakSentence({ ...input, ...extra })).kind, 'text-only');
    }
    assert.equal(calls.length, 0);
    assert.equal((await ledger.read('L', new Date().toISOString().slice(0, 10))).usd, 0);
  });
  it('reserves the incoming cost atomically across concurrent prefetches', async () => {
    const ledger = inMemoryVoiceLedger();
    const results = await Promise.all(Array.from({ length: 8 }, () => ledger.reserve('L', '2026-09-28', 1, 0.4, 1)));
    assert.equal(results.filter(Boolean).length, 2);
    assert.deepEqual(await ledger.read('L', '2026-09-28'), { chars: 2, usd: 0.8 });
  });
  it('does not dispatch when the new utterance would cross the remaining ceiling', async () => {
    const ledger = inMemoryVoiceLedger();
    const now = () => new Date('2026-09-28');
    await ledger.record('L', '2026-09-28', 1, 0.79999);
    const { transport, calls } = recordingTransport();
    const egress = createVoiceEgress({ registry: REGISTRY, ledger, transport, now });
    assert.deepEqual(await egress.speakSentence(input), { kind: 'text-only', reason: 'voice-budget-spent' });
    assert.equal(calls.length, 0);
  });
  it('cancels provider errors and refuses JSON pretending to be audio', async () => {
    for (const status of [200, 401, 429, 503]) {
      let cancelled = false;
      const egress = createVoiceEgress({ registry: REGISTRY, ledger: inMemoryVoiceLedger(), transport: async () =>
        new Response(new ReadableStream({ cancel() { cancelled = true; } }), { status, headers: { 'content-type': 'application/json' } }) });
      assert.equal((await egress.speakSentence(input)).kind, 'text-only');
      assert.equal(cancelled, true);
    }
  });
  it('cancellation reaches A2F and cannot resurrect the stopped audio', async () => {
    const controller = new AbortController();
    const { transport } = recordingTransport();
    const egress = createVoiceEgress({ registry: REGISTRY, ledger: inMemoryVoiceLedger(), transport,
      faceTransport: async ({ signal }) => {
        controller.abort();
        assert.equal(signal.aborted, true);
        return new Response(null, { status: 503 });
      } });
    assert.equal((await egress.speakSentence({ ...input, signal: controller.signal })).kind, 'text-only');
  });
  it('bakes with the same model/settings and prefers normalized timing', async () => {
    const egress = createVoiceEgress({ registry: REGISTRY, transport: async (url, init) => {
      assert.ok(url.includes('/text-to-dialogue/with-timestamps?'));
      assert.deepEqual(JSON.parse(String(init.body)), {
        inputs: [{ text: `[warmly] ${BAKED_PIECES['greeting-first'].text}`, voice_id: 'test-voice' }],
        model_id: 'eleven_v4', settings: { stability: 0.5, similarity: 0.75 },
      });
      return Response.json({ audio_base64: 'AQID', alignment: null, normalized_alignment: alignment });
    } });
    const clip = await egress.renderBakedClip('greeting-first');
    assert.equal(clip.kind, 'audio');
    if (clip.kind === 'audio') { assert.deepEqual(clip.alignment, alignment); assert.deepEqual([...clip.bytes], [1, 2, 3]); }
  });
  it('malformed baked JSON, base64, or timing fail closed', async () => {
    for (const body of ['{', JSON.stringify({ audio_base64: '!', alignment }),
      JSON.stringify({ audio_base64: 'AQID', alignment: { ...alignment, character_end_times_seconds: [0] } }),
      JSON.stringify({ audio_base64: 'AQID', alignment: { ...alignment, character_start_times_seconds: [1, 0] } }),
      JSON.stringify({ audio_base64: 'AQID' })]) {
      const egress = createVoiceEgress({ registry: REGISTRY, transport: async () => new Response(body) });
      assert.deepEqual(await egress.renderBakedClip('greeting-first'), { kind: 'text-only' });
    }
  });
  it('voice or recipe changes invalidate the baked namespace', () => {
    const original = bakedBundlePrefix('s4-young', REGISTRY);
    assert.notEqual(original, bakedBundlePrefix('s4-young', { ...REGISTRY, voiceId: 'updated-asset' }));
    assert.notEqual(original, bakedBundlePrefix('s4-young', { ...REGISTRY, version: 2 }));
    assert.equal(bakedBundlePrefix('s4-young', null), null);
    assert.ok(original?.startsWith('voice/baked/v4/'));
    assert.equal(bakedManifestSchema.safeParse({ audioDigest: '../other', alignment }).success, false);
  });
  it('reports account model access and PVC fine-tuning without exposing identifiers', async () => {
    const egress = createVoiceEgress({ registry: REGISTRY, transport: async (url) => Response.json(url.endsWith('/models')
      ? [{ model_id: 'eleven_v4', can_do_text_to_speech: true }]
      : { category: 'professional', fine_tuning: { state: { eleven_v4: 'fine_tuned' } } }) });
    assert.deepEqual(await egress.checkConfiguration(), { configured: true, modelAvailable: true, voiceCategory: 'professional', fineTuningState: 'fine_tuned' });
  });
});

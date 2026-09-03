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
import { describe, it } from 'node:test';
import { S4_SCRIPTS } from '@acme/safety';
import {
  BAKED_PIECES,
  BAKED_PIECE_IDS,
  bakedServePlan,
} from './baked.ts';
import { inMemoryVoiceLedger, VOICE_BUDGETS, type VoiceBudgetLedger } from './budget.ts';
import { createVoiceEgress, type VoiceTransport } from './eleven.ts';
import {
  TONES,
  TONE_PALETTE,
  UnknownTone,
  assertTone,
  isTone,
  voiceSettingsFor,
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
  liveModelId: 'eleven_v3',
  bakedModelId: 'eleven_v3',
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

describe('band modulation multiplies the palette (doc 32 §4)', () => {
  it('K-2 renders every tone slower and more melodic than 6-8', () => {
    for (const tone of TONES) {
      const young = voiceSettingsFor(tone, 'k-2');
      const middle = voiceSettingsFor(tone, '6-8');
      assert.ok(young.speed < middle.speed, `${tone}: K-2 speed must drop`);
      assert.ok(young.style >= middle.style, `${tone}: K-2 style must not drop`);
    }
  });

  it('9-12 pulls style DOWN — performed enthusiasm reads as condescension', () => {
    const teen = voiceSettingsFor('celebrate-big', '9-12');
    const middle = voiceSettingsFor('celebrate-big', '6-8');
    assert.ok(teen.style < middle.style);
    assert.equal(teen.speed, middle.speed);
  });

  it('stays inside the provider ranges after modulation', () => {
    for (const tone of TONES) {
      for (const band of ['k-2', '3-5', '6-8', '9-12'] as const) {
        const settings = voiceSettingsFor(tone, band);
        assert.ok(settings.speed >= 0.7 && settings.speed <= 1.2);
        assert.ok(settings.style >= 0 && settings.style <= 1);
      }
    }
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
    assert.ok(calls[0]?.includes('/v1/text-to-speech/test-voice/stream'));
    // The debit is fire-and-forget; give it the microtask it needs.
    await new Promise((resolve) => setImmediate(resolve));
    const day = await ledger.read('learner-1', new Date().toISOString().slice(0, 10));
    assert.equal(day.chars, text.length);
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

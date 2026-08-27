// The voice boundary's regression suite (doc 32 §2 §3), driving `voiceOutcome`
// with fake ports the way `fail-closed.server-test.ts` drives `coachStream`.
//
// What it holds: an unverified triple is REFUSED (never rendered — that is the
// structural "nothing learner-authored reaches the TTS payload" rule at the
// boundary), and everything after verification degrades to text-only rather
// than erroring — a band read failing, the egress refusing a tone, a socket
// dying. Voice is a garnish; the words are already on the child's screen.
//
// `.server-test.ts` because every module on this path opens with
// `import 'server-only'` and needs node's `react-server` condition.
// SOT: docs/pack/32-tutor-voice-tone.md §2 §3 · apps/web/lib/voice-utterance.ts
// SOT-KEYWORDS: voice service test refused unverified text only degradation band ports
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ProtectedCtx } from '../../core/protected-operation.ts';
import { voiceOutcome, type SpeakSentence, type VoicePorts } from './voice.service.ts';

const CTX: ProtectedCtx = { learnerId: 'learner-1', isLearner: true };

const speaks = (): { speak: SpeakSentence; spokenFor: string[] } => {
  const spokenFor: string[] = [];
  const speak: SpeakSentence = async (input) => {
    spokenFor.push(input.learnerId);
    return {
      kind: 'audio',
      contentType: 'audio/mpeg',
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]));
          controller.close();
        },
      }),
    };
  };
  return { speak, spokenFor };
};

const portsWith = (overrides: Partial<VoicePorts>): VoicePorts => {
  const { speak } = speaks();
  return {
    verifyUtterance: () => true,
    loadGradeBand: async () => 'k-2',
    speak,
    ...overrides,
  };
};

const INPUT = {
  text: 'Subtract. That means take away.',
  previousText: 'So close!',
  tone: 'gentle-after-miss',
  tag: 'tag-under-test',
};

describe('the voice boundary (doc 32)', () => {
  it('REFUSES an unverified triple and never reaches the egress', async () => {
    const { speak, spokenFor } = speaks();
    const outcome = await voiceOutcome(INPUT, CTX, portsWith({ verifyUtterance: () => false, speak }));
    assert.deepEqual(outcome, { kind: 'refused' });
    assert.equal(spokenFor.length, 0);
  });

  it('speaks a verified triple, budget-keyed by ctx and never by input', async () => {
    const { speak, spokenFor } = speaks();
    const outcome = await voiceOutcome(INPUT, CTX, portsWith({ speak }));
    assert.equal(outcome.kind, 'audio');
    assert.deepEqual(spokenFor, [CTX.learnerId]);
  });

  it('a failed band read is text-only, not an error at a child', async () => {
    const outcome = await voiceOutcome(
      INPUT,
      CTX,
      portsWith({
        loadGradeBand: async () => {
          throw new Error('band store down');
        },
      }),
    );
    assert.deepEqual(outcome, { kind: 'text-only' });
  });

  it('an egress refusal (closed palette) is text-only past the boundary', async () => {
    const outcome = await voiceOutcome(
      { ...INPUT, tone: 'not-a-palette-key' },
      CTX,
      portsWith({
        speak: async () => {
          throw new Error('UnknownTone');
        },
      }),
    );
    assert.deepEqual(outcome, { kind: 'text-only' });
  });
});

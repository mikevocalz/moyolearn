// SOT-KEYWORDS: pcm mono downmix test whisper transcribe
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toMono } from './pcm.ts';

describe('toMono', () => {
  it('passes a mono capture through untouched', () => {
    const only = new Float32Array([0.25, -0.5, 1]);
    assert.equal(toMono([only]), only);
  });

  it('averages channels rather than taking the first', () => {
    // The case this exists for: a child nearer the right microphone. Channel 0
    // alone would be near-silence and Whisper would transcribe the quiet half
    // of the room.
    const quiet = new Float32Array([0, 0, 0]);
    const loud = new Float32Array([0.8, -0.6, 0.4]);
    const mixed = toMono([quiet, loud]);
    assert.deepEqual([...mixed].map((v) => +v.toFixed(4)), [0.4, -0.3, 0.2]);
  });

  it('returns an empty buffer for a capture with no channels', () => {
    assert.equal(toMono([]).length, 0);
  });
});

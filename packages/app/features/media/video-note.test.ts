// The clock the recorder shows. Small, but it is the one number a user reads
// while deciding whether to keep talking, and an off-by-one there is visible.
// SOT-KEYWORDS: video note clock format duration test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatClock, VIDEO_MAX_SECONDS } from './video-note.constants.ts';

describe('formatClock', () => {
  it('pads seconds so the number does not jitter in width', () => {
    assert.equal(formatClock(7), '0:07');
    assert.equal(formatClock(67), '1:07');
  });

  it('renders the cap the UI shows beside the elapsed time', () => {
    assert.equal(formatClock(VIDEO_MAX_SECONDS), '3:00');
  });

  it('floors rather than rounds, so it never shows a time not yet reached', () => {
    assert.equal(formatClock(9.99), '0:09');
  });

  it('clamps below zero instead of rendering a negative clock', () => {
    assert.equal(formatClock(-5), '0:00');
  });
});

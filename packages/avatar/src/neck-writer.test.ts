/**
 * Exactly one writer may touch the neck/head bones per frame. These cases are
 * the mechanical form of that rule — the seam between the GNM head and the
 * SMPL-X body is where a second writer shows up as an un-debuggable twist.
 *
 * Ported from the gnm-avatar reference suite; the GNM locked-joint case moved
 * to `gnm/model.test.ts`, where the synthetic container lives (doc 22 §3).
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2
 * SOT-KEYWORDS: neck writer token test single-writer frame guard body-owned
 */
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  claimNeckFrame,
  claimNeckWriter,
  resetNeckWriterForTests,
} from './neck-writer.ts';

describe('neck single-writer token', () => {
  beforeEach(() => resetNeckWriterForTests());

  it('the current owner may write once per frame', () => {
    const token = claimNeckWriter();
    assert.doesNotThrow(() => claimNeckFrame(0, token));
    assert.doesNotThrow(() => claimNeckFrame(1, token));
    assert.doesNotThrow(() => claimNeckFrame(2, token));
  });

  it('two writers claiming the neck in one frame throws', () => {
    const first = claimNeckWriter();
    const second = claimNeckWriter(); // second claim invalidates the first
    assert.doesNotThrow(() => claimNeckFrame(0, second));
    assert.throws(() => claimNeckFrame(0, first), /non-owner/);
  });

  it('the same writer writing twice in one frame throws', () => {
    const token = claimNeckWriter();
    claimNeckFrame(7, token);
    assert.throws(() => claimNeckFrame(7, token), /twice in frame 7/);
  });

  it('writing without any claimed token throws', () => {
    assert.throws(() => claimNeckFrame(0, Symbol('imposter')), /non-owner/);
  });
});

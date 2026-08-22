/**
 * The neck-align document is one matrix, and every failure mode it has is
 * silent — a wrong space, a truncated matrix, or a transform baked for a
 * different identity all render a head that is merely *slightly* wrong. These
 * cases make each of those loud.
 *
 * Ported from the gnm-avatar reference suite. The reference's third case
 * recomputed the identity hash from `identity.json`; after the rebake the hash
 * comes off the head container instead, so the case here asserts the
 * comparison rather than the cryptography — `crypto/sha256.test.ts` covers the
 * hashing itself against the standard vectors.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §2, §6.3
 * SOT-KEYWORDS: neck align test provenance matrix space hash mismatch
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  NECK_ALIGN_FROM,
  NECK_ALIGN_TO,
  assertNeckAlign,
  type NeckAlign,
} from './neck-align.ts';

const SHA = '432f87330687d6f3c1dded5dd184a55ccd3b4211377fa7dd4d354860403c1958';

const valid = (): NeckAlign => ({
  matrix: [
    0.9988159427037878, -0.0015351708662880723, -0.00705706589565698, 0,
    0.0006103505880907977, 0.9904666089712539, -0.1290773811054639, 0,
    0.007196276870991121, 0.12906969470521285, 0.9904416559473858, 0,
    -0.003430711077966993, -0.2783930808296125, 0.005049482747388839, 1,
  ],
  space: { from: NECK_ALIGN_FROM, to: NECK_ALIGN_TO },
  identitySha256: SHA,
});

describe('assertNeckAlign', () => {
  it('accepts a well-formed document', () => {
    assert.doesNotThrow(() => assertNeckAlign(valid(), SHA));
  });

  it('rejects a space mismatch', () => {
    const doc = valid();
    doc.space = { from: 'gnm-model', to: 'world' };
    assert.throws(() => assertNeckAlign(doc, SHA), /space mismatch/);
  });

  it('rejects a matrix that is not 16 finite numbers', () => {
    const short = valid();
    short.matrix = short.matrix.slice(0, 12);
    assert.throws(() => assertNeckAlign(short, SHA), /16 finite numbers/);

    const nan = valid();
    nan.matrix[5] = Number.NaN;
    assert.throws(() => assertNeckAlign(nan, SHA), /16 finite numbers/);
  });

  it('rejects a transform baked for a different identity', () => {
    assert.throws(
      () => assertNeckAlign(valid(), 'f'.repeat(64)),
      /identity hash mismatch/
    );
  });

  it('names both hashes in the error, so the mismatch is diagnosable', () => {
    try {
      assertNeckAlign(valid(), 'f'.repeat(64));
      assert.fail('expected a throw');
    } catch (error) {
      const message = String(error);
      assert.ok(message.includes(SHA), 'the document hash must appear');
      assert.ok(message.includes('f'.repeat(64)), 'the container hash must appear');
    }
  });
});

// The shipped documents are CDN artifacts, not repo assets. Point this at a
// local mirror to check the real ones:
//   MOYO_AVATAR_ASSETS=~/.cache/moyo/avatar pnpm --filter @acme/avatar test
const assetRoot = process.env.MOYO_AVATAR_ASSETS;

describe('the shipped neck-align.json', { skip: !assetRoot }, () => {
  it('validates against the identity the head container was baked from', () => {
    const doc = JSON.parse(
      readFileSync(join(assetRoot as string, 'body/neck-align.json'), 'utf8')
    ) as NeckAlign;
    assert.doesNotThrow(() => assertNeckAlign(doc, doc.identitySha256));
    assert.equal(doc.space.from, NECK_ALIGN_FROM);
    assert.equal(doc.space.to, NECK_ALIGN_TO);

    // Uniform-ish scale: the three basis column lengths must agree closely, or
    // the head is being stretched onto the neck rather than placed on it.
    const m = doc.matrix;
    const col = (i: number) =>
      Math.hypot(m[i * 4] as number, m[i * 4 + 1] as number, m[i * 4 + 2] as number);
    const lengths = [col(0), col(1), col(2)];
    for (const length of lengths) {
      assert.ok(length > 0.9 && length < 1.1, `basis column length ${length}`);
      assert.ok(
        Math.abs(length - (lengths[0] as number)) < 1e-6,
        'basis columns must share one scale'
      );
    }
  });
});

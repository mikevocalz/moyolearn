// The tone table's promises, and the register that must never be substituted.
//
// `safety-serious` shipped with a voice recipe and no render entry, so
// `toneRenderFor` fell through to `thinking-together`: through the whole S4
// safety script the face rendered a neutral thinking expression while the voice
// delivered the safety register. The type now catches a missing tone at compile
// time; these catch what a type cannot see — that this register is never
// cheerful, that the two packages describe one delivery, and that the crisis
// pieces reach the register at all.
//
// IT READS THE VOICE PACKAGE'S SOURCE RATHER THAN IMPORTING IT, deliberately.
// `check-voice-egress` holds runtime importers of `@acme/voice` to seven named
// surfaces so learner text can never meet the TTS credential, and growing that
// allowlist for a test would be spending a safety rule on convenience. Reading
// the file is also the more direct expression of the assertion: the bug was two
// FILES disagreeing, so the test compares the two files. Every parse asserts
// its own yield, so a regex that stops matching fails loudly instead of passing
// on an empty set.
// SOT: packages/app/features/tutor/tutor-tone.ts · packages/voice/src/tones.ts
// SOT-KEYWORDS: tutor tone test safety serious crisis render palette exhaustive fallback drift

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { S4_SCRIPTS } from '@acme/safety';
import { TONE_RENDER, isToneKey, toneRenderFor } from './tutor-tone.ts';

const repoRoot = join(import.meta.dirname, '../../../..');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

/** Top-level quoted keys of the palette object, in source order. */
function paletteKeys(): string[] {
  const source = read('packages/voice/src/tones.ts');
  const body = source.slice(source.indexOf('TONE_PALETTE'));
  /*
    `m[1]` is `string | undefined` under `noUncheckedIndexedAccess`, and a
    capture group that did not participate is a real possibility the compiler is
    right to raise — so it is filtered rather than asserted away.
  */
  const keys = [...body.matchAll(/^ {2}'([a-z-]+)':/gm)]
    .map((m) => m[1])
    .filter((k): k is string => k !== undefined);
  assert.ok(keys.length >= 5, `parsed ${keys.length} palette keys — the shape of tones.ts changed`);
  return keys;
}

test('every palette tone has a render recipe', () => {
  assert.deepEqual(
    Object.keys(TONE_RENDER).sort(),
    paletteKeys().sort(),
    'a tone with a voice and no face renders the wrong register silently',
  );
});

test('the safety register is calm and concerned, never cheerful and never angry', () => {
  const render = toneRenderFor('safety-serious');
  assert.notEqual(render.emotion, 'happiness', 'a child being handed to a person is not celebrated');
  assert.notEqual(render.emotion, 'anger', 'this register must never read as anger to a child');
  assert.ok(
    render.intensity <= 0.3,
    `expression must stay low — concern FOR a child, not sadness AT them (got ${render.intensity})`,
  );

  /*
    The voice half is the palette's own, and the two packages have to describe
    one delivery. If the palette's stability moves and this does not, the face
    and the voice have drifted again in the other direction.
  */
  const tones = read('packages/voice/src/tones.ts');
  const entry = tones.slice(tones.indexOf("'safety-serious': {"));
  const stability = entry.match(/live:\s*\{\s*stability:\s*([\d.]+)/);
  assert.ok(stability, "could not read safety-serious's live stability from tones.ts");
  assert.equal(render.stability, Number(stability[1]));
});

test('the crisis pieces carry the safety register, not a substitute', () => {
  const baked = read('packages/voice/src/baked.ts');
  const pieces = [...baked.matchAll(/'(s4-[a-z]+)':\s*\{[^}]*tone:\s*'([a-z-]+)'[^}]*crisis:\s*(true|false)/g)];
  assert.equal(pieces.length, 2, `expected two S4 pieces, parsed ${pieces.length}`);

  for (const match of pieces) {
    const [, id, tone, crisis] = match;
    assert.ok(id && tone && crisis, 'a parsed S4 piece is missing a capture group');
    assert.equal(tone, 'safety-serious', `${id} must carry the safety register`);
    assert.equal(crisis, 'true', `${id} must never be live-rendered`);
    assert.ok(isToneKey(tone), `${id}'s tone must resolve to a render recipe`);
    /*
      By VALUE, not by reference: a reference check passes the moment someone
      writes the thinking recipe out as a fresh literal, which is the exact
      shape the original bug would take if it came back.
    */
    assert.notDeepEqual(
      toneRenderFor(tone),
      TONE_RENDER['thinking-together'],
      `${id} resolved to the thinking face — the substitution this test exists to catch`,
    );
  }

  // The scripts are what the register delivers. `@acme/safety` is fixed data and
  // pure screens, and the egress gate names it as deliberately not forbidden.
  assert.ok(S4_SCRIPTS.young.length > 0 && S4_SCRIPTS.older.length > 0);
});

test('an unknown tone is rejected rather than substituted', () => {
  assert.equal(isToneKey('encouraging'), false);
  assert.equal(isToneKey('safety-serious'), true);
});

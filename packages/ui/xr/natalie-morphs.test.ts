// The face filter, pinned — because the failure it prevents is a face that
// STICKS, and a stuck face reads as a crashed avatar rather than as a bug.
// SOT: packages/ui/xr/natalie-morphs.ts
// SOT-KEYWORDS: natalie morph targets test release zero identity floor arkit weights

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MORPH_FLOOR, natalieMorphs, type NatalieMorph } from './natalie-morphs.ts';

const weightOf = (list: readonly NatalieMorph[], target: string) =>
  list.find((entry) => entry.target === target)?.weight;

test('only the shapes that can be seen are sent', () => {
  const sent = natalieMorphs({ jawOpen: 0.4, browInnerUp: MORPH_FLOOR / 2, mouthSmile: 0 }, []);
  assert.equal(sent.length, 1);
  assert.equal(weightOf(sent, 'jawOpen'), 0.4);
});

test('a shape that drops away is released, exactly once', () => {
  const open = natalieMorphs({ jawOpen: 0.6 }, []);
  const closing = natalieMorphs({ jawOpen: 0 }, open);
  /*
    The zero has to be SENT. The renderer holds the last weight it was told, so
    a dropped entry is a jaw that stays open — the mouth frozen mid-word, which
    is the exact thing a child would read as Natalie having crashed.
  */
  assert.equal(weightOf(closing, 'jawOpen'), 0);

  const closed = natalieMorphs({ jawOpen: 0 }, closing);
  assert.equal(closed.length, 0, 'the release was sent a second time');
});

test('a still face costs nothing — the same array comes back', () => {
  const first = natalieMorphs({ jawOpen: 0.2, eyeBlinkLeft: 1 }, []);
  const second = natalieMorphs({ eyeBlinkLeft: 1, jawOpen: 0.2 }, first);
  assert.equal(second, first, 'an unchanged face produced a new array');
});

test('weights are clamped and nonsense is dropped', () => {
  const sent = natalieMorphs({ jawOpen: 4, browDownLeft: -2, tongueOut: Number.NaN }, []);
  assert.equal(weightOf(sent, 'jawOpen'), 1);
  assert.equal(weightOf(sent, 'browDownLeft'), undefined);
  assert.equal(weightOf(sent, 'tongueOut'), undefined);
});

test('a blink survives being asked for on consecutive frames', () => {
  /* The channel that made this file necessary: 52 shapes, one of them moving. */
  let previous: readonly NatalieMorph[] = [];
  const seen: (number | undefined)[] = [];
  for (const weight of [0, 0.5, 1, 0.5, 0]) {
    previous = natalieMorphs({ eyeBlinkLeft: weight, jawOpen: 0.1 }, previous);
    seen.push(weightOf(previous, 'eyeBlinkLeft'));
  }
  assert.deepEqual(seen, [undefined, 0.5, 1, 0.5, 0]);
});

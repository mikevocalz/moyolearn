// Properties the generator and checker hold together across 500 seeds.
//
// The leak check here is written independently of the generator's: the
// generator compares rational values, this test compares printed tokens. Two
// different definitions agreeing is the evidence; one definition quoted twice
// would be a tautology.
// SOT: docs/work/pr-100/contract.md §Practice sets
// SOT-KEYWORDS: practice generator test seeds verify unique prompt answer leak determinism checker drop
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkPracticeItem, PRACTICE_CHECKER_VERSION, verifyPracticeItems } from './practice-checker.ts';
import {
  defaultTagsForBand,
  generatePracticeSet,
  PRACTICE_SKILL_TAGS,
  type GeneratedItem,
} from './practice-generator.ts';
import { VOICE_BANDS } from './voice-band.ts';

const SEEDS = 500;
const ITEMS_PER_SET = 4;

/* Every number a prompt shows, fractions kept whole: "1/2 + 1/3" -> ["1/2", "1/3"]. */
const printedNumbers = (prompt: string): string[] =>
  (prompt.replaceAll('−', '-').match(/-?\d+(?:\.\d+)?(?:\/\d+)?/g) ?? []).map((token) =>
    token.replace(/^-?0+(?=\d)/, (match) => (match.startsWith('-') ? '-' : '')),
  );

const answerAppearsInPrompt = (item: GeneratedItem): boolean =>
  printedNumbers(item.prompt).includes(item.answer.replaceAll('−', '-'));

describe('practice generator across 500 seeds', () => {
  const sets = Array.from({ length: SEEDS }, (_, index) => {
    const band = VOICE_BANDS[index % VOICE_BANDS.length]!;
    return {
      seed: `seed-${String(index)}`,
      band,
      items: generatePracticeSet({
        seed: `seed-${String(index)}`,
        skillTags: PRACTICE_SKILL_TAGS,
        band,
        count: ITEMS_PER_SET,
      }),
    };
  });

  it('emits a full set for every seed', () => {
    for (const set of sets) assert.equal(set.items.length, ITEMS_PER_SET, set.seed);
  });

  it('every emitted item verifies through checkExactMath', () => {
    for (const set of sets) {
      const { kept, dropped } = verifyPracticeItems(set.items);
      assert.deepEqual(dropped, [], `${set.seed}: ${JSON.stringify(dropped)}`);
      assert.equal(kept.length, set.items.length);
      for (const item of kept) assert.equal(item.checkerVersion, PRACTICE_CHECKER_VERSION);
    }
  });

  it('never prints the answer among the prompt numbers', () => {
    for (const set of sets) {
      for (const item of set.items) {
        assert.equal(answerAppearsInPrompt(item), false, `${set.seed}: ${item.prompt} -> ${item.answer}`);
      }
    }
  });

  it('no two items in a set share a prompt', () => {
    for (const set of sets) {
      const prompts = new Set(set.items.map((item) => item.prompt));
      assert.equal(prompts.size, set.items.length, set.seed);
    }
  });

  it('is deterministic for a seed', () => {
    const first = sets[7]!;
    const again = generatePracticeSet({
      seed: first.seed,
      skillTags: PRACTICE_SKILL_TAGS,
      band: first.band,
      count: ITEMS_PER_SET,
    });
    assert.deepEqual(again, first.items);
  });

  it('falls back to the band defaults when no requested tag is known', () => {
    const items = generatePracticeSet({ seed: 'unknown-tags', skillTags: ['percent', 'word-problems'], band: '3-5', count: 6 });
    const allowed = new Set(defaultTagsForBand('3-5'));
    assert.equal(items.length, 6);
    for (const item of items) assert.ok(allowed.has(item.skillTag), item.skillTag);
  });
});

describe('practice checker', () => {
  it('drops a wrong arithmetic key', () => {
    const { kept, dropped } = verifyPracticeItems([
      { id: 'a', skillTag: 'addition-within-20', prompt: 'What is 2 + 2?', answer: '5' },
      { id: 'b', skillTag: 'addition-within-20', prompt: 'What is 2 + 2?', answer: '4' },
    ]);
    assert.deepEqual(kept.map((item) => item.id), ['b']);
    assert.deepEqual(dropped, [{ id: 'a', skillTag: 'addition-within-20', reason: 'not-equivalent' }]);
  });

  it('checks an equation by substituting the root into the printed sides', () => {
    assert.deepEqual(checkPracticeItem('Solve for x: 3x − 4 = 11', '5'), { ok: true });
    assert.deepEqual(checkPracticeItem('Solve for x: 3x − 4 = 11', '4'), { ok: false, reason: 'not-equivalent' });
    assert.deepEqual(checkPracticeItem('Solve for x: 2x + 1 = 4', '3/2'), { ok: true });
    assert.deepEqual(checkPracticeItem('Solve for x: x/4 − 2 = 1', '12'), { ok: true });
    assert.deepEqual(checkPracticeItem('Solve for x: 5x + 2 = 2x − 7', '-3'), { ok: true });
  });

  it('refuses what it cannot read instead of guessing', () => {
    assert.equal(checkPracticeItem('What is 25% of 80?', '20').ok, false);
    assert.equal(checkPracticeItem('Which is larger, 3/4 or 2/3?', '3/4').ok, false);
    assert.equal(checkPracticeItem('Solve for x: 2x + y = 7', '3').ok, false);
    assert.equal(checkPracticeItem('What is 2 + 2?', '').ok, false);
  });
});

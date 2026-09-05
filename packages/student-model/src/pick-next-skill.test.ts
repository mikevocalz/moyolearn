// pickNextSkill — the branch that decides what a learner is told they are
// working on next. The `seed` case is the one worth pinning: it is the only
// branch that returns a skill the learner has no facts for, and a caller that
// renders it as observed work invents a history.
// SOT: ./skills.ts · apps/web/app/api/tutor/next/route.ts
// SOT-KEYWORDS: pick next skill test review mastery seed due boundary
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { pickNextSkill } from './skills.ts';
import { masteryFact, reviewFact, type DerivedFact } from './facts.ts';

const NOW = '2026-09-05T12:00:00.000Z';
const SEEDS = ['Number sense', 'Fractions'] as const;

// Facts come from their own constructors rather than object literals: the
// constructors own the shape, and a hand-written stand-in drifts the day one of
// them gains a field.
const review = (skillTitle: string, dueAt: string): DerivedFact =>
  reviewFact({
    id: `r-${skillTitle}`,
    learnerId: 'l1',
    skillId: skillTitle,
    skillTitle,
    dueAt,
    intervalDays: 1,
    derivedFrom: ['s1'],
    observedAt: new Date(NOW),
  });

const mastery = (skillTitle: string, p: number): DerivedFact =>
  masteryFact({
    id: `m-${skillTitle}`,
    learnerId: 'l1',
    skillId: skillTitle,
    skillTitle,
    p,
    attempts: 3,
    derivedFrom: ['s1'],
    observedAt: new Date(NOW),
  });

test('no facts yields a seed, and says so', () => {
  const got = pickNextSkill([], NOW, SEEDS, () => 1);
  assert.equal(got.source, 'seed');
  assert.equal(got.skillTitle, 'Fractions');
});

test('a due review beats a weaker mastery — spacing asked for its slot', () => {
  const facts = [mastery('Fractions', 0.1), review('Order of operations', '2026-09-04T00:00:00.000Z')];
  const got = pickNextSkill(facts, NOW, SEEDS);
  assert.equal(got.source, 'review');
  assert.equal(got.skillTitle, 'Order of operations');
});

test('a review not yet due does not count as due', () => {
  const facts = [mastery('Fractions', 0.4), review('Word problems', '2026-09-06T00:00:00.000Z')];
  const got = pickNextSkill(facts, NOW, SEEDS);
  assert.equal(got.source, 'mastery');
  assert.equal(got.skillTitle, 'Fractions');
});

test('due is inclusive at the boundary', () => {
  const got = pickNextSkill([review('Fractions', NOW)], NOW, SEEDS);
  assert.equal(got.source, 'review');
});

test('weakest mastery wins, not the first one seen', () => {
  const facts = [mastery('Fractions', 0.8), mastery('Word problems', 0.2), mastery('Angles', 0.5)];
  const got = pickNextSkill(facts, NOW, SEEDS);
  assert.equal(got.source, 'mastery');
  assert.equal(got.skillTitle, 'Word problems');
});

test('mastery facts alone never report themselves as seeded', () => {
  const got = pickNextSkill([mastery('Angles', 0.9)], NOW, SEEDS);
  assert.notEqual(got.source, 'seed');
});

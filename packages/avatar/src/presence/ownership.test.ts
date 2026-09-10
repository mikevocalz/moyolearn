/**
 * The ownership invariant, asserted on synthetic layers rather than only on the
 * real table. A test that checks the real table passes today and keeps passing
 * if `ownershipProblems` is broken to return nothing — the interesting cases
 * are the ones the repo does not contain.
 *
 * SOT: ./ownership.ts
 * SOT-KEYWORDS: pose compositor ownership test double owned unowned modulator layer
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CLAIMED_JOINTS, LAYERS, ownershipProblems } from './ownership.ts';

describe('joint ownership', () => {
  it('the shipped table is clean', () => {
    assert.deepEqual(ownershipProblems(), []);
  });

  it('every claimed joint is a DEF bone — the others deform nothing', () => {
    const notDeform = CLAIMED_JOINTS.filter((j) => !j.startsWith('DEF-'));
    assert.deepEqual(notDeform, [], 'ORG and MCH bones move the skeleton and not the skin');
  });

  /*
    The synthetic layers use placeholder joint names on purpose. The invariant
    is name-agnostic, and borrowing a real bone name here would suggest the
    assertion depends on the rig — it does not, and the build check bans
    claimed names outside the two files that derive them for exactly that
    reason.
  */
  it('two owners on one joint is a problem, not a blend', () => {
    const problems = ownershipProblems([
      { name: 'a', owns: ['joint-a'], modulates: [], why: '' },
      { name: 'b', owns: ['joint-a'], modulates: [], why: '' },
    ]);
    assert.equal(problems.length, 1);
    assert.equal(problems[0]?.kind, 'double-owned');
    assert.deepEqual(problems[0]?.layers, ['a', 'b']);
  });

  it('a modulator on an unowned joint has no base to add to', () => {
    const problems = ownershipProblems([
      { name: 'a', owns: ['joint-a'], modulates: [], why: '' },
      { name: 'b', owns: [], modulates: ['joint-b'], why: '' },
    ]);
    assert.equal(problems.length, 1);
    assert.equal(problems[0]?.kind, 'unowned');
    assert.equal(problems[0]?.joint, 'joint-b');
  });

  it('many modulators on one owned joint is the normal case', () => {
    assert.deepEqual(
      ownershipProblems([
        { name: 'base', owns: ['joint-a'], modulates: [], why: '' },
        { name: 'life', owns: [], modulates: ['joint-a'], why: '' },
        { name: 'speech', owns: [], modulates: ['joint-a'], why: '' },
      ]),
      [],
    );
  });

  it('the life layer may not reach the head chain — cadence owns it', () => {
    const life = LAYERS.find((l) => l.name === 'life');
    const cadence = LAYERS.find((l) => l.name === 'head-cadence');
    assert.ok(life && cadence);
    for (const joint of cadence.modulates) {
      assert.ok(!life.modulates.includes(joint), `${joint} is modulated by both life and head-cadence`);
    }
  });
});

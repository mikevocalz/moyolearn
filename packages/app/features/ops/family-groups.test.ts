// The Families read model's pure half — the rollup and join judgement calls
// that earn a test: stamp-first membership, aggregate honesty, and the
// attention-first ordering (ADR-109 replaced the name-text derivation these
// tests used to cover).
// SOT-KEYWORDS: families rollup join stamp test crm aggregate value attention
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attachRollups,
  familyRollup,
  leadValueNumber,
  leadsOfFamily,
  type FamilyName,
} from './family-groups.ts';
import type { Lead, Stage } from './ops.data.ts';

const lead = (family: string, stage: Stage, over: Partial<Lead> = {}): Lead => ({
  id: Math.random().toString(36).slice(2),
  family,
  learner: 'Daniel',
  subject: 'Fractions',
  stage,
  owner: 'Amara',
  nextSession: '—',
  sessions: 0,
  value: '$0',
  attendance: { suppressed: true },
  needsAttention: false,
  ...over,
});

const chen: FamilyName = { id: 'f1', name: 'The Chen family' };
const okafor: FamilyName = { id: 'f2', name: 'The Okafor family' };

describe('leadsOfFamily', () => {
  it('joins by the familyId stamp first', () => {
    const rows = [
      lead('The Chen family', 'Inquiry', { familyId: 'f1' }),
      lead('The Chen family', 'Proposal', { familyId: 'f2' }),
    ];
    // The second row SPELLS Chen but is stamped Okafor — its stamp is its
    // answer, never the spelling.
    assert.equal(leadsOfFamily(chen, rows).length, 1);
    assert.equal(leadsOfFamily(okafor, rows).length, 1);
  });

  it('falls back to a trimmed name match only for unstamped rows', () => {
    const rows = [
      lead('  The Chen family  ', 'Inquiry'),
      lead('The Chen family', 'Enrolled', { familyId: 'f1' }),
    ];
    assert.equal(leadsOfFamily(chen, rows).length, 2);
  });

  it('keeps a renamed household attached to its stamped leads', () => {
    const renamed: FamilyName = { id: 'f1', name: 'The Chen-Park family' };
    const rows = [lead('The Chen family', 'Inquiry', { familyId: 'f1' })];
    assert.equal(leadsOfFamily(renamed, rows).length, 1);
  });
});

describe('familyRollup', () => {
  it('sums the value from the display strings the rows carry', () => {
    const rollup = familyRollup([
      lead('Chen', 'Inquiry', { value: '$1,080' }),
      lead('Chen', 'Enrolled', { value: '$495' }),
    ]);
    assert.equal(rollup.totalValue, '$1,575');
    assert.equal(rollup.leads, 2);
  });

  it('lists the stages present in pipeline order, deduplicated', () => {
    const rollup = familyRollup([
      lead('Chen', 'Enrolled'),
      lead('Chen', 'Inquiry'),
      lead('Chen', 'Inquiry'),
    ]);
    assert.deepEqual(rollup.stages, ['Inquiry', 'Enrolled']);
  });

  it('flags the household when ANY of its leads needs attention', () => {
    const rollup = familyRollup([
      lead('Chen', 'Inquiry'),
      lead('Chen', 'At risk', { needsAttention: true }),
    ]);
    assert.equal(rollup.needsAttention, true);
  });
});

describe('attachRollups', () => {
  it('renders every household — zero pipeline rows is a real record, not a gap', () => {
    const groups = attachRollups([chen, okafor], [lead('The Chen family', 'Inquiry', { familyId: 'f1' })]);
    assert.equal(groups.length, 2);
    const empty = groups.find((g) => g.id === 'f2');
    assert.equal(empty?.leads, 0);
    assert.equal(empty?.totalValue, '$0');
    assert.deepEqual(empty?.stages, []);
  });

  it('surfaces attention households before the alphabet', () => {
    const alvarez: FamilyName = { id: 'a', name: 'Alvarez' };
    const zimmer: FamilyName = { id: 'z', name: 'Zimmer' };
    const groups = attachRollups(
      [alvarez, zimmer],
      [
        lead('Alvarez', 'Inquiry', { familyId: 'a' }),
        lead('Zimmer', 'At risk', { familyId: 'z', needsAttention: true }),
      ],
    );
    assert.deepEqual(
      groups.map((g) => g.family),
      ['Zimmer', 'Alvarez'],
    );
  });

  it('carries the family row id — what makes a row openable', () => {
    const groups = attachRollups([chen], []);
    assert.equal(groups[0]?.id, 'f1');
  });
});

describe('leadValueNumber', () => {
  it('reads the whole-dollar display string back to a number', () => {
    assert.equal(leadValueNumber('$1,080'), 1080);
  });

  it('treats an unparseable value as zero rather than NaN', () => {
    assert.equal(leadValueNumber('—'), 0);
  });
});

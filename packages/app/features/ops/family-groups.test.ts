// The interim Families derivation — the grouping judgement calls that earn a
// test: key hygiene, aggregate honesty, and the attention-first ordering.
// SOT-KEYWORDS: families grouping derived test crm aggregate value attention
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { familiesFrom, leadValueNumber } from './family-groups.ts';
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

describe('familiesFrom', () => {
  it('groups leads by family text and counts them', () => {
    const groups = familiesFrom([
      lead('The Chen family', 'Inquiry'),
      lead('The Chen family', 'Enrolled'),
      lead('The Okafor family', 'Proposal'),
    ]);
    assert.equal(groups.length, 2);
    const chen = groups.find((g) => g.family === 'The Chen family');
    assert.equal(chen?.leads, 2);
  });

  it('sums the group value from the display strings the rows carry', () => {
    const groups = familiesFrom([
      lead('Chen', 'Inquiry', { value: '$1,080' }),
      lead('Chen', 'Enrolled', { value: '$495' }),
    ]);
    assert.equal(groups[0]?.totalValue, '$1,575');
  });

  it('lists the stages present in pipeline order, deduplicated', () => {
    const groups = familiesFrom([
      lead('Chen', 'Enrolled'),
      lead('Chen', 'Inquiry'),
      lead('Chen', 'Inquiry'),
    ]);
    assert.deepEqual(groups[0]?.stages, ['Inquiry', 'Enrolled']);
  });

  it('flags the group when ANY of its leads needs attention', () => {
    const groups = familiesFrom([
      lead('Chen', 'Inquiry'),
      lead('Chen', 'At risk', { needsAttention: true }),
    ]);
    assert.equal(groups[0]?.needsAttention, true);
  });

  it('surfaces attention groups before the alphabet', () => {
    const groups = familiesFrom([
      lead('Alvarez', 'Inquiry'),
      lead('Zimmer', 'At risk', { needsAttention: true }),
    ]);
    assert.deepEqual(
      groups.map((g) => g.family),
      ['Zimmer', 'Alvarez'],
    );
  });

  // A row with a blank family has nothing to group under — inventing an
  // "(unknown)" household would put a family that does not exist on screen.
  it('drops rows whose family text is blank', () => {
    const groups = familiesFrom([lead('  ', 'Inquiry'), lead('Chen', 'Inquiry')]);
    assert.deepEqual(
      groups.map((g) => g.family),
      ['Chen'],
    );
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

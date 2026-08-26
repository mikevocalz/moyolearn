// The dashboard's headline numbers, which are the ones a district owner would
// repeat in a meeting. Exercised through `listLeads` rather than against a
// private helper, so the test covers the contract the screen actually reads.
// SOT-KEYWORDS: ops stats conversion sessions attention test dashboard leads
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { statsFor } from './lead-stats.ts';
import type { Lead, Stage } from './ops.data.ts';

const lead = (stage: Stage, over: Partial<Lead> = {}): Lead => ({
  id: Math.random().toString(36).slice(2),
  family: 'Okafor',
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

describe('lead stats', () => {
  it('sums sessions across every row it is given', () => {
    const rows = Array.from({ length: 30 }, () => lead('Enrolled', { sessions: 2 }));
    assert.equal(statsFor(rows).sessionsDelivered, 60);
  });

  it('measures conversion against concluded trials, not every lead', () => {
    // 1 enrolled of 2 concluded is 50%. The three inquiries have not had a trial
    // yet, so counting them would report 20% — and the figure would fall further
    // every time the business won new interest.
    const stats = statsFor([
      lead('Enrolled'),
      lead('Proposal'),
      lead('Inquiry'),
      lead('Inquiry'),
      lead('Inquiry'),
    ]);
    assert.equal(stats.trialConversionPct, 50);
  });

  it('reports no conversion figure at all before any trial concludes', () => {
    const stats = statsFor([lead('Inquiry'), lead('Trial scheduled')]);
    assert.equal(stats.trialConversionPct, undefined, '0% would read as "we convert nobody"');
  });

  it('counts every family needing a decision', () => {
    const stats = statsFor([
      lead('Proposal', { needsAttention: true }),
      lead('At risk', { needsAttention: true }),
      lead('Enrolled'),
    ]);
    assert.equal(stats.needsAttention, 2);
  });

  it('reports zeroes for an empty pipeline rather than dividing by it', () => {
    assert.deepEqual(statsFor([]), {
      needsAttention: 0,
      sessionsDelivered: 0,
      trialConversionPct: undefined,
    });
  });
});

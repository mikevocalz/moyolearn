// The reducer is the one piece of write logic with branches, so it is the one
// piece that gets a test. Pure in, pure out — no renderer, no network.
// SOT-KEYWORDS: ops stage change reducer test pipeline attention
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyStageChange, boardStageChange } from './stage-change.ts';
import type { Lead } from './ops.data.ts';

const lead = (over: Partial<Lead> = {}): Lead => ({
  id: 'l1',
  family: 'Okafor',
  learner: 'Daniel',
  subject: 'Fractions',
  stage: 'Trial scheduled',
  owner: 'Amara',
  nextSession: '10:00',
  sessions: 1,
  value: '$45',
  attendance: { suppressed: true },
  needsAttention: true,
  ...over,
});

describe('applyStageChange', () => {
  it('moves only the targeted lead', () => {
    const rows = [lead(), lead({ id: 'l2', family: 'Bell' })];
    const next = applyStageChange(rows, { leadId: 'l2', to: 'Proposal' });
    assert.equal(next[0]?.stage, 'Trial scheduled');
    assert.equal(next[1]?.stage, 'Proposal');
  });

  it('clears the attention flag once the family reaches a settled stage', () => {
    const next = applyStageChange([lead()], { leadId: 'l1', to: 'Enrolled' });
    assert.equal(next[0]?.needsAttention, false);
  });

  it('keeps the attention flag while the family is still mid-pipeline', () => {
    const next = applyStageChange([lead()], { leadId: 'l1', to: 'Proposal' });
    assert.equal(next[0]?.needsAttention, true);
  });

  it('does not mutate the rows it was given', () => {
    const rows = [lead()];
    applyStageChange(rows, { leadId: 'l1', to: 'Enrolled' });
    assert.equal(rows[0]?.stage, 'Trial scheduled');
  });
});

describe('boardStageChange', () => {
  it('turns a cross-column drop into the one stage write', () => {
    assert.deepEqual(boardStageChange('l1', 'Trial scheduled', 'Proposal'), {
      leadId: 'l1',
      to: 'Proposal',
    });
  });

  it('refuses a same-column drop — no manual ordering exists to write', () => {
    assert.equal(boardStageChange('l1', 'Inquiry', 'Inquiry'), null);
  });

  it("refuses a drop into the scorer-owned 'At risk' lane", () => {
    // The same rule the table's menu enforces by omission: doc 28 §6 derives
    // 'At risk' from health signals, so no hand may set it — on any face.
    assert.equal(boardStageChange('l1', 'Enrolled', 'At risk'), null);
  });

  it('lets a card leave At risk through the manual stages', () => {
    assert.deepEqual(boardStageChange('l1', 'At risk', 'Enrolled'), {
      leadId: 'l1',
      to: 'Enrolled',
    });
  });

  it('refuses a column id that is not a stage at all', () => {
    assert.equal(boardStageChange('l1', 'Inquiry', 'Won'), null);
  });
});

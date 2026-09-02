// The create floor. Every branch here is a refusal the route hands straight to
// a user, so each one is exercised — and the stage assignment is pinned to the
// enum's first manual stage, because a client that could choose the starting
// stage could skip the funnel.
// SOT-KEYWORDS: lead create validation floor test parse cents stage crm
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NEW_LEAD_STAGE, parseNewLead } from './lead-create.ts';

describe('parseNewLead', () => {
  it('accepts the minimum lead — a family name and nothing else', () => {
    const parsed = parseNewLead({ family: 'The Chen family' });
    assert.deepEqual(parsed, {
      ok: true,
      input: { family: 'The Chen family', learner: undefined, subject: undefined, valueCents: 0 },
    });
  });

  it('trims every text field and drops the empties', () => {
    const parsed = parseNewLead({ family: '  Chen  ', learner: '  ', subject: ' Math ' });
    assert.ok(parsed.ok);
    assert.equal(parsed.input.family, 'Chen');
    assert.equal(parsed.input.learner, undefined);
    assert.equal(parsed.input.subject, 'Math');
  });

  it('refuses a lead with no family name', () => {
    assert.equal(parseNewLead({ family: '   ' }).ok, false);
    assert.equal(parseNewLead({}).ok, false);
    assert.equal(parseNewLead(null).ok, false);
  });

  it('accepts whole non-negative cents', () => {
    const parsed = parseNewLead({ family: 'Chen', valueCents: 49500 });
    assert.ok(parsed.ok);
    assert.equal(parsed.input.valueCents, 49500);
  });

  it('refuses fractional, negative and non-numeric values', () => {
    assert.equal(parseNewLead({ family: 'Chen', valueCents: 49.5 }).ok, false);
    assert.equal(parseNewLead({ family: 'Chen', valueCents: -1 }).ok, false);
    assert.equal(parseNewLead({ family: 'Chen', valueCents: '495' }).ok, false);
  });

  it('pins the starting stage to the first manual stage', () => {
    assert.equal(NEW_LEAD_STAGE, 'Inquiry');
  });
});

// S25's gates, and the one rule that is not a preference: a teacher never
// creates a child account. If `joinOptions` ever hands a K–5 class a code a
// nine-year-old can redeem alone, this file fails — which is the point of it.
// SOT: docs/pack/06-auth-onboarding-spec.md §5
// SOT-KEYWORDS: onboarding teacher s25 test join code guardian band assignment gates

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allowsSelfJoin,
  canAdvance,
  classCode,
  joinOptions,
  nextStep,
  ASSIGNMENT_TEMPLATES,
  CODE_LENGTH,
  EMPTY_TEACHER_DRAFT,
  GRADE_BANDS,
  type GradeBand,
  type TeacherDraft,
} from './steps.ts';

const draft = (over: Partial<TeacherDraft> = {}): TeacherDraft => ({
  ...EMPTY_TEACHER_DRAFT,
  ...over,
});

describe('who may join without a guardian', () => {
  it('never lets an under-13 class self-join', () => {
    assert.equal(allowsSelfJoin('k-5'), false);
    assert.deepEqual(
      joinOptions('k-5').map((o) => o.method),
      ['guardian-link'],
    );
  });

  it('offers the guardian route in every band that can contain a minor', () => {
    for (const band of ['k-5', '6-8', 'mixed'] as GradeBand[]) {
      assert.ok(
        joinOptions(band).some((o) => o.method === 'guardian-link'),
        `${band} has no guardian route`,
      );
    }
  });

  it('lets 9–12 redeem a code directly', () => {
    assert.equal(allowsSelfJoin('9-12'), true);
  });

  it('gives every band at least one way in, and every option a plain grant line', () => {
    for (const band of GRADE_BANDS) {
      const options = joinOptions(band.id);
      assert.ok(options.length > 0, `${band.id} has no way in at all`);
      for (const option of options) assert.ok(option.grants.length > 0);
    }
  });
});

describe('class code', () => {
  it('is the fixed length a teacher reads out', () => {
    assert.equal(classCode().length, CODE_LENGTH);
  });

  it('excludes characters that are two characters in the wrong font', () => {
    // 500 codes is enough to catch an alphabet that still contains them.
    for (let i = 0; i < 500; i += 1) {
      assert.doesNotMatch(classCode(), /[IO01L]/, 'ambiguous character in a code read aloud');
    }
  });
});

describe('S25 gates', () => {
  it('cannot leave the class step without a grade band', () => {
    assert.equal(canAdvance('class', draft({ className: 'Period 3' })), false);
    assert.equal(canAdvance('class', draft({ className: 'Period 3', gradeBand: 'k-5' })), true);
  });

  it('lets a roster stay empty — filling it is the metric, not the gate', () => {
    assert.equal(canAdvance('roster', draft({ guardianEmails: [] })), true);
  });

  it('will not finish without an assignment chosen', () => {
    assert.equal(canAdvance('assignment', draft()), false);
    assert.equal(canAdvance('assignment', draft({ templateId: 'practice-set' })), true);
    assert.equal(nextStep('assignment'), null);
  });

  it('ships templates that are actually sendable', () => {
    assert.ok(ASSIGNMENT_TEMPLATES.length > 0);
    for (const template of ASSIGNMENT_TEMPLATES) {
      assert.ok(template.description.length > 0, `${template.id} has nothing to send`);
      assert.ok(template.minutes > 0);
    }
  });
});

// Suppression is the one read-time branch that can leak a child's aggregate, so
// it is the one that gets a test. Pure in, pure out.
// SOT-KEYWORDS: ops suppression k-anonymity cohort attendance test privacy
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attendanceCell, MIN_COHORT } from './ops.data.ts';

describe('attendanceCell', () => {
  it('shows the figure once the cohort reaches the threshold', () => {
    assert.deepEqual(attendanceCell(61.4, MIN_COHORT), { value: '61%' });
  });

  it('suppresses a cohort one short of the threshold', () => {
    assert.deepEqual(attendanceCell(61, MIN_COHORT - 1), { suppressed: true });
  });

  // A large cohort with no measurement is still a hole, not a zero — rendering
  // `0%` here would report perfect absence for a family nobody has recorded.
  it('suppresses a missing percentage even in a large cohort', () => {
    assert.deepEqual(attendanceCell(null, 500), { suppressed: true });
  });

  it('treats an unknown cohort as too small to disclose', () => {
    assert.deepEqual(attendanceCell(99, null), { suppressed: true });
  });
});

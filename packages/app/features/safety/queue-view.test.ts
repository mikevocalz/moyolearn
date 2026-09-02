// The presentation rules that a screenshot cannot prove: that the queue never
// re-decides a breach, that a settled row stops claiming a deadline, and that a
// late row of any rung reads as late.
// SOT: ./queue-view.ts · docs/pack/31-grade-voice-safety-incidents.md §5.3
// SOT-KEYWORDS: safety incident queue view test sla clock breach tone settled unassigned s4

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TriageRow } from './incidents.service.ts';
import { incidentQueueItemsFrom, slaClock, unassignedS4Line } from './queue-view.ts';

const NOW = new Date('2026-08-27T12:00:00.000Z');

const row = (over: Partial<TriageRow> = {}): TriageRow => ({
  incidentId: 'inc_1',
  severity: 'S3',
  category: 'safety-concern',
  status: 'new',
  occurredAt: '2026-08-27T09:00:00.000Z',
  dueAt: '2026-08-29T09:00:00.000Z',
  breached: false,
  assigned: false,
  assigneeName: null,
  assignedToMe: false,
  timeline: [],
  ...over,
});

test('a rung with no clock says so rather than inventing one', () => {
  assert.equal(slaClock(row({ severity: 'S1', dueAt: null }), NOW), 'No response clock');
});

test('a settled row stops the clock even with a deadline in the past', () => {
  // `slaBreached` exempts resolved/closed, so the row arrives `breached: false`
  // with a `dueAt` behind us. Subtracting would have printed "Due in -3h".
  const settled = row({ status: 'closed', dueAt: '2026-08-27T09:00:00.000Z' });
  assert.equal(slaClock(settled, NOW), 'Clock stopped');
});

test('time to a deadline is compact and steps minutes → hours → days', () => {
  assert.equal(slaClock(row({ dueAt: '2026-08-27T12:30:00.000Z' }), NOW), 'Due in 30m');
  assert.equal(slaClock(row({ dueAt: '2026-08-27T14:00:00.000Z' }), NOW), 'Due in 2h');
  assert.equal(slaClock(row({ dueAt: '2026-08-31T12:00:00.000Z' }), NOW), 'Due in 4d');
});

test('breach is read from the server verdict, never recomputed', () => {
  // A deadline in the FUTURE with the server saying breached: the row still
  // reads as overdue. A client that recomputed would call this one fine.
  const disputed = row({ dueAt: '2026-08-27T14:00:00.000Z', breached: true });
  assert.match(slaClock(disputed, NOW), /^Overdue by/);
  assert.equal(incidentQueueItemsFrom([disputed], NOW)[0]?.breached, true);
});

test('a late row of any rung takes the danger tone', () => {
  const [late] = incidentQueueItemsFrom([row({ severity: 'S1', breached: true })], NOW);
  assert.equal(late?.tone, 'danger');
});

test('tone otherwise follows the ladder, and redpen stops at S4', () => {
  const items = incidentQueueItemsFrom(
    [
      row({ incidentId: 'a', severity: 'S1' }),
      row({ incidentId: 'b', severity: 'S2' }),
      row({ incidentId: 'c', severity: 'S3' }),
      row({ incidentId: 'd', severity: 'S4' }),
    ],
    NOW,
  );
  assert.deepEqual(
    items.map((item) => item.tone),
    ['neutral', 'neutral', 'attention', 'danger'],
  );
});

test('every category and status has a label — no raw slug reaches a screen', () => {
  const item = incidentQueueItemsFrom([row({ category: 'pii-shared', status: 'in-review' })], NOW)[0];
  assert.equal(item?.category, 'Personal details shared');
  assert.equal(item?.status, 'In review');
});

test('an unowned row is named as unowned, which is the queue’s one action', () => {
  assert.equal(incidentQueueItemsFrom([row({ assigned: false })], NOW)[0]?.assignment, 'Nobody yet');
  // An owner off today's roster reads as the plain fact, never a revived name.
  assert.equal(incidentQueueItemsFrom([row({ assigned: true })], NOW)[0]?.assignment, 'Assigned');
});

test('an owned row answers "whose is it" — you, or the roster name', () => {
  const mine = row({ assigned: true, assigneeName: 'Sam Vega', assignedToMe: true });
  assert.equal(incidentQueueItemsFrom([mine], NOW)[0]?.assignment, 'Yours');

  const theirs = row({ assigned: true, assigneeName: 'Sam Vega' });
  assert.equal(incidentQueueItemsFrom([theirs], NOW)[0]?.assignment, 'Sam Vega');
});

test('the interrupt banner is absent at zero and counts correctly above it', () => {
  assert.equal(unassignedS4Line(0), null);
  assert.equal(unassignedS4Line(1), '1 S4 incident has nobody on it.');
  assert.equal(unassignedS4Line(3), '3 S4 incidents have nobody on them.');
});

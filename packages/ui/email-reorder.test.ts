import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailDropIndex, reorderEmailItems, resolveEmailDrag, validRows } from './email-reorder.ts';
const rows = [
  { id: 'a', left: 20, top: 10, width: 200, height: 50 },
  { id: 'b', left: 20, top: 80, width: 200, height: 200 },
  { id: 'c', left: 20, top: 300, width: 200, height: 70 },
];
const drag = { source: 'a', token: 1, revision: 'v1', rows };
test('variable heights resolve first, middle and last positions', () => {
  assert.equal(emailDropIndex(rows, 'c', 100, 11), 0);
  assert.equal(emailDropIndex(rows, 'a', 100, 200), 1);
  assert.equal(emailDropIndex(rows, 'a', 100, 369), 2);
});
test('gaps are legal drop areas', () => assert.equal(emailDropIndex(rows, 'a', 100, 290), 1));
for (const [x, y] of [[0, 200], [100, 0], [100, 400], [NaN, 100], [100, Infinity]]) {
  test(`outside/nonfinite drop ${x},${y} is canceled`, () => assert.equal(emailDropIndex(rows, 'a', x!, y!), null));
}
test('unknown source is rejected', () => assert.equal(emailDropIndex(rows, 'missing', 100, 200), null));
test('empty, duplicate, zero, overlapping and nonfinite geometry is rejected', () => {
  assert.equal(validRows([]), false);
  assert.equal(validRows([rows[0]!, rows[0]!]), false);
  assert.equal(validRows([{ ...rows[0]!, width: 0 }]), false);
  assert.equal(validRows([rows[0]!, { ...rows[1]!, top: 30 }]), false);
  assert.equal(validRows([{ ...rows[0]!, top: NaN }]), false);
});
test('same-position gesture creates no undo unit', () => assert.equal(resolveEmailDrag(drag, 'a', 1, 'v1', false, rows, 100, 40), null));
test('successful release produces one move', () => assert.deepEqual(resolveEmailDrag(drag, 'a', 1, 'v1', false, rows, 100, 369), { source: 'a', index: 2 }));
for (const [source, token, revision, canceled] of [['b', 1, 'v1', false], ['a', 2, 'v1', false], ['a', 1, 'v2', false], ['a', 1, 'v1', true]] as const) {
  test(`stale/canceled gesture ${source}:${token}:${revision}:${canceled}`, () => assert.equal(resolveEmailDrag(drag, source, token, revision, canceled, rows, 100, 369), null));
}
test('scroll/resize geometry changes cancel', () => assert.equal(resolveEmailDrag(drag, 'a', 1, 'v1', false, rows.map((row) => ({ ...row, top: row.top + 1 })), 100, 369), null));
test('removed/reordered targets cancel', () => {
  assert.equal(resolveEmailDrag(drag, 'a', 1, 'v1', false, rows.slice(0, 2), 100, 200), null);
  assert.equal(resolveEmailDrag(drag, 'a', 1, 'v1', false, [rows[1]!, rows[0]!, rows[2]!], 100, 369), null);
});
test('consumed transaction cannot commit again', () => assert.equal(resolveEmailDrag(null, 'a', 1, 'v1', false, rows, 100, 369), null));
test('reorder preserves IDs, values, input and item object identity', () => {
  const result = reorderEmailItems(rows, 'a', 2);
  assert.deepEqual(result.map((row) => row.id), ['b', 'c', 'a']);
  assert.equal(result[2], rows[0]); assert.equal(rows[0]!.id, 'a');
});
test('invalid/no-op movement preserves array identity', () => {
  for (const [source, index] of [['a', 0], ['missing', 1], ['a', -1], ['a', 3], ['a', 1.5]] as const) assert.equal(reorderEmailItems(rows, source, index), rows);
});

test('repeated moves to the same position produce distinct accessible feedback', async () => {
  const { emailMoveFeedback } = await import('./email-reorder.ts');
  const first = emailMoveFeedback(0, 1);
  const second = emailMoveFeedback(first.moveCount, 1);
  assert.equal(first.moveCount, 1);
  assert.equal(second.moveCount, 2);
  assert.notEqual(first.announcement, second.announcement);
  assert.match(first.announcement, /position 2/);
  assert.match(second.announcement, /position 2/);
});

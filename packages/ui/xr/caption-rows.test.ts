import assert from 'node:assert/strict';
import { test } from 'node:test';
import { xrCaptionRows } from './caption-rows.ts';

test('the newest caption starts at the top without dropping history or reversing sentences', () => {
  const messages = [
    { id: 'old', role: 'learner', text: 'How can I solve this?' },
    { id: 'new', role: 'tutor', text: 'First divide both sides. Then check your answer against the original equation.' },
  ];
  const rows = xrCaptionRows(messages, 'Natalie');
  assert.equal(rows[0]?.id, 'new-speaker');
  assert.equal(rows[0]?.text, 'Natalie');
  for (const message of messages) {
    assert.equal(rows.filter(row => row.id.startsWith(`${message.id}-`) && !row.id.endsWith('-speaker')).map(row => row.text).join(''), message.text);
  }
  assert.equal(messages[0]?.id, 'old', 'never mutate the tutor store history');
});

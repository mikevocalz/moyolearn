// The contacts validation floor — the judgement calls that earn a test:
// what a contact cannot exist without, what stays optional, and the empty
// list being a valid edit rather than a refusal.
// SOT-KEYWORDS: family record contacts parse floor test crm
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_FAMILY_CONTACTS, parseFamilyContacts } from './family-record.ts';

describe('parseFamilyContacts', () => {
  it('accepts a full contact and trims its text', () => {
    const parsed = parseFamilyContacts({
      contacts: [{ name: '  Amara Chen ', relationship: ' Mother ', email: ' a@chen.example ', phone: '' }],
    });
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.contacts, [
      { name: 'Amara Chen', relationship: 'Mother', email: 'a@chen.example', phone: undefined },
    ]);
  });

  it('accepts an empty list — removing the last contact is a legitimate edit', () => {
    const parsed = parseFamilyContacts({ contacts: [] });
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.contacts, []);
  });

  it('refuses a contact without a name', () => {
    const parsed = parseFamilyContacts({ contacts: [{ relationship: 'Mother' }] });
    assert.ok(!parsed.ok);
    assert.match(parsed.error, /name/);
  });

  it('refuses a contact without a relationship', () => {
    const parsed = parseFamilyContacts({ contacts: [{ name: 'Amara', relationship: '  ' }] });
    assert.ok(!parsed.ok);
    assert.match(parsed.error, /relationship/);
  });

  it('refuses a body with no list', () => {
    assert.ok(!parseFamilyContacts(null).ok);
    assert.ok(!parseFamilyContacts({ contacts: 'Amara' }).ok);
  });

  it('bounds the list at the ceiling', () => {
    const parsed = parseFamilyContacts({
      contacts: Array.from({ length: MAX_FAMILY_CONTACTS + 1 }, () => ({
        name: 'Amara',
        relationship: 'Guardian',
      })),
    });
    assert.ok(!parsed.ok);
  });
});

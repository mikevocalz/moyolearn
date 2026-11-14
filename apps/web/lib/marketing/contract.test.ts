// Privacy and identity contract regressions, using labeled synthetic adults only.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing contract privacy test consent parent organization
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  inquiryEvent,
  inquiryInput,
  inquiryRow,
  trustedOrigin,
  updateInput,
} from './contract.ts';

const input = {
  requestId: '04f3dfc3-1a08-4653-872d-b79dd653ecab',
  name: 'Synthetic adult',
  email: 'ADULT@example.invalid',
  audience: 'school',
  organizationName: 'Synthetic school',
  adult: true,
  contactConsent: true,
  signalConsent: true,
};
test('intake requires explicit adult/contact consent and rejects student/freeform/tenant fields', () => {
  assert.equal(inquiryInput.parse(input).email, 'adult@example.invalid');
  for (const patch of [
    { adult: false },
    { contactConsent: false },
    { signalConsent: undefined },
    { studentName: 'No' },
    { orgId: 'other-tenant' },
    { message: 'Unstructured learning content' },
    { website: 'spam' },
  ])
    assert.equal(inquiryInput.safeParse({ ...input, ...patch }).success, false);
  assert.equal(
    inquiryInput.safeParse({ ...input, signalConsent: false }).success,
    true,
    'request can be answered without optional SignalIQ sharing',
  );
  assert.equal(
    inquiryInput.safeParse({
      ...input,
      email: `${'a'.repeat(64)}@${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(63)}.com`,
    }).success,
    false,
    'email must also fit SignalIQ’s 254-character boundary',
  );
});
test('organizations must be explicitly submitted; family inquiries cannot acquire a company', () => {
  assert.equal(
    inquiryInput.safeParse({ ...input, organizationName: '' }).success,
    false,
  );
  assert.equal(
    inquiryInput.safeParse({ ...input, audience: 'parent' }).success,
    false,
  );
  const record = inquiryRow.parse({
    id: input.requestId,
    prospect_id: input.requestId,
    org_id: 'moyo-sales',
    request_id: input.requestId,
    contact_name: input.name,
    email: 'adult@school.example',
    audience: 'parent',
    organization_name: '',
    organization_domain: '',
    signal_consent: true,
    withdrawn_at: null,
    created_at: '2026-11-14T10:00:00Z',
    stripe_customer_id: null,
    billing_reference_id: null,
  });
  const event = inquiryEvent(record);
  assert.equal('organization' in event, false);
  assert.deepEqual(
    Object.keys(event).sort(),
    [
      'consent',
      'contact',
      'kind',
      'occurredAt',
      'path',
      'sourceId',
      'sourceRef',
      'summary',
    ].sort(),
  );
  const school = inquiryEvent({
    ...record,
    audience: 'school',
    organization_name: 'Explicit school',
    organization_domain: 'school.example',
  });
  assert.equal(
    school.kind === 'inquiry' && school.organization?.externalId,
    `moyo.prospect:${record.id}`,
  );
});
test('only exact HTTPS marketing origins and bounded known updates are accepted', () => {
  assert.equal(
    trustedOrigin('https://www.moyolearn.com', 'https://www.moyolearn.com'),
    'https://www.moyolearn.com',
  );
  for (const value of [
    null,
    'null',
    'https://www.moyolearn.com.evil.test',
    'http://www.moyolearn.com',
    'https://app.moyolearn.com',
  ])
    assert.equal(trustedOrigin(value, 'https://www.moyolearn.com'), null);
  assert.equal(
    updateInput.safeParse({
      requestId: input.requestId,
      action: 'order',
      amountCents: 100,
    }).success,
    false,
    'client cannot claim a payment',
  );
  assert.equal(
    updateInput.safeParse({
      requestId: input.requestId,
      action: 'progress',
      stage: 'student-improved',
    }).success,
    false,
  );
});

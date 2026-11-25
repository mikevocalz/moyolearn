// The sales allowlist is ineffective if another internal user can seize its IDs.
// SOT: ../collections/Users.ts · ../../../app/marketing/permissions/marketing.permissions.ts
// SOT-KEYWORDS: marketing identity credential update delete access regression
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { marketingIdentityAccess } from '@acme/app/marketing-access';
import { Users } from '../collections/Users.ts';

test('configured sales identities cannot be changed by other staff or deleted through the public API', () => {
  const previous = process.env.MOYO_MARKETING_ADMIN_IDS;
  try {
    process.env.MOYO_MARKETING_ADMIN_IDS = '1, 7';
    assert.equal(marketingIdentityAccess(null, 'update'), false);
    assert.deepEqual(
      marketingIdentityAccess({ id: 2, collection: 'users' }, 'update'),
      { id: { not_in: ['1', '7'] } },
    );
    assert.deepEqual(
      marketingIdentityAccess({ id: 1, collection: 'users' }, 'update'),
      { id: { not_in: ['7'] } },
    );
    assert.deepEqual(
      marketingIdentityAccess({ id: 1, collection: 'users' }, 'delete'),
      { id: { not_in: ['1', '7'] } },
    );
    assert.deepEqual(
      marketingIdentityAccess({ id: 2, collection: 'users' }, 'delete'),
      { id: { not_in: ['1', '7'] } },
    );
    assert.equal(typeof Users.access?.update, 'function');
    assert.equal(typeof Users.access?.delete, 'function');
    process.env.MOYO_MARKETING_ADMIN_IDS = '';
    assert.equal(
      marketingIdentityAccess({ id: 2, collection: 'users' }, 'update'),
      true,
    );
  } finally {
    if (previous === undefined) delete process.env.MOYO_MARKETING_ADMIN_IDS;
    else process.env.MOYO_MARKETING_ADMIN_IDS = previous;
  }
});

// The incident mail's link goes to a parent, so its origin is the learning
// app's public one or nothing (PR #157 review: alert links pointed at localhost).
// SOT-KEYWORDS: guardian alert url test app origin NEXT_PUBLIC_APP_URL localhost
import assert from 'node:assert/strict';
import test from 'node:test';
import { guardianAlertsUrl } from './guardian-alert-email.ts';

test('builds the alerts link on NEXT_PUBLIC_APP_URL, not the admin site URL', () => {
  assert.equal(
    guardianAlertsUrl({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://app.moyolearn.com',
      NEXT_PUBLIC_SITE_URL: 'https://admin.moyolearn.com',
    }),
    'https://app.moyolearn.com/alerts',
  );
  assert.equal(
    guardianAlertsUrl({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'https://app.moyolearn.com/some/base/' }),
    'https://app.moyolearn.com/alerts',
  );
});

test('refuses to mail a localhost or missing origin outside development', () => {
  assert.throws(() => guardianAlertsUrl({ NODE_ENV: 'production' }), /NEXT_PUBLIC_APP_URL is not set/);
  assert.throws(
    () => guardianAlertsUrl({ NODE_ENV: 'production', NEXT_PUBLIC_SITE_URL: 'https://admin.moyolearn.com' }),
    /NEXT_PUBLIC_APP_URL is not set/,
  );
  assert.throws(
    () => guardianAlertsUrl({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'http://localhost:3000' }),
    /must be https/,
  );
  assert.throws(() => guardianAlertsUrl({ NODE_ENV: 'production', NEXT_PUBLIC_APP_URL: 'app.moyolearn.com' }), /absolute/);
});

test('a development build may use the local app', () => {
  assert.equal(guardianAlertsUrl({ NODE_ENV: 'development' }), 'http://localhost:3000/alerts');
  assert.equal(
    guardianAlertsUrl({ NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: 'http://localhost:3001' }),
    'http://localhost:3001/alerts',
  );
});

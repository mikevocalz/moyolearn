// Init-factory proof — doc 35 §7 checklist rows 1, 3 and 6 as unit assertions:
// PII off, dev sends nothing, traces off. The grep gate in
// `tooling/check-sentry-invariants.mjs` proves no OTHER file contradicts these;
// this file proves the one source is right.
// SOT: docs/pack/35-sentry-free-tier.md §4 · §7 checklist rows 1 3 6
// SOT-KEYWORDS: telemetry options test enabled production pii traces surface tag
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { telemetryInitOptions, TELEMETRY_IGNORE_ERRORS } from './telemetry-options.ts';

const DSN = 'https://key@o0.ingest.sentry.io/0';

test('dev sends nothing: enabled is false outside production, even with a DSN', () => {
  const options = telemetryInitOptions({
    dsn: DSN,
    surface: 'web',
    environment: 'development',
    isProduction: false,
  });
  assert.equal(options.enabled, false);
});

test('a missing or empty DSN disables the reporter even in production', () => {
  for (const dsn of [undefined, '']) {
    const options = telemetryInitOptions({
      dsn,
      surface: 'server',
      environment: 'production',
      isProduction: true,
    });
    assert.equal(options.enabled, false);
  }
});

test('production with a DSN is the one enabled state', () => {
  const options = telemetryInitOptions({
    dsn: DSN,
    surface: 'mobile',
    environment: 'production',
    isProduction: true,
  });
  assert.equal(options.enabled, true);
});

test('the doc 35 §4 base holds on every surface', () => {
  for (const surface of ['mobile', 'web', 'server', 'worker'] as const) {
    const options = telemetryInitOptions({
      dsn: DSN,
      surface,
      environment: 'production',
      isProduction: true,
    });
    assert.equal(options.sendDefaultPii, false);
    assert.equal(options.tracesSampleRate, 0);
    assert.equal(options.sampleRate, 1);
    assert.equal(options.maxBreadcrumbs, 30);
    assert.deepEqual(options.ignoreErrors, [...TELEMETRY_IGNORE_ERRORS]);
    assert.equal(options.initialScope.tags.surface, surface);
  }
});

test('runtime tag rides only the server-side surfaces', () => {
  const server = telemetryInitOptions({
    dsn: DSN,
    surface: 'server',
    environment: 'production',
    isProduction: true,
  });
  assert.equal(server.initialScope.tags.runtime, 'server');

  const web = telemetryInitOptions({
    dsn: DSN,
    surface: 'web',
    environment: 'production',
    isProduction: true,
  });
  assert.equal('runtime' in web.initialScope.tags, false);
});

test('release is omitted, not empty, when the build does not know one', () => {
  const without = telemetryInitOptions({
    dsn: DSN,
    surface: 'web',
    environment: 'production',
    isProduction: true,
  });
  assert.equal('release' in without, false);

  const withRelease = telemetryInitOptions({
    dsn: DSN,
    surface: 'web',
    environment: 'production',
    isProduction: true,
    release: 'abc123',
  });
  assert.equal(withRelease.release, 'abc123');
});

test('environment falls back to development, never to empty', () => {
  const options = telemetryInitOptions({
    dsn: DSN,
    surface: 'web',
    environment: undefined,
    isProduction: false,
  });
  assert.equal(options.environment, 'development');
});

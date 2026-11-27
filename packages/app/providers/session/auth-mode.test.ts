// A release build is live whatever the environment says. The variable chooses
// between mock and live only inside a development build; this is the test that
// keeps a production bundle from booting the fixture session.
// SOT: docs/pack/09-screens-first-build-order.md §2
// SOT-KEYWORDS: auth mode test release live default dev mock env

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { getAuthMode, isDevBuild } from './auth-mode.ts';

type DevGlobal = typeof globalThis & { __DEV__?: boolean };
const g = globalThis as DevGlobal;

const savedDev = g.__DEV__;
const savedEnv = {
  EXPO_PUBLIC_AUTH_MODE: process.env.EXPO_PUBLIC_AUTH_MODE,
  NEXT_PUBLIC_AUTH_MODE: process.env.NEXT_PUBLIC_AUTH_MODE,
  NODE_ENV: process.env.NODE_ENV,
};

// Node's types narrow NODE_ENV to a literal union; the test writes through the
// plain record so it can set and clear every variable the same way.
const env = process.env as Record<string, string | undefined>;

function setEnv(name: keyof typeof savedEnv, value: string | undefined) {
  if (value === undefined) delete env[name];
  else env[name] = value;
}

afterEach(() => {
  if (savedDev === undefined) delete g.__DEV__;
  else g.__DEV__ = savedDev;
  for (const name of Object.keys(savedEnv) as (keyof typeof savedEnv)[]) setEnv(name, savedEnv[name]);
});

describe('getAuthMode in a release build', () => {
  it('is live when __DEV__ is false, even with the env asking for mock', () => {
    g.__DEV__ = false;
    setEnv('EXPO_PUBLIC_AUTH_MODE', 'mock');
    setEnv('NEXT_PUBLIC_AUTH_MODE', 'mock');
    assert.equal(isDevBuild(), false);
    assert.equal(getAuthMode(), 'live');
  });

  it('is live when __DEV__ is false and the env is unset', () => {
    g.__DEV__ = false;
    setEnv('EXPO_PUBLIC_AUTH_MODE', undefined);
    setEnv('NEXT_PUBLIC_AUTH_MODE', undefined);
    assert.equal(getAuthMode(), 'live');
  });

  it('falls back to NODE_ENV where __DEV__ is not defined (a Next bundle)', () => {
    delete g.__DEV__;
    setEnv('NODE_ENV', 'production');
    setEnv('NEXT_PUBLIC_AUTH_MODE', 'mock');
    assert.equal(isDevBuild(), false);
    assert.equal(getAuthMode(), 'live');
  });
});

describe('getAuthMode in a development build', () => {
  it('defaults to mock with nothing set', () => {
    g.__DEV__ = true;
    setEnv('EXPO_PUBLIC_AUTH_MODE', undefined);
    setEnv('NEXT_PUBLIC_AUTH_MODE', undefined);
    assert.equal(isDevBuild(), true);
    assert.equal(getAuthMode(), 'mock');
  });

  it('honours an explicit live', () => {
    g.__DEV__ = true;
    setEnv('EXPO_PUBLIC_AUTH_MODE', 'live');
    assert.equal(getAuthMode(), 'live');
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTION_TEST_FLAG, readPolicyEnvironment, resolveReducedMotionPolicy } from './policy.ts';

const release = { dev: false, testFlag: false };
const devOnly = { dev: true, testFlag: false };
const devTest = { dev: true, testFlag: true };
const releaseTest = { dev: false, testFlag: true };

test('the default is the system setting', () => {
  assert.equal(resolveReducedMotionPolicy(undefined, release), 'system');
  assert.equal(resolveReducedMotionPolicy('system', devTest), 'system');
});

test('always is honoured everywhere', () => {
  assert.equal(resolveReducedMotionPolicy('always', release), 'always');
});

test('never needs a dev build AND the test flag', () => {
  assert.equal(resolveReducedMotionPolicy('never', release), 'system');
  assert.equal(resolveReducedMotionPolicy('never', devOnly), 'system');
  assert.equal(resolveReducedMotionPolicy('never', releaseTest), 'system');
  assert.equal(resolveReducedMotionPolicy('never', devTest), 'never');
});

test('the environment reads __DEV__ and the test flag from globalThis', () => {
  const scope = globalThis as typeof globalThis & Record<string, unknown>;
  const before = { dev: scope.__DEV__, flag: scope[MOTION_TEST_FLAG] };
  try {
    scope.__DEV__ = true;
    scope[MOTION_TEST_FLAG] = true;
    assert.deepEqual(readPolicyEnvironment(), devTest);
    assert.deepEqual(readPolicyEnvironment(false), releaseTest);
    delete scope[MOTION_TEST_FLAG];
    assert.deepEqual(readPolicyEnvironment(), devOnly);
  } finally {
    scope.__DEV__ = before.dev;
    scope[MOTION_TEST_FLAG] = before.flag;
  }
});

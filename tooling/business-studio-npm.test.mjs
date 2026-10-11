import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { packageReceipt, updateCatalog, fetchReceipt, TARGETS } from './business-studio-npm.mjs';
const sample = (name, version = '1.2.3') => ({ name, version, dist: {
  integrity: 'sha512-YWJjZA==', tarball: `https://registry.npmjs.org/${name}/-/package.tgz`,
} });
const receipts = TARGETS.map((name) => packageReceipt(name, sample(name), '2026-10-11T00:00:00Z'));
const yaml = `packages:\n  - apps/*\ncatalog:\n  react-native-reanimated: 1.0.0 # retain this\n  "react-native-gesture-handler": 1.0.0\n  'react-native-worklets': 1.0.0\n  react: 19.0.0\n  expo: 58.0.0-preview.8\nother:\n  typegpu: 0.0.1\n`;
for (const version of ['latest', '^1.2.3', '1.2.3-beta.1', '01.2.3', '1.2']) {
  test(`rejects nonstable ${version}`, () => assert.throws(() => packageReceipt('x', sample('x', version), 'now')));
}
test('validates exact package identity', () => assert.throws(() => packageReceipt('x', sample('y'), 'now')));
test('rejects deprecated latest', () => assert.throws(() => packageReceipt('x', { ...sample('x'), deprecated: 'moved' }, 'now')));
test('rejects absent integrity', () => assert.throws(() => packageReceipt('x', { name: 'x', version: '1.0.0' }, 'now')));
test('rejects off-registry distribution', () => {
  const data = sample('x'); data.dist.tarball = 'https://other.invalid/x.tgz';
  assert.throws(() => packageReceipt('x', data, 'now'));
});
test('rewrites only installed targets; preserves SDK pins, quoting and comments', () => {
  const result = updateCatalog(yaml, receipts);
  assert.match(result.source, /react-native-reanimated: 1.2.3 # retain this/);
  assert.match(result.source, /"react-native-gesture-handler": 1.2.3/);
  assert.match(result.source, /'react-native-worklets': 1.2.3/);
  assert.match(result.source, /expo: 58.0.0-preview.8/);
  assert.match(result.source, /other:\n  typegpu: 0.0.1/);
  assert.equal(result.changes.find((entry) => entry.name === 'typegpu').installed, false);
});
test('requires default catalog', () => assert.throws(() => updateCatalog('packages: []', receipts)));
test('rejects missing required package', () => assert.throws(() => updateCatalog('catalog:\n  foo: 1.0.0', receipts)));
test('rejects duplicate catalog keys', () => assert.throws(() => updateCatalog(yaml.replace('  react: 19.0.0', '  react-native-reanimated: 0.1.0'), receipts)));
test('is idempotent at a fixed registry snapshot', () => {
  const next = updateCatalog(yaml, receipts).source;
  assert.equal(updateCatalog(next, receipts).source, next);
});
test('rejects registry errors', async () => {
  await assert.rejects(fetchReceipt('x', async () => new Response('', { status: 503 })));
});
test('rejects malformed registry JSON', async () => {
  await assert.rejects(fetchReceipt('x', async () => new Response('not json')));
});
test('bounds registry response body', async () => {
  await assert.rejects(fetchReceipt('x', async () => new Response('x'.repeat(512_001))), /oversized/);
});
test('queries latest with redirects forbidden and preserves peer requirements', async () => {
  const data = { ...sample('@scope/x'), peerDependencies: { react: '^19' } };
  const result = await fetchReceipt('@scope/x', async (url, options) => {
    assert.equal(url, 'https://registry.npmjs.org/%40scope%2Fx/latest');
    assert.equal(options.redirect, 'error');
    return Response.json(data);
  }, 'now');
  assert.equal(result.version, '1.2.3');
  assert.deepEqual(result.peerDependencies, { react: '^19' });
});

// A ready pull request must validate a stable head instead of generating a
// timestamp-only commit whose Actions checks cannot start from GITHUB_TOKEN.
test('ready dependency PRs verify without branch writes', () => {
  const workflow = readFileSync(new URL('../.github/workflows/business-studio-npm.yml', import.meta.url), 'utf8');
  assert.match(workflow, /types: \[opened, synchronize, reopened, ready_for_review\]/);
  assert.match(workflow, /if: github\.event\.pull_request\.draft &&/);
  assert.match(workflow, /if: \$\{\{ !github\.event\.pull_request\.draft \|\|/);
  assert.equal((workflow.match(/uses: actions\/checkout@v4/g) ?? []).length, 3);
  assert.equal((workflow.match(/persist-credentials: false/g) ?? []).length, 3);
});

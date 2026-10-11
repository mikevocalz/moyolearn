import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { packageReceipt, updateCatalog, fetchReceipt, validateManifestTargets, validateLockedTargets, validateSavedReceipt, TARGETS } from './business-studio-npm.mjs';
const sample = (name, version = '1.2.3') => ({ name, version, dist: {
  integrity: `sha512-${createHash('sha512').update('registry metadata fixture').digest('base64')}`, tarball: `https://registry.npmjs.org/${name}/-/package.tgz`,
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

const manifest = (dependencies, extra = {}) => [{ path: 'apps/mobile/package.json', manifest: { dependencies, ...extra } }];
const targetCatalog = [{ name: 'react-native-webgpu', installed: true }];
test('installed direct pins cannot masquerade as absent candidates', () => {
  assert.throws(() => validateManifestTargets(manifest({ 'react-native-webgpu': '0.10.2' }), []), /must use an existing default catalog/);
});
test('catalog targets require catalog declarations in every dependency field', () => {
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    assert.throws(() => validateManifestTargets(manifest({}, { [field]: { 'react-native-webgpu': '0.10.2' } }), targetCatalog));
  }
});
test('catalog references need a resolved default catalog entry', () => {
  assert.throws(() => validateManifestTargets(manifest({ 'react-native-webgpu': 'catalog:' }), []));
  assert.doesNotThrow(() => validateManifestTargets(manifest({ 'react-native-webgpu': 'catalog:' }), targetCatalog));
});
test('overrides cannot silently replace an audited target', () => {
  for (const selector of ['react-native-webgpu', 'react-native-webgpu@0.13.1', 'other>react-native-webgpu', 'other@1>react-native-webgpu@0.13.1']) {
    assert.throws(() => validateManifestTargets(manifest({}, { pnpm: { overrides: { [selector]: '0.10.2' } } }), targetCatalog), /bypasses/);
  }
});
test('unrelated dependencies and noninstalling peer ranges are allowed', () => {
  assert.doesNotThrow(() => validateManifestTargets(manifest({ react: 'catalog:' }, { peerDependencies: { 'react-native-webgpu': '*' } }), []));
});

test('root catalog overrides preserve single-version admission', () => {
  assert.doesNotThrow(() => validateManifestTargets([{ path: 'package.json', manifest: { pnpm: { overrides: { 'react-native-webgpu': 'catalog:' } } } }], targetCatalog));
  assert.throws(() => validateManifestTargets(manifest({}, { pnpm: { overrides: { 'react-native-webgpu': 'catalog:' } } }), targetCatalog));
});
test('resolved older optional peers cannot bypass latest admission', () => {
  const receipts = [{ name: 'react-native-worklets', version: '0.13.0' }];
  const lock = "lockfileVersion: '9.0'\npackages:\n  react-native-worklets@0.13.0:\n    resolution: {}\n  react-native-worklets@0.10.2:\n    resolution: {}\nsnapshots:\n";
  assert.throws(() => validateLockedTargets(lock, receipts), /nonlatest installed copy/);
  assert.doesNotThrow(() => validateLockedTargets(lock.replace('  react-native-worklets@0.10.2:\n    resolution: {}\n', ''), receipts));
});
test('lock admission handles scoped quoted package names and invalid envelopes', () => {
  assert.throws(() => validateLockedTargets('not a lockfile', []), /package section/);
  assert.throws(() => validateLockedTargets("\npackages:\n  '@shopify/react-native-skia@2.12.0':\n    resolution: {}\nsnapshots:\n", [{ name: '@shopify/react-native-skia', version: '2.14.0' }]), /nonlatest/);
});

for (const integrity of [
  'sha512-YWJjZA==',
  sample('x').dist.integrity.slice(0, -1),
  `${sample('x').dist.integrity}=`,
  `${sample('x').dist.integrity.slice(0, -3)}B==`,
  `sha512-${Buffer.alloc(65).toString('base64')}`,
]) {
  test(`rejects noncanonical or wrong-length SHA-512 integrity ${integrity}`, () => {
    const data = sample('x'); data.dist.integrity = integrity;
    assert.throws(() => packageReceipt('x', data, 'now'), /invalid SHA-512/);
  });
}

const savedEvidence = () => ({ schema: 1, tag: 'latest', checkedAt: '2026-10-11T00:00:00Z', packages: structuredClone(receipts), catalog: updateCatalog(yaml, receipts).changes });
test('committed receipt matches live evidence without rewriting historical pins', () => {
  assert.doesNotThrow(() => validateSavedReceipt(savedEvidence(), receipts, updateCatalog(updateCatalog(yaml, receipts).source, receipts).changes));
});
for (const field of ['version', 'registry', 'integrity', 'tarball']) {
  test(`committed receipt detects tampered ${field}`, () => {
    const saved = savedEvidence(); saved.packages[0][field] = 'tampered';
    assert.throws(() => validateSavedReceipt(saved, receipts, saved.catalog), /does not match/);
  });
}
test('committed receipt rejects missing, duplicate and wrongly admitted packages', () => {
  for (const change of [
    (saved) => { saved.packages.pop(); },
    (saved) => { saved.packages[1] = saved.packages[0]; },
    (saved) => { saved.catalog[0].installed = false; },
    (saved) => { saved.packages[0].peerDependencies = { react: 'incorrect' }; },
  ]) {
    const saved = savedEvidence(); change(saved);
    assert.throws(() => validateSavedReceipt(saved, receipts, updateCatalog(yaml, receipts).changes));
  }
  assert.throws(() => validateSavedReceipt(null, receipts, []), /envelope/);
});

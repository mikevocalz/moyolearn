// Exercise the installed Expo resolver, including pnpm's compatibility patch.
// SOT: patches/expo-modules-autolinking@58.0.5.patch; Android native CI.
// SOT-KEYWORDS: expo android autolinking publication local maven version regression
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const autolinking = dirname(require.resolve('expo-modules-autolinking/package.json'));
const { ExpoModuleConfig } = require(join(autolinking, 'build/ExpoModuleConfig.js'));
const { resolveModuleAsync } = require(join(autolinking, 'build/platforms/android/android.js'));

async function resolveFixture(t, publication) {
  const path = mkdtempSync(join(tmpdir(), 'moyo-expo-publication-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  mkdirSync(join(path, 'android'));
  writeFileSync(join(path, 'android/build.gradle'), '');
  const result = await resolveModuleAsync('expo-fixture', {
    name: 'expo-fixture',
    version: '58.0.6',
    path,
    config: new ExpoModuleConfig({
      platforms: ['android'],
      android: { modules: ['FixtureModule'], ...(publication ? { publication } : {}) },
    }),
  });
  return result.projects[0];
}

const local = {
  groupId: 'host.exp.exponent',
  artifactId: 'expo.modules.fixture',
  repository: 'local-maven-repo',
};

test('bundled local Maven publications inherit the package version when omitted', async (t) => {
  assert.deepEqual((await resolveFixture(t, local)).publication, { ...local, version: '58.0.6' });
});

test('an explicit publication version remains authoritative', async (t) => {
  const publication = { ...local, version: '58.0.5' };
  assert.deepEqual((await resolveFixture(t, publication)).publication, publication);
});

test('source-only modules stay source-only and remote publication versions are not guessed', async (t) => {
  assert.equal((await resolveFixture(t)).publication, undefined);
  const remote = { ...local, repository: 'https://maven.example.test' };
  assert.deepEqual((await resolveFixture(t, remote)).publication, remote);
});

for (const name of ['expo-print', 'expo-sharing']) {
  test(`${name} resolves a version matching its bundled Maven artifact`, async () => {
    const path = dirname(require.resolve(`${name}/package.json`));
    const pkg = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'));
    const config = new ExpoModuleConfig(JSON.parse(readFileSync(join(path, 'expo-module.config.json'), 'utf8')));
    const result = await resolveModuleAsync(name, { name, version: pkg.version, path, config });
    const publication = result.projects[0].publication;
    assert.equal(publication.version, pkg.version);
    const pom = readFileSync(join(
      path, publication.repository, ...publication.groupId.split('.'),
      publication.artifactId, publication.version, `${publication.artifactId}-${publication.version}.pom`,
    ), 'utf8');
    assert.ok(pom.includes(`<version>${publication.version}</version>`));
  });
}

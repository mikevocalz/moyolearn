// Exercise the installed Expo resolver against the two homework print/share modules.
// expo-print and expo-sharing ship a bundled local Maven artifact whose
// expo-module.config.json omits the version; the SDK 58 Gradle decoder needs it.
// expo-modules-autolinking 58.0.15 fills it from the package version upstream,
// which replaced the 58.0.5 patch this test was first written against.
// SOT: node_modules/expo-modules-autolinking build/platforms/android/android.js; Android native CI.
// SOT-KEYWORDS: expo android autolinking publication local maven version regression
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const autolinking = dirname(require.resolve('expo-modules-autolinking/package.json'));
const { ExpoModuleConfig } = require(join(autolinking, 'build/ExpoModuleConfig.js'));
const { resolveModuleAsync } = require(join(autolinking, 'build/platforms/android/android.js'));

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

// SOT: ../pico-platform-dependencies.js
// SOT-KEYWORDS: pico pps gradle mobile minimum sdk prebuild regression
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { scopePicoPlatformDependencies } = require('../pico-platform-dependencies');

const start = '// expo-pico-core: PICO Platform Service SDK (com.pico.pps:*) deps';
const end = '// expo-pico-core: auto-include app/libs/*.aar (PICO Platform SDK)';
const generated = `${start}
dependencies {
    constraints {
        implementation "com.pico.pps:pps_sdk_base:1.0.0"
    }
    implementation "com.pico.pps:platform-service-auth:1.0.0"
}
${end}
dependencies { implementation fileTree(dir: 'libs', include: ['*.aar']) }
`;

test('PICO service dependencies and constraints belong only to the Pico flavor', () => {
  const result = scopePicoPlatformDependencies(generated);
  assert.match(result, /constraints \{\n        picoImplementation "com.pico.pps:pps_sdk_base:1.0.0"/);
  assert.match(result, /picoImplementation "com.pico.pps:platform-service-auth:1.0.0"/);
  assert.doesNotMatch(result, /\bimplementation ["']com\.pico\.pps:/);
  assert.equal(scopePicoPlatformDependencies(result), result);
});

test('does not rewrite another plugin or general application dependencies', () => {
  const before = 'dependencies { implementation "com.example:phone:2.0" }\n';
  const after = '\ndependencies { questImplementation "com.meta:layout:1.0" }\n';
  const result = scopePicoPlatformDependencies(before + generated + after);
  assert.ok(result.startsWith(before));
  assert.ok(result.endsWith(after));
  assert.ok(result.includes('dependencies { implementation fileTree'));
});

test('fails closed if the generated ownership or declaration format changes', () => {
  for (const input of [
    'unrelated Gradle configuration', generated.replace(end, ''), generated + generated,
    generated.replace(/implementation/g, 'api'),
  ]) assert.throws(() => scopePicoPlatformDependencies(input), /PICO Platform Service/);
});

test('committed native build has the same repair as fresh prebuild without changing flavor SDK floors', () => {
  const contents = readFileSync(join(__dirname, '../../android/app/build.gradle'), 'utf8');
  assert.equal(scopePicoPlatformDependencies(contents), contents);
  assert.equal((contents.match(/picoImplementation ["']com\.pico\.pps:/g) ?? []).length, 23);
  assert.match(contents, /mobile \{ dimension "device" \}/);
  assert.match(contents, /pico \{[\s\S]*?minSdkVersion 32/);
  assert.match(contents, /quest \{[\s\S]*?minSdkVersion 29/);
  assert.match(contents, /minSdkVersion rootProject\.ext\.minSdkVersion/);
  const properties = readFileSync(join(__dirname, '../../android/gradle.properties'), 'utf8');
  assert.match(properties, /^android\.minSdkVersion=26$/m);
});

test('the installed PICO generator runs before the actual Moyo Expo repair chain', async () => {
  const withViro = require('../with-viro-android-linkage');
  const picoRoot = dirname(require.resolve('@expo-pico/core/package.json'));
  const { withPicoAppBuildGradle } = require(join(picoRoot, 'plugin/build/withPicoGradle.js'));
  const { resolveOptions } = require(join(picoRoot, 'plugin/build/types.js'));
  const projectRoot = resolve(__dirname, '../..');
  const contents = readFileSync(join(projectRoot, 'android/app/build.gradle'), 'utf8');
  const first = contents.indexOf(start);
  const last = contents.indexOf('// expo-pico-core: pico sdk config', first);
  assert.ok(first >= 0 && last > first);
  // Delete only the generator's PPS and local-AAR blocks so its real plugin
  // recreates them. No Gradle or native file is written by this contract.
  const input = contents.slice(0, first) + contents.slice(last);
  let config = withViro({ name: 'Moyo', slug: 'moyo', android: { package: 'com.moyolearn.app' } });
  config = withPicoAppBuildGradle(config, resolveOptions({
    xrMode: 'pico-os5', buildVariant: 'pico', appType: 'mr', targetProfile: 'auto',
    targetDevices: ['pico-4', 'pico-4-ultra'], spatialMode: 'shared-space', defaultContainerMode: 'window-container',
  }));
  const run = (source) => config.mods.android.appBuildGradle({
    ...config,
    modResults: { language: 'groovy', contents: source },
    modRequest: { projectRoot, platformProjectRoot: join(projectRoot, 'android'), platform: 'android', modName: 'appBuildGradle', introspect: false },
  });
  const result = (await run(input)).modResults.contents;
  assert.equal((result.match(/picoImplementation ["']com\.pico\.pps:/g) ?? []).length, 23);
  assert.doesNotMatch(result, /\bimplementation ["']com\.pico\.pps:/);
  assert.match(result, /mobile \{ dimension "device" \}/);
  assert.equal((await run(result)).modResults.contents, result);
});

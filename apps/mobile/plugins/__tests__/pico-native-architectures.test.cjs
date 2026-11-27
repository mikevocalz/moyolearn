// SOT: ../pico-native-architectures.js
// SOT-KEYWORDS: pico gradle native abi settings prebuild regression
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { propagatePicoNativeArchitectures, PICO_NATIVE_ARCHITECTURES } = require('../pico-native-architectures');

const projectRoot = resolve(__dirname, '../..');
const legacy = readFileSync(join(projectRoot, '../../tooling/fixtures/pico-legacy-abi-settings.gradle'), 'utf8');
const include = "include ':expo-pico-core'\n";

test('replaces the ambiguous callback and preserves unrelated settings callbacks', () => {
  const unrelated = "gradle.rootProject { root -> root.ext.otherSetting = 'preserved' }\n";
  const result = propagatePicoNativeArchitectures(include + unrelated + legacy);
  assert.ok(result.includes(include));
  assert.ok(result.includes(unrelated));
  assert.ok(result.includes(PICO_NATIVE_ARCHITECTURES));
  assert.doesNotMatch(result, /getProperties\(\)\.get\("reactNativeArchitectures"\)/);
  assert.equal(propagatePicoNativeArchitectures(result), result);
});

test('fresh generation is idempotent and rejects a changed or duplicated owned hook', () => {
  const generated = propagatePicoNativeArchitectures(include);
  assert.equal(propagatePicoNativeArchitectures(generated), generated);
  for (const input of [
    include + legacy.replace('?: "arm64-v8a"', '?: "x86_64"'),
    include + legacy + legacy,
    generated.replace('appRoot.providers', 'providers'),
    generated + PICO_NATIVE_ARCHITECTURES,
  ]) assert.throws(() => propagatePicoNativeArchitectures(input), /PICO ABI propagation/);
});

test('the installed Expo settings mod repairs stale and fresh output without accumulating declarations', async () => {
  const withViro = require('../with-viro-android-linkage');
  const picoRoot = dirname(require.resolve('@expo-pico/core/package.json'));
  const { withPicoNitroModules } = require(join(picoRoot, 'plugin/build/withPicoNitroModules.js'));
  let config = withViro({ name: 'Moyo', slug: 'moyo', android: { package: 'com.moyolearn.app' } });
  config = withPicoNitroModules(config, { enabled: true });
  const contents = readFileSync(join(projectRoot, 'android/settings.gradle'), 'utf8');
  const run = async (source) => (await config.mods.android.settingsGradle({
    ...config,
    modResults: { language: 'groovy', contents: source },
    modRequest: { projectRoot, platformProjectRoot: join(projectRoot, 'android'), platform: 'android', modName: 'settingsGradle', introspect: false },
  })).modResults.contents;
  for (const input of [contents.replace(PICO_NATIVE_ARCHITECTURES, ''), contents.replace(PICO_NATIVE_ARCHITECTURES, legacy)]) {
    const generated = await run(input);
    assert.equal(generated, contents);
    assert.equal(await run(generated), generated);
    assert.equal((generated.match(/def viroPackageRoot = new File\(/g) ?? []).length, 1);
    assert.match(generated, /include ':expo-pico-core'/);
  }
  // Exercise the real PICO generator as well: fresh prebuild has neither its
  // module include nor the Moyo callback, and their registration order matters.
  const fresh = contents.slice(0, contents.indexOf('// expo-pico-core: @expo-pico/* Nitro module inclusion'));
  const regenerated = await run(fresh);
  assert.match(regenerated, /include ':expo-pico-core'/);
  assert.ok(regenerated.includes(PICO_NATIVE_ARCHITECTURES));
  assert.equal(await run(regenerated), regenerated);
});

test('the committed settings use canonical root properties and preserve headset ABI and SDK contracts', () => {
  const settings = readFileSync(join(projectRoot, 'android/settings.gradle'), 'utf8');
  assert.equal(propagatePicoNativeArchitectures(settings), settings);
  assert.ok(settings.includes(PICO_NATIVE_ARCHITECTURES));
  const app = readFileSync(join(projectRoot, 'android/app/build.gradle'), 'utf8');
  assert.match(app, /mobile \{ dimension "device" \}/);
  for (const [flavor, floor] of [['pico', 32], ['quest', 29]]) {
    assert.match(app, new RegExp(`${flavor} \\{[^}]*minSdkVersion ${floor}[^}]*ndk \\{ abiFilters 'arm64-v8a' \\}`));
  }
  assert.match(readFileSync(join(projectRoot, 'android/gradle.properties'), 'utf8'), /^android\.minSdkVersion=26$/m);
});

// SOT: ../viro-native-registration.js
// SOT-KEYWORDS: viro native package registration abi prebuild regression
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join, resolve } = require('node:path');
const { scopeViroNativeRegistration, VIRO_NATIVE_REGISTRATION, VIRO_PACKAGES } = require('../viro-native-registration');

const projectRoot = resolve(__dirname, '../..');
const main = 'app/src/main/java/com/moyolearn/app/MainApplication.kt';
const committed = readFileSync(join(projectRoot, 'android', main), 'utf8');

test('the reviewed package guard is idempotent and rejects changed or duplicate registrations', () => {
  assert.equal(scopeViroNativeRegistration(committed), committed);
  assert.equal(scopeViroNativeRegistration(committed.replace(VIRO_NATIVE_REGISTRATION, VIRO_PACKAGES)), committed);
  for (const contents of [
    committed + '\n' + VIRO_PACKAGES,
    committed.replace('ViroPlatform.QUEST', 'ViroPlatform.GVR'),
    committed.replace('BuildConfig.FLAVOR == "mobile"', 'true'),
    committed.replace('          // Moyo: end native Viro registration.', ''),
  ]) assert.throws(() => scopeViroNativeRegistration(contents), /Viro native/);
  assert.doesNotMatch(VIRO_NATIVE_REGISTRATION, /SUPPORTED_ABIS|os\.arch|catch\s*\(/);
});

test('real single-process Expo Viro/PICO MainApplication prebuild preserves the guard on repeat generation', (t) => {
  const fixture = mkdtempSync(join(tmpdir(), 'moyo-viro-prebuild-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const platformProjectRoot = join(fixture, 'android');
  const mainPath = join(platformProjectRoot, main);
  mkdirSync(dirname(mainPath), { recursive: true });
  const base = {
    name: 'Moyo', slug: 'moyo', android: { package: 'com.moyolearn.app' },
    plugins: [['@reactvision/react-viro', { android: { xRMode: ['AR', 'QUEST'] } }]],
  };
  const viroRoot = dirname(require.resolve('@reactvision/react-viro/package.json'));
  const picoRoot = dirname(require.resolve('@expo-pico/core/package.json'));
  // The real Expo compiler runs dangerous and MainApplication providers in one
  // process. The pinned Viro patch must await its IO; draining a generator in
  // a separate phase would hide the race with the following provider.
  const generate = () => {
    const result = spawnSync(process.execPath, ['-e', `
      const { compileModsAsync } = require(${JSON.stringify(require.resolve('@expo/config-plugins'))});
      const withMoyo = require(${JSON.stringify(require.resolve('../with-viro-android-linkage'))});
      const { withPicoMainApplication } = require(${JSON.stringify(join(picoRoot, 'plugin/build/withPicoMainApplication.js'))});
      const { withViroAndroid } = require(${JSON.stringify(join(viroRoot, 'dist/plugins/withViroAndroid.js'))});
      let config = withMoyo(${JSON.stringify(base)});
      config.mods.android = { mainApplication: config.mods.android.mainApplication };
      config = withPicoMainApplication(config, { xrMode: 'pico-os5' });
      config = withViroAndroid(config, { android: { xRMode: ['AR', 'QUEST'] } });
      config.mods.android = { dangerous: config.mods.android.dangerous, mainApplication: config.mods.android.mainApplication };
      compileModsAsync(config, { projectRoot: ${JSON.stringify(fixture)}, platforms: ['android'] })
        .catch(error => { console.error(error); process.exitCode = 1; });
    `], { encoding: 'utf8', timeout: 10_000 });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return readFileSync(mainPath, 'utf8');
  };
  const fresh = committed.replace(VIRO_NATIVE_REGISTRATION, '').replace('import com.viromedia.bridge.ReactViroPackage\n', '');
  writeFileSync(mainPath, fresh);
  const generated = generate();
  assert.ok(generated.includes(VIRO_NATIVE_REGISTRATION));
  assert.equal((generated.match(/add\(ReactViroPackage/g) ?? []).length, 2);
  assert.match(generated, /add\(PicoCorePackage\(PicoXRPlatform.PICO_OS5\)\)/);
  assert.match(generated, /PackageList\(this\)\.packages/);
  assert.equal(generate(), generated);
});

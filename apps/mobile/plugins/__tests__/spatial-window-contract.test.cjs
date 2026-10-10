const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateWindow,
  validateDefaultOrientation,
  assertMetaConfiguration,
  preserveMetaSupportedDevices,
} = require('../with-spatial-window-contract');
const options = { defaultWidth: '1024dp', defaultHeight: '640dp' };
function fixture(layout) {
  return { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' }, application: [{ activity: [{
    $: { 'android:name': '.MainActivity' }, ...(layout ? { layout: [{ $: layout }] } : {}),
  }] }] } };
}
test('preserves configured window dimensions', () => {
  validateWindow(fixture({ 'android:defaultWidth': '1024dp', 'android:defaultHeight': '640dp' }), options, 'Quest');
});
test('rejects a plugin replacing the platform manifest with a feature-only manifest', () => {
  assert.throws(() => validateWindow({ manifest: { 'uses-feature': [] } }, options, 'Quest'), /defaultWidth must stay 1024dp, got missing/);
});
test('rejects a scene adjustment changing the app window height', () => {
  assert.throws(() => validateWindow(fixture({ 'android:defaultWidth': '1024dp', 'android:defaultHeight': '800dp' }), options, 'Quest'), /defaultHeight must stay 640dp/);
});
test('does not invent a window size for an immersive-only app without declared dimensions', () => {
  validateWindow(fixture(), {}, 'PICO');
});
test('keeps default device orientation and rejects forced landscape', () => {
  const main = fixture();
  main.manifest.application[0].activity[0].$['android:screenOrientation'] = 'unspecified';
  validateDefaultOrientation(main);
  main.manifest.application[0].activity[0].$['android:screenOrientation'] = 'landscape';
  assert.throws(() => validateDefaultOrientation(main), /Default app orientation was overwritten/);
});
test('Meta target cannot silently lose its Horizon config plugin', () => {
  assert.throws(() => assertMetaConfiguration({plugins: []}, true), /require the expo-horizon-core/);
  assertMetaConfiguration({plugins: [['expo-horizon-core', options]]}, true);
  assertMetaConfiguration({plugins: []}, false);
});
test('Meta glasses device support wins a merged manifest without replacing either source set', () => {
  const manifest = fixture({ 'android:defaultWidth': '1024dp', 'android:defaultHeight': '640dp' });
  manifest.manifest.application[0]['meta-data'] = [{
    $: {
      'android:name': 'com.oculus.supportedDevices',
      'android:value': 'quest2|questpro|quest3|quest3s|vrglasses',
    },
  }];

  preserveMetaSupportedDevices(manifest, {
    supportedDevices: 'quest2|questpro|quest3|quest3s|vrglasses',
  });

  assert.equal(manifest.manifest.$['xmlns:tools'], 'http://schemas.android.com/tools');
  assert.equal(
    manifest.manifest.application[0]['meta-data'][0].$['tools:replace'],
    'android:value',
  );
});
test('Meta glasses device support cannot disappear during prebuild', () => {
  const manifest = fixture({ 'android:defaultWidth': '1024dp', 'android:defaultHeight': '640dp' });
  manifest.manifest.application[0]['meta-data'] = [{
    $: {
      'android:name': 'com.oculus.supportedDevices',
      'android:value': 'quest2|questpro|quest3|quest3s',
    },
  }];
  assert.throws(
    () => preserveMetaSupportedDevices(manifest, {
      supportedDevices: 'quest2|questpro|quest3|quest3s|vrglasses',
    }),
    /supportedDevices must stay .*vrglasses/,
  );
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateWindow, validateDefaultOrientation, assertMetaConfiguration } = require('../with-spatial-window-contract');
const options = { defaultWidth: '1024dp', defaultHeight: '640dp' };
function fixture(layout) {
  return { manifest: { application: [{ activity: [{
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

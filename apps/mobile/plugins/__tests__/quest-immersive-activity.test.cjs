const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mergeQuestImmersiveActivity, VR_CATEGORY } = require('../quest-immersive-activity');
const { validateWindow, validateDefaultOrientation } = require('../with-spatial-window-contract');
const pkg = 'com.moyolearn.app';
const attrs = (name) => ({ $: { 'android:name': name } });
function fixture() {
  return { manifest: { $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
    'uses-permission': [attrs('existing.permission')], application: [{
      $: { 'android:allowBackup': 'false' }, 'meta-data': [{ $: { 'android:name': 'com.oculus.supportedDevices', 'android:value': 'quest3s' } }],
      activity: [{ $: { 'android:name': '.MainActivity', 'android:screenOrientation': 'unspecified' },
        layout: [{ $: { 'android:defaultWidth': '1024dp', 'android:defaultHeight': '640dp' } }],
        'intent-filter': [{ action: [attrs('android.intent.action.MAIN')], category: [attrs('android.intent.category.LAUNCHER')] }] },
      { $: { 'android:name': '.VRActivity', 'android:exported': 'false', 'android:screenOrientation': 'landscape' },
        'meta-data': [{ $: { 'android:name': 'com.oculus.vr.focusaware', 'android:value': 'true' } }],
        'intent-filter': [{ action: [attrs('existing.private.action')], category: [attrs('existing.category')] }] }],
    }] } };
}
test('Quest VR identifier preserves panel window, orientation, metadata and other filters', () => {
  const document = fixture(); const before = structuredClone(document);
  mergeQuestImmersiveActivity(document, pkg);
  const app = document.manifest.application[0]; const vr = app.activity[1];
  assert.deepEqual(app.activity[0], before.manifest.application[0].activity[0]);
  assert.deepEqual(app['meta-data'], before.manifest.application[0]['meta-data']);
  assert.deepEqual(vr.$, before.manifest.application[0].activity[1].$);
  assert.deepEqual(vr['meta-data'], before.manifest.application[0].activity[1]['meta-data']);
  assert.deepEqual(vr['intent-filter'][0], before.manifest.application[0].activity[1]['intent-filter'][0]);
  const added = vr['intent-filter'][1];
  assert.deepEqual(added.action, [attrs(`${pkg}.action.IMMERSIVE_VR`)]);
  assert.deepEqual(added.category, [attrs('android.intent.category.DEFAULT'), attrs(VR_CATEGORY)]);
  assert.equal(JSON.stringify(added).includes('android.intent.action.MAIN'), false);
  assert.equal(JSON.stringify(added).includes('android.intent.category.LAUNCHER'), false);
  validateWindow(document, { defaultWidth: '1024dp', defaultHeight: '640dp' }, 'Quest');
  validateDefaultOrientation(document);
});
test('overlay merge is idempotent and creates only the VR activity stub when absent', () => {
  const document = fixture(); document.manifest.application[0].activity.pop();
  mergeQuestImmersiveActivity(document, pkg); const once = structuredClone(document);
  mergeQuestImmersiveActivity(document, pkg); assert.deepEqual(document, once);
  assert.deepEqual(document.manifest.application[0].activity[1].$, { 'android:name': '.VRActivity' });
});
test('classification is written only into the Quest flavor and PICO shared stripping remains', () => {
  const plugin = fs.readFileSync(path.join(__dirname, '../with-viro-android-linkage.js'), 'utf8');
  assert.match(plugin, /delete vrActivity\['intent-filter'\]/);
  assert.match(plugin, /mergeQuestImmersiveActivity\(questManifest, modConfig.android\?\.package\)/);
  assert.match(plugin, /'src',\s*'quest'/);
});

const overlayPath = path.join(__dirname, '../../android/app/src/quest/AndroidManifest.xml');
const mergedPath = path.join(__dirname, '../../android/app/build/intermediates/merged_manifests/questDebug/processQuestDebugManifest/AndroidManifest.xml');
test('locally generated Quest overlay and merged APK manifest retain the immersive identifier', {
  skip: !fs.existsSync(overlayPath) || !fs.existsSync(mergedPath),
}, async () => {
  const { AndroidConfig } = require('@expo/config-plugins');
  const overlay = await AndroidConfig.Manifest.readAndroidManifestAsync(overlayPath);
  const merged = await AndroidConfig.Manifest.readAndroidManifestAsync(mergedPath);
  for (const document of [overlay, merged]) {
    const app = document.manifest.application[0];
    const vr = app.activity.find((entry) => entry.$['android:name'].endsWith('.VRActivity'));
    assert.ok(vr, 'VR activity is present');
    const filters = vr['intent-filter'] ?? [];
    assert.ok(filters.some((filter) => filter.category?.some((entry) => entry.$['android:name'] === VR_CATEGORY)));
    assert.equal(filters.some((filter) => filter.action?.some((entry) => entry.$['android:name'] === 'android.intent.action.MAIN')), false);
    assert.equal(filters.some((filter) => filter.category?.some((entry) => entry.$['android:name'] === 'android.intent.category.LAUNCHER')), false);
    const panel = app.activity.find((entry) => entry.$['android:name'].endsWith('.MainActivity'));
    assert.equal(panel.layout[0].$['android:defaultWidth'], '1024dp');
    assert.equal(panel.layout[0].$['android:defaultHeight'], '640dp');
  }
  const panel = merged.manifest.application[0].activity.find((entry) => entry.$['android:name'].endsWith('.MainActivity'));
  assert.equal(panel.$['android:screenOrientation'], 'unspecified');
  const launcherActivities = merged.manifest.application[0].activity.filter((activity) =>
    activity['intent-filter']?.some((filter) => filter.category?.some((entry) => entry.$['android:name'] === 'android.intent.category.LAUNCHER')));
  assert.equal(launcherActivities.length, 1);
  assert.ok(launcherActivities[0].$['android:name'].endsWith('.MainActivity'));
});

// Declares SpatialPanelActivity in the PICO flavor manifest only
// (android/app/src/pico/AndroidManifest.xml), so mobile and quest APKs never
// carry it and `SpatialPanels.isAvailable` is false there. Quest gets its rail
// window from Meta's layout SDK instead (src/spatial/metaWindows.ts).
//
// PICO's window container ignores `<layout>` and sizes an activity from its
// `pico.spatial.windowcontainer.*` meta-data, read at install time and cached
// per package (schema dumped from PICO's own store2d.apk; see the digivision
// with-pico-compat plugin). Both are written: `<layout>` for launchers that
// only read that.
//
// A finalized mod so it runs after @expo-pico/core writes the pico manifest.
// SOT: Harlem Might apps/mobile/modules/spatial-panels/app.plugin.js
// SOT-KEYWORDS: pico spatial panel activity manifest window container rail

const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { AndroidConfig, withFinalizedMod } = require('expo/config-plugins');

const ACTIVITY = 'com.moyolearn.spatialpanels.SpatialPanelActivity';

function parseDp(label, value) {
  const match = /^(\d+)dp$/.exec(String(value));
  if (!match) throw new Error(`spatial-panels: ${label} must look like "80dp", got ${JSON.stringify(value)}.`);
  return Number(match[1]);
}

/**
 * The pico-manifest `<activity>` element for the panel. Pure, for tests.
 *
 * @param {{ defaultWidth: string, defaultHeight: string }} options
 */
function panelActivityElement(options) {
  const width = parseDp('defaultWidth', options.defaultWidth);
  const height = parseDp('defaultHeight', options.defaultHeight);
  const size = `${width}x${height}`;
  const meta = [
    ['pico.spatial.windowcontainer.id', 'SpatialPanel'],
    ['pico.spatial.windowcontainer.defaultsize', size],
    ['pico.spatial.WindowContainer.size', size],
    ['pico.spatial.windowcontainer.defaultsize.unit', 'meters|dp'],
    // Fixed size: the content is laid out for exactly this box.
    ['pico.spatial.windowcontainer.resizetype', '0'],
    // No PICO title bar over a rail this narrow.
    ['pico.spatial.windowcontainer.captionbar', '0'],
  ];
  return {
    $: {
      'android:name': ACTIVITY,
      'android:exported': 'false',
      'android:theme': '@style/AppTheme',
      'android:configChanges':
        'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|smallestScreenSize|density',
      'android:resizeableActivity': 'true',
      'android:excludeFromRecents': 'true',
      // Its own task, so PICO gives it its own window container instead of
      // stacking it on the main panel's task.
      'android:taskAffinity': 'com.moyolearn.app.panel',
    },
    layout: [{ $: { 'android:defaultWidth': options.defaultWidth, 'android:defaultHeight': options.defaultHeight } }],
    'meta-data': meta.map(([name, value]) => ({ $: { 'android:name': name, 'android:value': value } })),
  };
}

/** Adds or replaces the panel activity in a parsed manifest. Pure, for tests. */
function addPanelActivity(manifest, options) {
  const application = manifest.manifest.application?.[0];
  if (!application) throw new Error('spatial-panels: the pico manifest has no <application>.');
  const activities = (application.activity ?? []).filter((activity) => activity.$?.['android:name'] !== ACTIVITY);
  application.activity = [...activities, panelActivityElement(options)];
  return manifest;
}

/** @type {import('expo/config-plugins').ConfigPlugin<{ defaultWidth: string, defaultHeight: string }>} */
const withSpatialPanels = (config, options) => {
  panelActivityElement(options); // fail at config time, not mid-prebuild
  return withFinalizedMod(config, [
    'android',
    async (config) => {
      const path = join(config.modRequest.platformProjectRoot, 'app/src/pico/AndroidManifest.xml');
      if (!existsSync(path)) {
        throw new Error('spatial-panels: app/src/pico/AndroidManifest.xml is missing. List @expo-pico/core before this plugin.');
      }
      const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(path);
      await AndroidConfig.Manifest.writeAndroidManifestAsync(path, addPanelActivity(manifest, options));
      return config;
    },
  ]);
};

module.exports = withSpatialPanels;
module.exports.addPanelActivity = addPanelActivity;
module.exports.panelActivityElement = panelActivityElement;
module.exports.PANEL_ACTIVITY = ACTIVITY;

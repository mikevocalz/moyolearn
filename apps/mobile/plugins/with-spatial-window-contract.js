/** Fail prebuild if another plugin drops configured headset window settings. */
const fs = require('node:fs');
const path = require('node:path');
const { AndroidConfig, withDangerousMod } = require('@expo/config-plugins');

function validateWindow(manifest, options, label) {
  const app = manifest.manifest.application?.[0];
  const activity = app?.activity?.find(item => item.$?.['android:name'] === '.MainActivity');
  for (const key of ['defaultWidth', 'defaultHeight']) {
    if (options[key] === undefined) continue;
    const actual = activity?.layout?.[0]?.$?.[`android:${key}`];
    if (actual !== options[key]) {
      throw new Error(`${label}: ${key} must stay ${options[key]}, got ${actual ?? 'missing'}. Preserve the platform window configuration.`);
    }
  }
}
function validateDefaultOrientation(main, requireActivity = true) {
  const activity = main.manifest.application?.[0]?.activity?.find(item => item.$?.['android:name'] === '.MainActivity');
  const orientation = activity?.$?.['android:screenOrientation'];
  if (!activity && requireActivity) throw new Error('MainActivity missing after prebuild');
  if (orientation && orientation !== 'unspecified') throw new Error(`Default app orientation was overwritten with ${orientation}`);
}
function assertMetaConfiguration(config, metaTarget) {
  if (metaTarget && !config.plugins?.some(item => item === 'expo-horizon-core' || (Array.isArray(item) && item[0] === 'expo-horizon-core'))) {
    throw new Error('Meta spatial apps require the expo-horizon-core config plugin');
  }
}
function withSpatialWindowContract(config, { metaTarget = false } = {}) {
  assertMetaConfiguration(config, metaTarget);
  // Register first in app.config so this dangerous mod runs after other writers.
  return withDangerousMod(config, ['android', async mod => {
    const root = path.join(mod.modRequest.platformProjectRoot, 'app', 'src');
    for (const [name, flavor] of [['expo-horizon-core', 'quest'], ['@expo-pico/core', 'pico']]) {
      const entry = config.plugins?.find(item => Array.isArray(item) && item[0] === name);
      if (!entry) continue;
      const file = path.join(root, flavor, 'AndroidManifest.xml');
      if (!fs.existsSync(file)) throw new Error(`${name}: missing ${flavor} manifest after prebuild`);
      const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(file);
      validateWindow(manifest, entry[1] ?? {}, name);
      if (config.orientation === 'default') validateDefaultOrientation(manifest, false);
    }
    if (config.orientation === 'default') {
      const main = await AndroidConfig.Manifest.readAndroidManifestAsync(path.join(root, 'main', 'AndroidManifest.xml'));
      validateDefaultOrientation(main);
    }
    return mod;
  }]);
}
module.exports = withSpatialWindowContract;
module.exports.validateWindow = validateWindow;
module.exports.validateDefaultOrientation = validateDefaultOrientation;
module.exports.assertMetaConfiguration = assertMetaConfiguration;

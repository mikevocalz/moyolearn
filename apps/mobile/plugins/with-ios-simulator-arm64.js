/**
 * Undoes @reactvision/react-viro's `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`
 * in the generated iOS project.
 *
 * Viro's iOS plugin (dist/plugins/withViroIos.js, withExcludedSimulatorArchitectures)
 * writes that setting onto every build configuration, from when ViroKit shipped no
 * arm64 simulator slice. This app does not link Viro on iPhone: the CocoaPods lock
 * never listed a Viro pod, and the SwiftPM build does not autolink it. The setting
 * still builds the app for x86_64 only, and ExecutorchLib.xcframework has only an
 * arm64 simulator slice, so the simulator build compiled nothing for the app target
 * ("None of the architectures in ARCHS (arm64) are valid").
 *
 * It runs as a finalized mod, after every other plugin has written the project, so
 * plugin order in app.config.ts cannot bring the setting back.
 *
 * SOT-KEYWORDS: ios simulator arm64 excluded_archs viro executorch swiftpm config-plugin
 */
const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('@expo/config-plugins');

const SETTING = /^\s*"EXCLUDED_ARCHS\[sdk=iphonesimulator\*\]" = "?arm64"?;\n/gm;

module.exports = function withIosSimulatorArm64(config) {
  return withFinalizedMod(config, [
    'ios',
    async (finalized) => {
      const iosRoot = finalized.modRequest.platformProjectRoot;
      for (const entry of fs.readdirSync(iosRoot)) {
        if (!entry.endsWith('.xcodeproj')) continue;
        const pbxproj = path.join(iosRoot, entry, 'project.pbxproj');
        const text = fs.readFileSync(pbxproj, 'utf8');
        const next = text.replace(SETTING, '');
        if (next !== text) fs.writeFileSync(pbxproj, next);
      }
      return finalized;
    },
  ]);
};

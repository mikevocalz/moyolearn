/**
 * PICO's marker-based rewriter removes only the first line of its multi-line
 * feature-flag override. Repeated prebuild otherwise leaves orphaned Kotlin
 * object bodies after the new complete override. Collapse only the exact
 * reviewed residue; preserve the override and reject changed ownership.
 * SOT: docs/business/native-runtime-checks.md
 * SOT-KEYWORDS: pico main application flags kotlin prebuild idempotence
 */
const MARKER = '    // expo-pico-core: New Architecture flag guard for the Viro VR activity hop';
const BODY = `        object : ReactNativeNewArchitectureFeatureFlagsDefaults() {
          override fun skipActivityIdentityAssertionOnHostPause(): Boolean = true
        })`;
const PICO_FLAG_GUARD = `${MARKER}
    ReactNativeFeatureFlags.dangerouslyForceOverride(
${BODY}`;

function repairPicoMainApplication(contents) {
  const start = contents.indexOf(MARKER);
  if (start < 0 || start !== contents.lastIndexOf(MARKER) || !contents.startsWith(PICO_FLAG_GUARD, start)) {
    throw new Error('PICO MainApplication feature-flag owner changed or duplicated');
  }
  let end = start + PICO_FLAG_GUARD.length;
  while (contents.startsWith('\n' + BODY, end)) end += BODY.length + 1;
  const repaired = contents.slice(0, start) + PICO_FLAG_GUARD + contents.slice(end);
  if ((repaired.match(/object\s*:\s*ReactNativeNewArchitectureFeatureFlagsDefaults\(/g) ?? []).length !== 1) {
    throw new Error('PICO MainApplication has an unrecognized feature-flag override');
  }
  return repaired;
}

module.exports = { repairPicoMainApplication, PICO_FLAG_GUARD };

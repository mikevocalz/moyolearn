/**
 * Propagate the app's requested ABIs to the vendored PICO CMake module.
 * An unqualified getProperties() in a Settings callback resolves the script,
 * not the root project, and the old fallback forced x86_64 builds onto ARM.
 * SOT: apps/mobile/android/settings.gradle
 * SOT-KEYWORDS: pico native architectures gradle settings prebuild emulator abi
 */
const LEGACY = `// The vendored expo-pico-core build.gradle resolves
// project.getProperties().get("reactNativeArchitectures") — the SUBPROJECT's
// property map, which never sees root gradle.properties. It falls back to
// all four ABIs, and the 32-bit/x86 links fail against Nitro's arm64-only
// prefab. Mirror the property onto the project's ext at include time so the
// same lookup resolves the app's real ABI set.
gradle.rootProject {
    project(':expo-pico-core').ext.reactNativeArchitectures =
        getProperties().get("reactNativeArchitectures") ?: "arm64-v8a"
}
`;
const MARKER = "// Moyo: propagate the app's requested native ABIs to PICO.";
const PICO_NATIVE_ARCHITECTURES = `${MARKER}
// The callback's explicit root owns the CLI/gradle.properties precedence.
// An unqualified getProperties() here reads the Settings script instead.
gradle.rootProject { appRoot ->
    appRoot.project(':expo-pico-core').ext.reactNativeArchitectures =
        appRoot.providers.gradleProperty('reactNativeArchitectures').get()
}
`;

function propagatePicoNativeArchitectures(contents) {
  if (contents.includes(LEGACY.split('\n')[0])) {
    if (!contents.includes(LEGACY) || contents.indexOf(LEGACY) !== contents.lastIndexOf(LEGACY)) {
      throw new Error('Legacy PICO ABI propagation changed or duplicated; review its replacement');
    }
    contents = contents.replace(LEGACY, '');
  }
  if (contents.includes(MARKER)) {
    if (!contents.includes(PICO_NATIVE_ARCHITECTURES) || contents.indexOf(MARKER) !== contents.lastIndexOf(MARKER)) {
      throw new Error('PICO ABI propagation is changed or duplicated');
    }
    return contents;
  }
  return `${contents.trimEnd()}\n\n${PICO_NATIVE_ARCHITECTURES}`;
}

module.exports = { propagatePicoNativeArchitectures, PICO_NATIVE_ARCHITECTURES };

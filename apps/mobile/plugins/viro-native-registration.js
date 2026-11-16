/**
 * Keep the ordinary-mobile process usable when the pinned ARM-only Viro
 * renderer is absent from its actual x86 native-library search path. Viro's
 * MaterialManager loads the renderer eagerly during package construction.
 * Supported ARM, headset and unknown configurations retain normal failures.
 * SOT: docs/business/native-runtime-checks.md · vendors/README.md
 * SOT-KEYWORDS: viro android native abi package registration mobile prebuild
 */
const VIRO_PACKAGES = `            add(ReactViroPackage(ReactViroPackage.ViroPlatform.AR))
            add(ReactViroPackage(ReactViroPackage.ViroPlatform.QUEST))`;
const START = '          // Moyo: register Viro only when the mobile process ABI can load it.';
const END = '          // Moyo: end native Viro registration.';
const VIRO_NATIVE_REGISTRATION = `${START}
          // Android adjusts nativeLibraryDir for the selected process ABI,
          // including native bridges. The advertised device ABI list does not.
          val viroNativeAbi = this@MainApplication.applicationInfo.nativeLibraryDir?.substringAfterLast('/')
          val viroLoader = this@MainApplication.classLoader as? dalvik.system.BaseDexClassLoader
          val omitUnsupportedMobileViro = BuildConfig.FLAVOR == "mobile" &&
              (viroNativeAbi == "x86" || viroNativeAbi == "x86_64") &&
              viroLoader != null && viroLoader.findLibrary("viro_renderer") == null
          if (!omitUnsupportedMobileViro) {
${VIRO_PACKAGES}
          }
${END}`;

function scopeViroNativeRegistration(contents) {
  const calls = contents.match(/ReactViroPackage\(ReactViroPackage\.ViroPlatform\./g) ?? [];
  if (calls.length !== 2 || !contents.includes(VIRO_PACKAGES)) {
    throw new Error('Viro native package registrations changed or duplicated; review their process ABI scope');
  }
  if (contents.includes(START) || contents.includes(END)) {
    if (!contents.includes(VIRO_NATIVE_REGISTRATION)
      || contents.indexOf(START) !== contents.lastIndexOf(START)
      || contents.indexOf(END) !== contents.lastIndexOf(END)) {
      throw new Error('Viro native registration owner changed or duplicated');
    }
    return contents;
  }
  return contents.replace(VIRO_PACKAGES, VIRO_NATIVE_REGISTRATION);
}

module.exports = { scopeViroNativeRegistration, VIRO_NATIVE_REGISTRATION, VIRO_PACKAGES };

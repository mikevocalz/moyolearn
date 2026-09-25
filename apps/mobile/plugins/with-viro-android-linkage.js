/**
 * Makes `@reactvision/react-viro`'s Android linkage work in THIS repo: picks a
 * variant of its flavoured shim projects, and resolves them by asking Node
 * where the package is instead of guessing a path.
 *
 * Both halves repair something the fork's own `withViroAndroid` writes, so both
 * have to run AFTER it — which means this plugin is listed BEFORE
 * `@reactvision/react-viro` in `app.config.ts`. `withMod` composes mods as a
 * stack: each one runs its own action and then calls `nextMod`, the previously
 * registered mod. Last registered edits the file first. Listing this plugin
 * after Viro ran it before Viro and tripped the guard below.
 *
 * ── 1. THE FLAVOUR DIMENSION ─────────────────────────────────────────────────
 * `android/react_viro/build.gradle` and `android/viro_renderer/build.gradle` in
 * the fork both declare `flavorDimensions += "device"` with `mobile`, `pico` and
 * `quest`. The app module declares no flavours at all, so Gradle has three
 * candidate variants and no attribute to choose between them, and configuration
 * fails before a single source file is compiled:
 *
 *   Could not determine the dependencies of task ':app:compileDebugJavaWithJavac'
 *   > Could not resolve project :viro_renderer.
 *     > ... we cannot choose between the following variants of project :viro_renderer:
 *         - mobileDebugApiElements
 *         - picoDebugApiElements
 *         - questDebugApiElements
 *
 * `missingDimensionStrategy` is the documented answer: it tells a consumer with
 * no flavours which value of someone else's dimension to request.
 *
 * WHICH VALUE, AND WHY IT DOES NOT MATTER AS MUCH AS IT LOOKS. All three
 * flavours in those two build files resolve to the same artifact — each is
 * `api files('<name>-release.aar')` with no per-flavour source set — so the
 * choice selects a name, not a binary. `pico` is named because a PICO 4 Ultra is
 * the headset this app is verified on; if the fork ever gives the flavours
 * different contents, this line is where that decision gets made rather than
 * being resolved arbitrarily by attribute matching.
 *
 * ── 2. THE PATH TO THE SHIM PROJECTS ─────────────────────────────────────────
 * `withViroSettingsGradle` appends four hardcoded paths:
 *
 *   project(':viro_renderer').projectDir =
 *     new File('../node_modules/@reactvision/react-viro/android/viro_renderer')
 *
 * relative to `android/`, that is `apps/mobile/node_modules/...`. This workspace
 * sets `node-linker=hoisted` (`.npmrc`), so third-party packages are installed
 * once at the REPO ROOT — `node_modules/@reactvision/react-viro` — and there is
 * no copy beside the app. The hardcoded path is a single-package-project
 * assumption, and in a monorepo it points at nothing:
 *
 *   Project directory '<...>/apps/mobile/node_modules/@reactvision/react-viro/
 *   android/viro_renderer' does not exist.
 *
 * It survives on a machine that still has a pre-tarball install, because that
 * left `apps/mobile/node_modules/@reactvision/react-viro` behind as a symlink to
 * a local checkout — which is exactly the out-of-repo dependency that vendoring
 * the fork as a tarball was meant to end. A fresh clone has no such symlink.
 *
 * So the paths are rewritten to ask Node, which is already the pattern in the
 * file being edited: the generated `settings.gradle` locates
 * `@react-native/gradle-plugin` and `expo-modules-autolinking` with exactly this
 * `providers.exec` + `require.resolve` shape. One way to find a package, not
 * two.
 *
 * Rewriting rather than appending, because the fork's lines are already there by
 * the time this runs and two `projectDir` assignments for one project is a
 * silent last-write-wins.
 *
 * SOT: docs/decisions/adr-117-spatial-whiteboard-bridge.md · vendors/README.md
 * SOT-KEYWORDS: viro android gradle flavor dimension missingDimensionStrategy
 *               settings.gradle projectDir monorepo hoisted node-linker pico
 *               config-plugin prebuild react_viro viro_renderer
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  AndroidConfig,
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withSettingsGradle,
} = require('@expo/config-plugins');

/** The fork's dimension name, and the flavour this app asks for. See §1. */
const FLAVOR_DIMENSION = 'device';
const FLAVOR = 'pico';

/** The four Gradle projects `withViroSettingsGradle` includes. */
const VIRO_PROJECTS = ['arcore_client', 'gvr_common', 'viro_renderer', 'react_viro'];

/**
 * Resolves the installed package once, at Gradle configuration time, from the
 * `android/` directory. `rootDir` is that directory, and Node's own resolution
 * walks up from it — so this finds the package wherever the linker put it,
 * hoisted to the repo root or nested beside the app.
 *
 * Kept as a Groovy snippet rather than an absolute path baked in at prebuild
 * time: `android/settings.gradle` is committed, and a committed absolute path is
 * one developer's home directory imposed on everyone else's checkout.
 */
const VIRO_ROOT_SNIPPET = `
def viroPackageRoot = new File(
  providers.exec {
    workingDir(rootDir)
    commandLine("node", "--print", "require.resolve('@reactvision/react-viro/package.json')")
  }.standardOutput.asText.get().trim()
).getParentFile()
`;

function withViroSettingsPaths(config) {
  return withSettingsGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error(
        'with-viro-android-linkage: settings.gradle is not Groovy; the Viro project paths were left unrepaired.',
      );
    }

    let contents = gradleConfig.modResults.contents;

    /*
      Fail loudly rather than silently doing nothing. If the fork stops writing
      these lines — a bump changes the shape, or the plugin is dropped from
      `app.config.ts` — the build that follows fails deep inside Gradle with an
      unresolved project, and nothing points back here. An upstream plugin that
      has already solved this is also worth knowing about, so that this file can
      be deleted rather than quietly duplicating it.
    */
    const missing = VIRO_PROJECTS.filter(
      (name) => !contents.includes(`project(':${name}').projectDir`),
    );
    if (missing.length > 0) {
      throw new Error(
        `with-viro-android-linkage: expected @reactvision/react-viro's config plugin to have written projectDir for ${missing.join(', ')}. ` +
          'It did not. Check that the Viro plugin is still listed AFTER this one in app.config.ts — see this file\'s header for why that is the right way round.',
      );
    }

    /*
      Declared ABOVE the first use, not appended. `settings.gradle` is a script
      that runs top to bottom, so a `def` after the `project(...).projectDir`
      lines that read it leaves them referencing an undefined variable — which
      Groovy reports as `No such property: viroPackageRoot`, at configuration
      time, with no hint that the declaration exists ten lines lower.
    */
    const firstUse = contents.indexOf(`project(':${VIRO_PROJECTS[0]}').projectDir`);
    contents = `${contents.slice(0, firstUse)}${VIRO_ROOT_SNIPPET}\n${contents.slice(firstUse)}`;

    for (const name of VIRO_PROJECTS) {
      contents = contents.replace(
        new RegExp(`project\\(':${name}'\\)\\.projectDir\\s*=\\s*new File\\([^)]*\\)`),
        `project(':${name}').projectDir = new File(viroPackageRoot, 'android/${name}')`,
      );
    }

    gradleConfig.modResults.contents = contents;
    return gradleConfig;
  });
}

function withViroFlavorStrategy(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error(
        'with-viro-android-linkage: app/build.gradle is not Groovy; the Viro flavour strategy was not applied.',
      );
    }

    const contents = gradleConfig.modResults.contents;
    const strategy = `missingDimensionStrategy '${FLAVOR_DIMENSION}', '${FLAVOR}'`;
    if (contents.includes(strategy)) return gradleConfig;

    /*
      Anchored on `applicationId`, which is the first line Expo writes inside
      `defaultConfig` and is unique in the file. Anchoring on `defaultConfig {`
      itself would also match a `defaultConfig` in a `buildTypes` or flavour
      block in some future template.
    */
    const anchor = /(applicationId ['"][^'"]+['"])/;
    if (!anchor.test(contents)) {
      throw new Error(
        "with-viro-android-linkage: no applicationId found in app/build.gradle's defaultConfig, so the Viro flavour strategy had nowhere to go.",
      );
    }

    gradleConfig.modResults.contents = contents.replace(anchor, `$1\n        ${strategy}`);
    return gradleConfig;
  });
}

// RN defaults to a variant literally named "debug". With device flavors,
// declare each debug variant so the headset loads development JS from Metro.
function withViroDebugVariants(config) {
  return withAppBuildGradle(config, (gradleConfig) => {
    const contents = gradleConfig.modResults.contents;
    const variants = 'debuggableVariants = ["mobileDebug", "picoDebug", "questDebug"]';
    if (contents.includes(variants)) return gradleConfig;
    if (!/^react\s*\{/m.test(contents)) {
      throw new Error('with-viro-android-linkage: missing React Gradle extension');
    }
    gradleConfig.modResults.contents = contents.replace(/^react\s*\{/m, `react {\n    ${variants}`);
    return gradleConfig;
  });
}

/**
 * Tells a PICO that `VRActivity` is the immersive one.
 *
 * Viro's plugin writes ONE category onto the generated `VRActivity`:
 * `com.oculus.intent.category.VR`. That is Meta's, and a PICO does not know it —
 * the categories PICO OS and any OpenXR loader enumerate immersive activities by
 * are `com.pico.intent.category.VR` (and the pre-namespace-migration
 * `com.picovr.intent.category.VR`) plus Khronos'
 * `org.khronos.openxr.intent.category.IMMERSIVE_HMD`.
 *
 * Additive: the Oculus category stays, so one APK is still immersive on both.
 * Idempotent, because prebuild runs more than once.
 *
 * The names are taken from `@expo-pico/core`'s LAUNCHER_CATEGORIES rather than
 * typed from memory — that package is where this platform's manifest facts live
 * for this workspace, and `withPicoOpenXrLoader` from the same package writes
 * the other half (see `app.config.ts`).
 */
const PICO_VR_CATEGORIES = [
  'com.pico.intent.category.VR',
  'com.picovr.intent.category.VR',
  'org.khronos.openxr.intent.category.IMMERSIVE_HMD',
];

function withPicoVrActivityCategories(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const application = manifestConfig.modResults.manifest.application?.[0];
    const vrActivity = application?.activity?.find(
      (entry) => entry.$?.['android:name'] === '.VRActivity',
    );
    if (!vrActivity) {
      throw new Error(
        'with-viro-android-linkage: no .VRActivity in the manifest, so the PICO ' +
          'launcher categories had nowhere to go. Check that the Viro plugin still ' +
          "has QUEST in its android.xRMode — without it there is no VR activity at all.",
      );
    }
    const filter = vrActivity['intent-filter']?.[0];
    if (!filter) {
      throw new Error(
        'with-viro-android-linkage: .VRActivity has no intent-filter to add the PICO ' +
          'categories to.',
      );
    }
    const categories = (filter.category ??= []);
    for (const name of PICO_VR_CATEGORIES) {
      if (categories.some((entry) => entry.$?.['android:name'] === name)) continue;
      categories.push({ $: { 'android:name': name } });
    }
    return manifestConfig;
  });
}

/**
 * Keeps the phone build installable on phones.
 *
 * With QUEST in its `xRMode`, Viro's plugin writes
 * `android.hardware.vr.headtracking` with `required="true"` into the MAIN
 * manifest (the fork's `withViroAndroid.ts`, "Quest-specific features"). Every
 * flavour inherits main, including `mobile`, so Play's device filter would
 * hide the phone build from every phone and tablet.
 *
 * The requirement is a headset fact, so it moves to the headset source sets.
 * `@expo-pico/core` already declares it in `src/pico/`. Quest has no source
 * set of its own, so this writes `src/quest/AndroidManifest.xml` with just
 * that one feature. Whole-file, because this plugin owns that file and prebuild
 * runs more than once.
 */
const HEADTRACKING = 'android.hardware.vr.headtracking';

function withHeadtrackingOnHeadsetsOnly(config) {
  config = withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    manifest['uses-feature'] = (manifest['uses-feature'] ?? []).filter(
      (entry) => entry.$?.['android:name'] !== HEADTRACKING,
    );
    return manifestConfig;
  });

  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const questDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'quest',
      );
      fs.mkdirSync(questDir, { recursive: true });
      await AndroidConfig.Manifest.writeAndroidManifestAsync(
        path.join(questDir, 'AndroidManifest.xml'),
        {
          manifest: {
            $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android' },
            'uses-feature': [
              {
                $: {
                  'android:name': HEADTRACKING,
                  'android:required': 'true',
                  'android:version': '1',
                },
              },
            ],
          },
        },
      );
      return modConfig;
    },
  ]);
}

module.exports = function withViroAndroidLinkage(config) {
  return withHeadtrackingOnHeadsetsOnly(
    withPicoVrActivityCategories(withViroDebugVariants(withViroFlavorStrategy(withViroSettingsPaths(config)))),
  );
};

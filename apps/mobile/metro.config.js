const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/**
 * Point solito's react-navigation imports at the copy expo-router VENDORS.
 *
 * expo-router 57 bundles its own react-navigation under
 * build/react-navigation/*, and it is that copy which mounts LinkingContext.
 * solito reaches for the standalone `@react-navigation/native`
 * (solito/build/router/use-link-to.js -> useLinkTo), which is a different module
 * instance with a different context object — so every solito `useRouter()` threw
 * "Couldn't find a LinkingContext context." at runtime.
 *
 * Redirecting the bare specifiers collapses the two instances back into one.
 * Subpath imports are left alone; only the package roots are ambiguous.
 */
const VENDORED_NAVIGATION = {
  "@react-navigation/native": path.resolve(
    __dirname,
    "../../node_modules/expo-router/build/react-navigation/native",
  ),
  "@react-navigation/core": path.resolve(
    __dirname,
    "../../node_modules/expo-router/build/react-navigation/core",
  ),
};

/**
 * Collapse every three.js specifier onto the WebGPU build.
 *
 * Ported from wcandillon/react-native-webgpu `apps/example/metro.config.js`,
 * which is the only configuration this renderer is known to work under.
 *
 * WHY IT IS NEEDED AT ALL. three's own `exports` map already answers
 * `three/webgpu` and `three/tsl`, so on paper Metro could resolve them. Two
 * things break that in practice:
 *
 *  1. Bare `three` resolves to `build/three.module.js` — the WebGL build. That
 *     is a SECOND copy of three in the bundle, with its own class identities.
 *     `packages/avatar` imports `three/webgpu` and `three/tsl` directly, while
 *     three's own `examples/jsm/*` addons (GLTFLoader among them) import bare
 *     `three`. Left alone, the GLTFLoader would build `Mesh`es from the WebGL
 *     module that the WebGPU renderer does not recognise as its own. Every
 *     specifier must land on `three.webgpu.js` or nothing composes.
 *  2. `node-linker=hoisted` puts three in the workspace root, not in
 *     `apps/mobile/node_modules`, so the path is resolved explicitly rather
 *     than left to node resolution from this directory.
 *
 * The addons branch differs from upstream on purpose: upstream appends `.js`
 * unconditionally because its example imports `three/addons/loaders/GLTFLoader`
 * bare. This repo writes the extension (`.../GLTFLoader.js`, the form three's
 * own docs use), and an unconditional append would ask Metro for
 * `GLTFLoader.js.js`. Append only when it is missing, so both spellings work.
 */
const THREE_ROOT = path.resolve(__dirname, "../../node_modules/three");
const THREE_WEBGPU = path.join(THREE_ROOT, "build/three.webgpu.js");
const THREE_TSL = path.join(THREE_ROOT, "build/three.tsl.js");

function resolveThree(moduleName) {
  if (moduleName === "three" || moduleName === "three/webgpu") {
    return THREE_WEBGPU;
  }
  if (moduleName === "three/tsl") return THREE_TSL;
  if (moduleName === "three/addons") {
    return path.join(THREE_ROOT, "examples/jsm/Addons.js");
  }
  if (moduleName.startsWith("three/addons/")) {
    const subpath = moduleName.slice("three/addons/".length);
    return path.join(
      THREE_ROOT,
      "examples/jsm",
      subpath.endsWith(".js") ? subpath : `${subpath}.js`,
    );
  }
  // `three/examples/jsm/*` and `three/src/*` are already exact file paths; they
  // only need the hoisted root prefixed onto them.
  if (
    moduleName.startsWith("three/examples/") ||
    moduleName.startsWith("three/src/")
  ) {
    return path.join(THREE_ROOT, moduleName.slice("three/".length));
  }
  return null;
}

const LIB0_WEBCRYPTO_NATIVE = path.resolve(
  __dirname,
  "src/lib0-webcrypto.native.js",
);

const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // The visionOS fork bundles React's 19.2.3 renderer; mobile uses 19.3.
  // Route every React entry (including jsx-runtime) to the same matching copy.
  const visionOS = platform === "visionos" || context.customResolverOptions?.platformExtension === "visionos";
  if (visionOS && (moduleName === "react" || moduleName.startsWith("react/"))) {
    const entry = "react-visionos" + moduleName.slice("react".length);
    return { type: "sourceFile", filePath: require.resolve(entry) };
  }
  const vendored = VENDORED_NAVIGATION[moduleName];
  if (vendored) {
    return { type: "sourceFile", filePath: require.resolve(vendored) };
  }
  if (moduleName === "three" || moduleName.startsWith("three/")) {
    const threeFile = resolveThree(moduleName);
    if (threeFile) return { type: "sourceFile", filePath: threeFile };
  }
  // lib0's `react-native` export condition wants `isomorphic-webcrypto`, which
  // this repo does not install, so yjs could not bundle for the board at all.
  // Web is left alone deliberately: there the browser build's `crypto` global
  // is real, and better than anything shimmed over it.
  if (moduleName === "lib0/webcrypto" && platform !== "web") {
    return { type: "sourceFile", filePath: LIB0_WEBCRYPTO_NATIVE };
  }
  // React Native 0.88 deleted `Libraries/Image/AssetRegistry`; the same two
  // functions (registerAsset, getAssetByID) now live at the public
  // `react-native/asset-registry` entry, which is also Metro's
  // `transformer.assetRegistryPath`, so aliasing keeps ONE registry instance.
  // Three published packages still deep-import the old path
  // (@reactvision/react-viro, react-native-nitro-image, expo-asset at the time
  // of writing); the other two `Libraries/Image/*` files they import still
  // exist, so only this one is redirected.
  if (moduleName === "react-native/Libraries/Image/AssetRegistry") {
    return {
      type: "sourceFile",
      filePath: require.resolve("react-native/asset-registry"),
    };
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

/*
  glTF and its sidecars must be ASSETS, not source. `bin` in particular: without
  it Metro tries to parse a binary buffer as JavaScript. `hdr` is here for the
  environment map, `jpg`/`png` for the split-glTF textures (png is already in
  Expo's defaults; jpg is not universally).

  These are needed for the dev-server path only — release builds resolve the
  avatar through `packages/avatar/src/assets.ts`'s manifest + downloader,
  because release asset flattening rewrites relative paths and a split `.gltf`
  can no longer find its `.bin` sibling.
*/
config.resolver.assetExts = Array.from(
  new Set([...config.resolver.assetExts, "glb", "gltf", "bin", "jpg", "hdr", "riv"]),
);

// withUniwindConfig must be the OUTERMOST wrapper — it has to see the final
// transformer chain. cssEntryFile must stay a relative path string; Uniwind
// rejects path.resolve/path.join here, and the file's directory is what
// Tailwind treats as the scan root (hence the @source lines in global.css).

// viro-visionos — visionOS platform resolver

// Viro loads these through `require()`, and Metro treats anything not in assetExts as source.
// Without this, `<ViroLightingEnvironment source={require('./env.hdr')} />` fails the bundle with
// "Unable to resolve ./env.hdr" before a single frame is drawn — which is a confusing first
// experience for a file that is plainly an asset.
// Without visionos in resolver.platforms, Metro never tries a module's `.native.js` variant on
// this platform, so any package shipping one silently resolves to its **web** build. expo-asset is
// how this surfaces: its web AssetSourceResolver returns an empty uri, and every require()'d image
// reaches the native side with no URL at all.
config.resolver.platforms = [...new Set([...(config.resolver.platforms ?? []), 'visionos'])];

const VIRO_ASSET_EXTS = ['glb', 'gltf', 'hdr', 'obj', 'mtl', 'vrx'];
for (const ext of VIRO_ASSET_EXTS) {
  if (!config.resolver.assetExts.includes(ext)) {
    config.resolver.assetExts.push(ext);
  }
}

/*
  `react-native/*` entry points the visionOS fork is too old to publish.

  The rewrite below has to send every `react-native/*` specifier at
  `@reactvision/react-native-visionos`: the visionOS binary links the fork's
  native runtime, so a second copy of React Native's JavaScript would stand up
  its own BatchedBridge, NativeModules and asset registry against a native side
  that never sees them. One JS runtime per native runtime, or nothing composes.

  What breaks that is a version skew. The fork is on the 0.86 line — package
  version 0.86.4, `reactNativeUpstreamVersion` 0.86.3 — while this app's
  `react-native` is 0.88.0-rc.2, and 0.87/0.88 added public entry points the
  older tree does not have at all. Its `src/` holds only `private/` and
  `types/`, and its `exports` map has no key for either of these:

    react-native/setup-env
      The side-effectful environment bootstrap (global timers, console,
      symbolicated stack traces). `@expo/metro-runtime/build/location/
      install.native.js` imports it on line 4, so the visionOS bundle died on
      "Unable to resolve module react-native/setup-env" before Metro had
      finished walking Expo's own runtime. 0.86 ships that code at
      `Libraries/Core/InitializeCore`; both files are the same one-line
      `require('.../private/setup/setUpDefaultReactNativeEnvironment').default()`,
      and in 0.88 InitializeCore has been reduced to a deprecated shim over
      setup-env, so the redirect points at the older name for the same module.

    react-native/asset-registry
      The 0.88 home of registerAsset/getAssetByID, and the literal value of
      `transformer.assetRegistryPath` in `@expo/metro-config`, which means the
      asset transformer emits this specifier into every image module. On 0.86 it
      is `Libraries/Image/AssetRegistry`, a re-export of
      `@react-native/assets-registry/registry` — the same two functions.

  Both are redirected INTO the fork rather than excluded from the rewrite and
  left to fall through to `react-native`. Falling through would resolve — the
  0.88 files are on disk — and would silently buy the bundle a second React
  Native environment and a second asset registry. A registry that is not the one
  the native side reads returns undefined from `getAssetByID` for every
  `require()`d image, which shows up as blank images and not as an error.

  Keeping `Libraries/Image/AssetRegistry` inside the fork is also why the 0.88
  AssetRegistry alias further up this file is a no-op on visionOS: this resolver
  is installed last, so it rewrites the specifier before that alias ever sees it,
  and both the alias's deep importers and the transformer's `asset-registry`
  specifier converge on the fork's single copy.
*/
const VISIONOS_FORK_ENTRY_FALLBACKS = {
  'react-native/setup-env':
    '@reactvision/react-native-visionos/Libraries/Core/InitializeCore',
  'react-native/asset-registry':
    '@reactvision/react-native-visionos/Libraries/Image/AssetRegistry',
};

/*
  `.visionos.*` siblings, which Metro does not resolve on its own here.

  The fork reports itself as iOS at runtime — `RCTConstants.m:10` sets
  `RCTPlatformName = @"ios"` — and carries visionOS only as a resolver OPTION:
  `RCTBundleURLProvider.mm:471` appends `resolver.platformExtension=visionos`
  under `#if TARGET_OS_VISION`, and `scripts/react-native-xcode.sh:158-160`
  passes the same flag when bundling for release. So the bundle everything
  actually loads is built at `--platform ios`, not `--platform visionos`.

  Nothing in `metro/src` or `metro-resolver/src` reads `platformExtension`, and
  Expo's own `constructPlatformExtensions` keys off `platform`. Left alone,
  Metro therefore picks `hearts-gpu.tsx` over `hearts-gpu.visionos.tsx` and
  `KeyboardProvider.tsx` over `KeyboardProvider.visionos.tsx` — and both of
  those import a native module visionOS does not autolink
  (react-native-webgpu, react-native-keyboard-controller), so the app throws
  `TurboModuleRegistry.getEnforcing` on its first frame. The `.visionos.tsx`
  files are not belt-and-braces; without this they are dead code.

  The extension list mirrors what Expo builds for tvos and macos in
  `@expo/config/build/paths/extensions.js` (`PLATFORM_EXTENSIONS`): the target's
  own tag first, then the platform it falls back to, then `native`, then bare.
  visionOS is not in that table, which is why it is spelled out here.
*/
const VISIONOS_SOURCE_EXTS = ['visionos', 'ios', 'native'].flatMap((tag) =>
  config.resolver.sourceExts.map((ext) => `${tag}.${ext}`),
).concat(config.resolver.sourceExts);

const viroPreviousResolver = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const visionOS = platform === 'visionos' || context.customResolverOptions?.platformExtension === 'visionos';
  let name = moduleName;
  let resolverContext = context;
  if (visionOS) {
    if (name === 'react-native' || name.startsWith('react-native/')) {
      name =
        VISIONOS_FORK_ENTRY_FALLBACKS[name] ??
        '@reactvision/react-native-visionos' + name.slice('react-native'.length);
    }
    // The tags are already folded into the extension list, so Metro must not
    // also prepend `.ios.`/`.native.` of its own — that would ask for
    // `foo.ios.visionos.tsx`, which nothing is named.
    resolverContext = { ...context, sourceExts: VISIONOS_SOURCE_EXTS, preferNativePlatform: false };
  }
  return viroPreviousResolver
    ? viroPreviousResolver(resolverContext, name, platform)
    : resolverContext.resolveRequest(resolverContext, name, platform);
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
  polyfills: {
    /*
      16, the same root the web fork and the token scale assume.
      This was 14 — NativeWind's old base, kept "so nothing shifts across the
      migration" — which silently rendered the ENTIRE app at 87.5%: body 17
      became 14.9, the K–2 target 72 became 63, and every gate that reasoned in
      rem (check-targets among them) certified numbers the device never showed.
      A token scale is a contract about sizes; honouring it at 0.875 is not a
      smaller version of honouring it.
    */
    rem: 16,
  },
});

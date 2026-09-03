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

const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const vendored = VENDORED_NAVIGATION[moduleName];
  if (vendored) {
    return { type: "sourceFile", filePath: require.resolve(vendored) };
  }
  if (moduleName === "three" || moduleName.startsWith("three/")) {
    const threeFile = resolveThree(moduleName);
    if (threeFile) return { type: "sourceFile", filePath: threeFile };
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
  new Set([...config.resolver.assetExts, "glb", "gltf", "bin", "jpg", "hdr"]),
);

// withUniwindConfig must be the OUTERMOST wrapper — it has to see the final
// transformer chain. cssEntryFile must stay a relative path string; Uniwind
// rejects path.resolve/path.join here, and the file's directory is what
// Tailwind treats as the scan root (hence the @source lines in global.css).
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

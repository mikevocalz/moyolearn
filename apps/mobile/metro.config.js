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

const upstreamResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const vendored = VENDORED_NAVIGATION[moduleName];
  if (vendored) {
    return { type: "sourceFile", filePath: require.resolve(vendored) };
  }
  return upstreamResolveRequest
    ? upstreamResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

// withUniwindConfig must be the OUTERMOST wrapper — it has to see the final
// transformer chain. cssEntryFile must stay a relative path string; Uniwind
// rejects path.resolve/path.join here, and the file's directory is what
// Tailwind treats as the scan root (hence the @source lines in global.css).
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  dtsFile: "./uniwind-types.d.ts",
  polyfills: {
    // NativeWind's rem base was 14, Uniwind defaults to 16. Keeping 14 means
    // no spacing/sizing shift across the migration.
    rem: 14,
  },
});

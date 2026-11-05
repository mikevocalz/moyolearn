// Spark's generated Metro config plus watch folders for the shared files the
// desktop app imports by relative path: packages/theme/tokens.ts (no imports)
// and packages/auth/src/entitlements.ts + billing-plans.ts (no imports beyond
// each other). apps/desktop sits outside the root pnpm workspace, so Metro would
// not otherwise watch ../../packages. No extraNodeModules or resolver overrides.
// SOT-KEYWORDS: desktop metro spark watchFolders theme
const path = require("node:path");
const { makeMetroConfig } = require("expo-desktop-metro-config");
const { withDesktop } = require("@legendapp/spark/metro");

const config = withDesktop(makeMetroConfig(__dirname));
const shared = ["../../packages/theme", "../../packages/auth/src"].map((dir) => path.resolve(__dirname, dir));
config.watchFolders = [...new Set([...(config.watchFolders ?? []), ...shared])];
module.exports = config;

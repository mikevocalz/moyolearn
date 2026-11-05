// Spark's generated Metro config plus one watch folder for the shared theme
// tokens. apps/desktop sits outside the root pnpm workspace, so Metro would not
// otherwise watch ../../packages. No extraNodeModules or resolver overrides:
// tokens.ts has no imports, so nothing else crosses the boundary.
// SOT-KEYWORDS: desktop metro spark watchFolders theme
const path = require("node:path");
const { makeMetroConfig } = require("expo-desktop-metro-config");
const { withDesktop } = require("@legendapp/spark/metro");

const config = withDesktop(makeMetroConfig(__dirname));
const sharedTheme = path.resolve(__dirname, "../../packages/theme");
config.watchFolders = [...new Set([...(config.watchFolders ?? []), sharedTheme])];
module.exports = config;

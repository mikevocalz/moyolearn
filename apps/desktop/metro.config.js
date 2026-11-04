const path = require("node:path");
const { metroConfig } = require("@legendapp/spark/metro");

// Keep Spark's native resolver and JSI entry unchanged. The desktop preview
// imports only Moyo's pure theme tokens from the Expo 58 root workspace.
const config = metroConfig(__dirname);
const sharedTheme = path.resolve(__dirname, "../../packages/theme");
config.watchFolders = [...new Set([...(config.watchFolders ?? []), sharedTheme])];
module.exports = config;

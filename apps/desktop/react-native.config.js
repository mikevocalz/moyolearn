// Spark owns macOS native-module discovery. Do not reuse apps/mobile native config.
module.exports = require("@legendapp/spark/native").nativeConfig(__dirname);

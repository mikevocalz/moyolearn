// Spark / Hermes entry, independent of the mobile Expo Router entry.
// runtime-entry must load first; the guard skips root registration inside
// Spark's threaded worker runtimes, which share this bundle.
// SOT-KEYWORDS: desktop entry spark runtime-entry register-root
require("@legendapp/spark/runtime-entry");
if (!(globalThis as { __THREADED_RUNTIME_ENV__?: object }).__THREADED_RUNTIME_ENV__) {
  // Secondary windows register their AppRegistry roots before the main root.
  require("./src/windows");
  const { registerRootComponent } = require("expo") as typeof import("expo");
  registerRootComponent((require("./App") as typeof import("./App")).default);
}

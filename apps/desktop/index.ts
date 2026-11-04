// Native Spark / Hermes entry, deliberately independent of the mobile Expo Router.
require("@legendapp/spark/runtime-entry");
if (!(globalThis as { __THREADED_RUNTIME_ENV__?: unknown }).__THREADED_RUNTIME_ENV__) {
  const { registerRootComponent } = require("expo") as typeof import("expo");
  registerRootComponent(require("./App").default);
}

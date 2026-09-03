module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      /*
        Transpiles `"use gpu"` bodies to WGSL at build time — required by
        Redraw's custom stroke/feather callbacks (redraw.dev/docs/installation).
        Without it those functions ship as ordinary JS and silently draw
        nothing on device, which is a runtime symptom with a build-time cause.
        Harmless while no such body exists: it only rewrites functions that
        carry the directive.
      */
      "unplugin-typegpu/babel",
      // Worklets last: it must see the final plugin output.
      "react-native-worklets/plugin",
    ],
  };
};

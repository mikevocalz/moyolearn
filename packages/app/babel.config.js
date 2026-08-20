// This package publishes raw TS/TSX source (package.json "exports" point at .ts/.tsx),
// so consumers transform it themselves. babel-preset-expo is what gives Expo/Metro the
// TypeScript, JSX and React Native syntax support to do that. Not used by tests —
// the suites run on node:test, which needs no babel.
module.exports = { presets: ['babel-preset-expo'] };

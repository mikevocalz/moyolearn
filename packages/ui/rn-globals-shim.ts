/**
 * RN globals for web bundlers (Turbopack has no DefinePlugin): transpiled RN
 * packages read __DEV__ and process.env.EXPO_OS at module scope (babel-preset-
 * expo inlines these on native; the web bundler does not). Imported FIRST by
 * tw.tsx/primitives so ordering holds for every entry point.
 * SOT: this file — the only place these globals are defined outside Metro.
 * SOT-KEYWORDS: globals shim __DEV__ process.env EXPO_OS web bundler turbopack
 */
// Declared as the exact surface this file touches rather than Record<string, any>:
// the shim's whole job is writing globals, so a wide type here would hide a typo
// in the one place nothing else is checking.
declare const globalThis: {
  __DEV__?: boolean;
  process?: { env?: Record<string, string | undefined> };
};

if (typeof globalThis.__DEV__ === 'undefined') {
  globalThis.__DEV__ =
    typeof globalThis.process !== 'undefined'
      ? globalThis.process.env?.NODE_ENV !== 'production'
      : false;
}

// expo-modules (expo-image etc.) read process.env.EXPO_OS at module scope
globalThis.process ??= { env: {} };
globalThis.process.env ??= {};
// SSR and browser both: outside Metro nothing inlines this, so define it.
globalThis.process.env.EXPO_OS ??= 'web';
export {};

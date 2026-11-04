/**
 * Integration boundary for Nitro v1 on macOS.
 *
 * shirakaba/nitro-node proves a Node V8 host and a SEPARATE Expo Desktop Hermes
 * example on RN 0.83 + patched RN 0.88 JSI. Importing its Node package into
 * Hermes does NOT install Node APIs. Never probe process.dlopen or load .node
 * addons in the React Native runtime.
 *
 * A future audited native Moyo adapter must explicitly install this handshake
 * after validating matching JSI ABI, Nitro nightly, memory lifetime, async
 * dispatcher, code-signing and release packaging. Until then, fail closed.
 */
export const EXPECTED_NITRO_VERSION =
  "1.0.0-alpha.nightly.100.g107f6fc66597" as const;

export type DesktopNitroReadiness =
  | { readonly ready: false; readonly reason: "no-verified-native-adapter" }
  | { readonly ready: true; readonly version: typeof EXPECTED_NITRO_VERSION };

export function desktopNitroReadiness(): DesktopNitroReadiness {
  // No trusted adapter is included in this preview. Do not infer readiness
  // from a global NitroModulesProxy installed by some unrelated native module.
  return { ready: false, reason: "no-verified-native-adapter" };
}

/**
 * Probe for the Nitro runtime inside the desktop Hermes runtime.
 *
 * Desktop runs Nitro v1, the same 1.0.0-alpha.nightly.100 that mobile pins
 * (Mike's ruling, 2026-11-04), as Moyo's Legend Spark macOS port of
 * react-native-nitro-modules (apps/desktop/vendors/, pinned through
 * `overrides`). Spark 0.0.2's own patched 0.37.0 is not used. apps/desktop
 * keeps its own lockfile because Spark pins React Native macOS 0.83 while the
 * root workspace is on React Native 0.88.
 *
 * The module is required lazily because importing react-native-nitro-modules
 * throws `ModuleNotFoundError` when the host has not installed the NitroModules
 * TurboModule (src/turbomodule/NativeNitroModules.ts in the package). A throw
 * at import would take the whole shell down; a failed probe is reported instead.
 *
 * "available" means the Nitro proxy is installed and its native version
 * matches the JS package. `hybridClasses` lists the HybridObject classes the
 * host registered (v1 names them `<cxxNamespace>.<Class>`).
 * SOT: apps/desktop/package.json (overrides) · docs/desktop/adr/0002-nitro-desktop-adapter.md
 * SOT-KEYWORDS: desktop nitro readiness probe hybrid-object spark v1 nightly
 */
import type { NitroModulesProxy } from "react-native-nitro-modules";

export const EXPECTED_NITRO_VERSION = "1.0.0-alpha.nightly.100.g107f6fc66597" as const;

export type NitroProbe =
  | { readonly available: false; readonly reason: "not-installed"; readonly detail: string }
  | { readonly available: false; readonly reason: "version-mismatch"; readonly nativeVersion: string }
  | {
      readonly available: true;
      readonly version: typeof EXPECTED_NITRO_VERSION;
      readonly buildType: NitroModulesProxy["buildType"];
      readonly hybridClasses: readonly string[];
    };

type NitroModule = { NitroModules: NitroModulesProxy };

export function probeNitro(): NitroProbe {
  let proxy: NitroModulesProxy;
  try {
    // Lazy on purpose; see the header. Metro resolves this statically.
    proxy = (require("react-native-nitro-modules") as NitroModule).NitroModules;
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return { available: false, reason: "not-installed", detail };
  }
  if (proxy.version !== EXPECTED_NITRO_VERSION) {
    return { available: false, reason: "version-mismatch", nativeVersion: proxy.version };
  }
  return {
    available: true,
    version: EXPECTED_NITRO_VERSION,
    buildType: proxy.buildType,
    hybridClasses: proxy.getAllHybridClassNames(),
  };
}

/** Plain-text summary for the Runtime Diagnostics message dialog. */
export function describeNitroProbe(probe: NitroProbe): string {
  if (!probe.available && probe.reason === "not-installed") {
    return `Nitro is not installed in this runtime.\n${probe.detail}`;
  }
  if (!probe.available) {
    return `Nitro native version ${probe.nativeVersion} does not match JS ${EXPECTED_NITRO_VERSION}.`;
  }
  const classes = probe.hybridClasses.length > 0 ? probe.hybridClasses.join(", ") : "none";
  return `Nitro ${probe.version} (${probe.buildType}). Registered HybridObject classes: ${classes}.`;
}

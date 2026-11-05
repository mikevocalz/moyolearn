/**
 * Probe for the Nitro runtime inside the desktop Hermes runtime.
 *
 * Desktop runs Spark's patched react-native-nitro-modules 0.37.0 (the tarball in
 * spark-packages/, pinned through `overrides`). Mobile runs Nitro v1
 * 1.0.0-alpha.nightly.100; the two cannot share one dependency graph, which is
 * one reason apps/desktop has its own lockfile. #137 checked for the v1
 * nightly here; that was the wrong runtime for Spark 0.0.2.
 *
 * The module is required lazily because importing react-native-nitro-modules
 * throws `ModuleNotFoundError` when the host has not installed the NitroModules
 * TurboModule (lib/.../turbomodule/NativeNitroModules.ts). A throw at import
 * would take the whole shell down; a failed probe is reported instead.
 *
 * "available" means the Nitro core proxy is installed and its native version
 * matches the JS package. It says nothing about Moyo HybridObjects: none exist
 * until PR-D03, and `hybridObjects` lists what the host actually registered.
 * SOT: apps/desktop/package.json (overrides) · docs/desktop/seams/SEAMS.md
 * SOT-KEYWORDS: desktop nitro readiness probe hybrid-object spark 0.37
 */
import type { NitroModules } from "react-native-nitro-modules";

// 0.37.0's index re-exports the `NitroModules` value but not its interface.
type NitroModulesProxy = typeof NitroModules;

export const EXPECTED_NITRO_VERSION = "0.37.0" as const;

export type NitroProbe =
  | { readonly available: false; readonly reason: "not-installed"; readonly detail: string }
  | { readonly available: false; readonly reason: "version-mismatch"; readonly nativeVersion: string }
  | {
      readonly available: true;
      readonly version: typeof EXPECTED_NITRO_VERSION;
      readonly buildType: NitroModulesProxy["buildType"];
      readonly hybridObjects: readonly string[];
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
    hybridObjects: proxy.getAllHybridObjectNames(),
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
  const objects = probe.hybridObjects.length > 0 ? probe.hybridObjects.join(", ") : "none";
  return `Nitro ${probe.version} (${probe.buildType}). Registered HybridObjects: ${objects}.`;
}

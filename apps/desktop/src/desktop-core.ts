/**
 * Loads the MoyoDesktopCore Nitro HybridObject (packages/desktop-native/moyo-desktop-core).
 *
 * Required lazily: importing the package installs Nitro v1 and looks up the
 * generated `MoyoDesktopCore` class, which throws if the native class is not
 * registered (a Spark Runner without this custom build, or a failed autolink).
 * A throw at import would take the shell down, so the failure is returned and
 * shown instead. Registration is fixed at launch, so the first result, one
 * `new MoyoDesktopCore()` instance, is cached.
 * SOT: packages/desktop-native/README.md · docs/desktop/seams/D03.md
 * SOT-KEYWORDS: desktop nitro moyo-desktop-core loader lazy hybridobject v1
 */
import type { MoyoDesktopCore, PlatformInfo } from "moyo-desktop-core";

type CoreModule = { MoyoDesktopCore: new () => MoyoDesktopCore };

export type DesktopCoreProbe =
  | { readonly available: true; readonly core: MoyoDesktopCore }
  | { readonly available: false; readonly detail: string };

let cached: DesktopCoreProbe | undefined;

export function loadDesktopCore(): DesktopCoreProbe {
  if (cached) return cached;
  try {
    // Lazy on purpose; see the header. Metro resolves this statically.
    const { MoyoDesktopCore } = require("moyo-desktop-core") as CoreModule;
    cached = { available: true, core: new MoyoDesktopCore() };
  } catch (cause) {
    cached = { available: false, detail: cause instanceof Error ? cause.message : String(cause) };
  }
  return cached;
}

const GIB = 1024 ** 3;

/** Plain-text lines for the Runtime Diagnostics dialog. */
export function describePlatformInfo(info: PlatformInfo): string {
  return [
    `macOS ${info.osVersion}`,
    `${info.activeProcessorCount} active cores, ${(info.physicalMemoryBytes / GIB).toFixed(0)} GB memory`,
    `Thermal state: ${info.thermalState}`,
  ].join("\n");
}

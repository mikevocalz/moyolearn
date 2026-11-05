// Fails when apps/desktop leaks into the root pnpm workspace.
//
// apps/desktop runs Expo SDK 55 / RN 0.83.10 under Spark 0.0.2, with Moyo's
// CocoaPods port of Nitro v1; the root runs SDK 58 / RN 0.88 with upstream
// Nitro v1 through SwiftPM. If pnpm ever adopts apps/desktop, one graph gets
// both Nitro builds and the root overrides rewrite Spark's pins. Three checks, all against committed files:
//   1. pnpm-workspace.yaml still carries the "!apps/desktop" exclusion.
//   2. pnpm-lock.yaml has no `apps/desktop` importer.
//   3. pnpm-lock.yaml names none of the packages only desktop installs.
// Shared names (react, expo) are expected in both graphs and are not checked.
// Usage: node apps/desktop/scripts/check-root-isolation.mjs [repo root]
// SOT: docs/desktop/adr/0001-spark-isolated-workspace.md
// SOT-KEYWORDS: desktop isolation pnpm workspace lockfile guard spark ci
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? join(import.meta.dirname, "../../.."));
const workspace = readFileSync(join(root, "pnpm-workspace.yaml"), "utf8");
const lockfile = readFileSync(join(root, "pnpm-lock.yaml"), "utf8");

const DESKTOP_ONLY = [
  "@legendapp/spark",
  "expo-desktop",
  "expo-desktop-config-plugins",
  "expo-desktop-metro-config",
  "expo-desktop-prebuild-config",
  "expo-desktop-template-bare-minimum",
  "react-native-macos",
  // The CocoaPods packaging of simdutf-swift exists only for desktop's Nitro
  // port; mobile gets simdutf-swift through SwiftPM.
  "simdutf-swift",
];

const failures = [];
if (!/^\s*-\s*["']?!apps\/desktop["']?\s*$/m.test(workspace)) {
  failures.push('pnpm-workspace.yaml: the "!apps/desktop" exclusion is missing');
}
if (/^\s{2}apps\/desktop:\s*$/m.test(lockfile)) {
  failures.push("pnpm-lock.yaml: apps/desktop is a root importer");
}
for (const name of DESKTOP_ONLY) {
  // Lockfile keys look like `  name@1.2.3:` or `'@scope/name@1.2.3':`; the
  // trailing `@` keeps expo-desktop from matching expo-desktop-metro-config.
  const key = new RegExp(`^\\s+'?${name.replace(/[/.]/g, "\\$&")}@`, "m");
  if (key.test(lockfile)) failures.push(`pnpm-lock.yaml: desktop-only package ${name} is in the root graph`);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Root workspace at ${root} excludes apps/desktop (${DESKTOP_ONLY.length} desktop-only packages absent).`);
}

// Applies Moyo's patches to the installed @legendapp/spark package (postinstall).
//
// Spark 0.0.2's native-patch preflight accepts only the react-native-nitro-modules
// 0.37.0 it ships, and offers no setting to change that. Moyo runs Nitro v1
// nightly.100 on desktop as on mobile (Mike's ruling, 2026-11-04), so
// patches/legendapp-spark-0.0.2-native-patch-overrides.patch teaches the
// preflight to read package.json "sparkNativePatchOverrides" and to print every
// override it uses. See docs/desktop/adr/0002-nitro-desktop-adapter.md.
//
// The script refuses to touch a file whose bytes it does not recognise: before
// patching, the target must hash to Spark 0.0.2's shipped file, and afterwards
// to the expected patched file. Running it twice is a no-op. Writes go through
// a rename so npm cache hardlinks are never modified in place.
// SOT-KEYWORDS: desktop spark cli patch native-patch preflight override nitro v1
import { createHash } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requireFromApp = createRequire(path.join(app, "package.json"));
const sparkManifest = requireFromApp.resolve("@legendapp/spark/package.json");
const spark = path.dirname(sparkManifest);
const { applyPatch } = createRequire(sparkManifest)("diff");

const patches = [
  {
    file: "patches/legendapp-spark-0.0.2-native-patch-overrides.patch",
    sparkVersion: "0.0.2",
    target: "vendor/node_modules/@legendapp/spark-cli/dist/native-patch-preflight.js",
    before: "911fb3a98559b42a9265423ff22d31b428951c192ce3149bc06c90780ee24f1f",
    after: "bb983f459426c5dabe7d11dc1853742d2f03b07ee78c70bf9abe91dbc55a821f",
  },
];

const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const installed = JSON.parse(readFileSync(sparkManifest, "utf8")).version;

for (const patch of patches) {
  if (installed !== patch.sparkVersion) {
    throw new Error(`${patch.file} is for @legendapp/spark ${patch.sparkVersion}; ${installed} is installed. Re-make the patch for this Spark version.`);
  }
  const target = path.join(spark, patch.target);
  const current = readFileSync(target, "utf8");
  const hash = sha256(current);
  if (hash === patch.after) {
    console.log(`apply-spark-patches: ${patch.target} already patched.`);
    continue;
  }
  if (hash !== patch.before) {
    throw new Error(`apply-spark-patches: ${patch.target} has sha256 ${hash}, neither Spark ${patch.sparkVersion}'s file nor the patched one. Reinstall @legendapp/spark.`);
  }
  const next = applyPatch(current, readFileSync(path.join(app, patch.file), "utf8"));
  if (next === false || sha256(next) !== patch.after) {
    throw new Error(`apply-spark-patches: ${patch.file} did not produce the expected ${patch.target}.`);
  }
  const temporary = `${target}.moyo-${process.pid}.tmp`;
  writeFileSync(temporary, next);
  renameSync(temporary, target);
  console.log(`apply-spark-patches: patched ${patch.target} (${patch.file}).`);
}

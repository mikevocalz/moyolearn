// Tests for scripts/production-modules.mjs: the selection-report guard and the
// app-import check, against the Spark package installed in node_modules.
// SOT-KEYWORDS: desktop production modules test spark analyze native import check
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importCheck, importSpecifiers, nativeModulesFor, readSelection } from "./production-modules.mjs";

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("a report with no included modules, or none at all, is refused", () => {
  assert.throws(() => readSelection({ excluded: [] }), /no `included` modules/);
  assert.throws(() => readSelection({ included: [], excluded: [] }), /no `included` modules/);
  assert.throws(() => readSelection(null), /no `included` modules/);
});

test("included and pruned lists come out sorted", () => {
  const selection = readSelection({ included: ["b", "a"], excluded: ["z", "c"] });
  assert.deepEqual(selection.included, ["a", "b"]);
  assert.deepEqual(selection.excluded, ["c", "z"]);
});

test("type-only imports are skipped; require() and re-exports count", () => {
  const source = [
    'import type { A } from "moyo-desktop-core";',
    'export type { B } from "@legendapp/spark/ui";',
    'import { settings } from "@legendapp/spark/settings";',
    'const { core } = require("moyo-desktop-core");',
    'export * from "./vendor/node_modules/@legendapp/spark-ui";',
    "import {\n  a,\n  b,\n} from \"@legendapp/spark/links\";",
  ].join("\n");
  assert.deepEqual(importSpecifiers(source).sort(), [
    "./vendor/node_modules/@legendapp/spark-ui",
    "@legendapp/spark/links",
    "@legendapp/spark/settings",
    "moyo-desktop-core",
  ]);
});

test("@legendapp/spark/settings needs spark-file-system and spark-desktop-app (spark-settings itself is JavaScript)", () => {
  assert.deepEqual(nativeModulesFor("@legendapp/spark/settings", app), ["@legendapp/spark-desktop-app", "@legendapp/spark-file-system"]);
});

test("@legendapp/spark/secure-storage needs its own native module", () => {
  assert.ok(nativeModulesFor("@legendapp/spark/secure-storage", app).includes("@legendapp/spark-secure-storage"));
});

test("moyo-desktop-core needs Nitro through its peer dependency", () => {
  assert.ok(nativeModulesFor("moyo-desktop-core", app).includes("react-native-nitro-modules"));
});

test("an app import whose native module was pruned fails the check", () => {
  const full = importCheck(app, nativeModulesEverywhere());
  assert.equal(full.missing.length, 0);
  const pruned = importCheck(app, nativeModulesEverywhere().filter((name) => name !== "@legendapp/spark-secure-storage"));
  assert.deepEqual(pruned.missing.map((row) => row.specifier), ["@legendapp/spark/secure-storage"]);
  assert.deepEqual(pruned.missing[0].importers, ["src/auth/session.ts"]);
});

/** Every native module any app import needs; stands in for a report that keeps them all. */
function nativeModulesEverywhere() {
  return [...new Set(importCheck(app, []).rows.flatMap((row) => row.modules))];
}

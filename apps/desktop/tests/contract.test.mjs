import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const manifest = JSON.parse(read("../package.json"));
const config = JSON.parse(read("../desktop.config.json"));
const rootWorkspace = read("../../../pnpm-workspace.yaml");

test("desktop has its own package manager boundary", () => {
  assert.match(rootWorkspace, /!apps\/desktop/);
  assert.match(read("../pnpm-workspace.yaml"), /packages:\s*\n\s*- "\."/);
  assert.equal(manifest.dependencies.expo, "55.0.32");
  assert.equal(manifest.dependencies["react-native"], "0.83.10");
  assert.equal(manifest.dependencies["@legendapp/spark"], "0.0.2");
  assert.deepEqual(config.platforms, ["macos"]);
});

test("native preview does not masquerade as authenticated tutoring", () => {
  const entry = read("../App.tsx");
  assert.doesNotMatch(entry, /from\s+["\x27](?:@acme\/app|@acme\/auth|@better-auth|nitro-node)/);
  assert.doesNotMatch(entry, /process\.dlopen\s*\(/);
  const native = read("../src/native-menus.tsx");
  assert.ok(native.includes("openFileDialog("));
  assert.ok(native.includes("useMenu("));
  assert.match(entry, /usePreviewStore/);
  assert.doesNotMatch(native, /from\\s+["\\x27](?:@acme\\/app|@acme\\/auth|@better-auth|nitro-node)/);
  assert.doesNotMatch(native, /process\\.dlopen\\s*\\(/);
});

test("nitro v1 remains explicitly gated until native ABI is validated", () => {
  const gate = read("../src/nitro-readiness.ts");
  assert.match(gate, /1\.0\.0-alpha\.nightly\.100\.g107f6fc66597/);
  assert.match(gate, /no-verified-native-adapter/);
  assert.doesNotMatch(manifest.dependencies["react-native-nitro-modules"] ?? "", /^1\./);
});

test("real Moyo branding is included, not redrawn", () => {
  assert.match(read("../App.tsx"), /\.\/assets\/mark\.png/);
  assert.match(read("../App.tsx"), /packages\/theme\/tokens/);
});

test("desktop dropdowns are actual Spark native controls", () => {
  const native = read("../src/native-menus.tsx");
  const app = read("../App.tsx");
  const store = read("../src/store.ts");
  assert.ok(native.includes('from "@legendapp/spark/ui"'));
  assert.ok(native.includes('from "@legendapp/spark/context-menu"'));
  assert.ok(native.includes("Button as NativeButton"));
  assert.ok(native.includes("Select as NativeSelect"));
  assert.ok(native.includes("showContextMenu("));
  assert.ok(native.includes("measureInWindow("));
  assert.ok(native.includes('windowId: "main"'));
  assert.ok(native.includes('target: { menu: "file" }'));
  assert.ok(native.includes('target: { menu: "view" }'));
  assert.ok(native.includes('shortcut: "CmdOrCtrl+O"'));
  assert.ok(native.includes('checked: density === "compact"'));
  assert.ok(app.includes("<NativeWorkspaceToolbar />"));
  assert.ok(store.includes("setDensity:"));
  assert.doesNotMatch(native, /useState\\s*\\(/);
  assert.ok(!native.includes('position: "absolute"'));
});

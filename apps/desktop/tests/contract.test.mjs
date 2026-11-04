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
  assert.deepEqual(config.platforms, ["macos"]);
});

test("native preview does not masquerade as authenticated tutoring", () => {
  const entry = read("../App.tsx");
  assert.doesNotMatch(entry, /from\s+["\x27](?:@acme\/app|@acme\/auth|@better-auth|nitro-node)/);
  assert.doesNotMatch(entry, /process\.dlopen\s*\(/);
  assert.match(entry, /openFileDialog/);
  assert.match(entry, /useMenu/);
  assert.match(entry, /usePreviewStore/);
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

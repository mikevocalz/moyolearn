// Generated-file contracts; a separate real CMake fixture verifies the emitter.
// SOT: tooling/verify-native-compile-pools.mjs
// SOT-KEYWORDS: android native ci memory ninja compile link pool tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBuildNinjas, verifyBuildNinja, verifyNativeCompilePools } from './verify-native-compile-pools.mjs';

const tooling = dirname(fileURLToPath(import.meta.url));
const compileEdge = 'build CMakeFiles/rnskia.dir/test.cpp.o: CXX_COMPILER__rnskia_Debug test.cpp\n  pool = moyo_native\n';
const linkEdge = 'build librnskia.so: CXX_SHARED_LIBRARY_LINKER__rnskia_Debug CMakeFiles/rnskia.dir/test.cpp.o\n  pool = moyo_native\n';
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'moyo-native-pool-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const skia = join(root, 'node_modules/@shopify/react-native-skia/android');
  const generated = join(skia, '.cxx/Debug/hash/arm64-v8a');
  mkdirSync(join(generated, 'CMakeFiles'), { recursive: true });
  const build = join(generated, 'build.ninja'); const rules = join(generated, 'CMakeFiles/rules.ninja');
  writeFileSync(build, `${compileEdge}\n${linkEdge}`);
  writeFileSync(rules, 'pool moyo_native\n  depth = 2\n');
  return { root, skia, build, rules };
}
test('accepts generated compiler and linker edges sharing one depth-2 pool', (t) => {
  const f = fixture(t); const result = verifyNativeCompilePools(f.root);
  assert.equal(result.compile, 1); assert.equal(result.link, 1); assert.equal(result.files.length, 1);
});
for (const depth of [1, 3, 20]) test(`rejects a different pool depth ${depth}`, (t) => {
  const f = fixture(t); writeFileSync(f.rules, `pool moyo_native\n  depth = ${depth}\n`);
  assert.throws(() => verifyBuildNinja(f.build), /depth-2/);
});
for (const kind of ['COMPILER', 'LINKER']) test(`rejects an unbounded ${kind} edge`, (t) => {
  const f = fixture(t);
  writeFileSync(f.build, `${kind === 'COMPILER' ? compileEdge.replace('  pool = moyo_native\n', '') : compileEdge}\n${kind === 'LINKER' ? linkEdge.replace('  pool = moyo_native\n', '') : linkEdge}`);
  assert.throws(() => verifyBuildNinja(f.build), /unbounded/);
});
test('rejects separate compile/link pools even if each has depth2', (t) => {
  const f = fixture(t); writeFileSync(f.build, `${compileEdge}\n${linkEdge.replace('pool = moyo_native', 'pool = other')}`);
  writeFileSync(f.rules, 'pool moyo_native\n  depth = 2\npool other\n  depth = 2\n');
  assert.throws(() => verifyBuildNinja(f.build), /different pool/);
});
test('cannot pass from only a pool declaration or missing Skia output', (t) => {
  const f = fixture(t); writeFileSync(f.build, '');
  assert.throws(() => verifyBuildNinja(f.build), /no compiler edges/);
  rmSync(f.build); assert.throws(() => verifyNativeCompilePools(f.root), /missing generated Skia/);
});
test('walks workspace links once and ignores other architectures', (t) => {
  const f = fixture(t); symlinkSync(f.root, join(f.root, 'loop'));
  const other = join(f.skia, '.cxx/Debug/hash/x86_64'); mkdirSync(other); writeFileSync(join(other, 'build.ninja'), 'not this gate');
  assert.deepEqual(findBuildNinjas(f.root), [f.build]);
});
test('CI opts into supported CMake pools and retains task, ABI, heap and strict gates', () => {
  const workflow = readFileSync(join(tooling, '../.github/workflows/android-native.yml'), 'utf8');
  const gradle = readFileSync(join(tooling, '../apps/mobile/android/build.gradle'), 'utf8');
  assert.match(workflow, /ORG_GRADLE_PROJECT_moyoNativeJobPool: '2'/);
  assert.match(workflow, /:app:assembleQuestDebug --stacktrace --max-workers=1 --no-parallel -PreactNativeArchitectures=arm64-v8a '-Dorg\.gradle\.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g'/);
  assert.match(workflow, /if: always\(\)\n\s+run: node tooling\/verify-native-compile-pools\.mjs/);
  assert.doesNotMatch(workflow, /continue-on-error|CMAKE_BUILD_PARALLEL_LEVEL/);
  assert.match(gradle, /if \(moyoNativeJobPool != null\)/);
  assert.match(gradle, /getByName\('androidComponents'\)\.finalizeDsl/);
  assert.match(gradle, /cmake\.arguments\.addAll/);
  for (const option of ['-DCMAKE_JOB_POOLS=moyo_native=2', '-DCMAKE_JOB_POOL_COMPILE=moyo_native', '-DCMAKE_JOB_POOL_LINK=moyo_native']) assert.ok(gradle.includes(option));
  assert.match(gradle, /\['com.android.application', 'com.android.library'\]/);
});

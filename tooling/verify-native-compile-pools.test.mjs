// Generated-file contracts; a separate real CMake fixture verifies the emitter.
// SOT: tooling/verify-native-compile-pools.mjs
// SOT-KEYWORDS: android native ci memory ninja compile link pool tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findBuildNinjas, inspectBuildProvenance, inspectNativeCompilePools, verifyBuildNinja, verifyNativeCompilePools } from './verify-native-compile-pools.mjs';

const tooling = dirname(fileURLToPath(import.meta.url));
const compileEdge = 'build CMakeFiles/rnskia.dir/test.cpp.o: CXX_COMPILER__rnskia_Debug test.cpp\n  pool = moyo_native\n';
const linkEdge = 'build librnskia.so: CXX_SHARED_LIBRARY_LINKER__rnskia_Debug CMakeFiles/rnskia.dir/test.cpp.o\n  pool = moyo_native\n';
function currentBuild(directory, source) {
  mkdirSync(join(directory, 'CMakeFiles'), { recursive: true });
  writeFileSync(join(directory, 'build.ninja'), `cmake_ninja_workdir = ${directory}/\n${compileEdge}\n${linkEdge}`);
  writeFileSync(join(directory, 'CMakeFiles/rules.ninja'), 'pool moyo_native\n  depth = 2\n');
  writeFileSync(join(directory, 'CMakeCache.txt'), `CMAKE_CACHEFILE_DIR:INTERNAL=${directory}\nCMAKE_HOME_DIRECTORY:INTERNAL=${source}\nCMAKE_JOB_POOLS:UNINITIALIZED=moyo_native=2\n`);
}
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'moyo-native-pool-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const skia = join(root, 'node_modules/@shopify/react-native-skia/android');
  const generated = join(skia, '.cxx/Debug/hash/arm64-v8a');
  currentBuild(generated, skia);
  const build = join(generated, 'build.ninja'); const rules = join(generated, 'CMakeFiles/rules.ninja');
  const app = join(root, 'apps/mobile/android/app/.cxx/Debug/questHash/arm64-v8a');
  currentBuild(app, join(root, 'apps/mobile/android/app'));
  const appBuild = join(app, 'build.ninja');
  return { root, skia, build, rules, appBuild };
}
test('accepts generated compiler and linker edges sharing one depth-2 pool', (t) => {
  const f = fixture(t); const result = verifyNativeCompilePools(f.root);
  assert.equal(result.compile, 2); assert.equal(result.link, 2); assert.equal(result.files.length, 2);
});
function publishedExpo(f) {
  const published = JSON.parse(readFileSync(join(tooling, 'fixtures/expo-58.0.8-publisher-ninja.json'), 'utf8'));
  const module = join(f.root, 'node_modules/expo-modules-core/android');
  const old = join(module, '.cxx/Debug/632a03m1/arm64-v8a');
  for (const [name, data] of Object.entries(published.files)) {
    mkdirSync(dirname(join(old, name)), { recursive: true });
    writeFileSync(join(old, name), gunzipSync(Buffer.from(data, 'base64')));
  }
  const current = join(module, '.cxx/Debug/currentHost/arm64-v8a');
  currentBuild(current, module);
  return { old, current, published };
}
test('records exact npm-published foreign output only beside a fully verified current Expo build', (t) => {
  const f = fixture(t); const expo = publishedExpo(f);
  const result = verifyNativeCompilePools(f.root);
  assert.equal(result.files.length, 3); assert.equal(result.builds.length, 4);
  const foreign = result.builds.find((build) => build.provenance?.kind === 'published-foreign');
  assert.equal(foreign.provenance.source, expo.published.source);
  assert.equal(foreign.provenance.integrity, expo.published.integrity);
  assert.deepEqual(foreign.pools.declarations, []);
  assert.ok(result.builds.some((build) => build.module.includes('expo-modules-core') && build.provenance?.kind === 'current' && build.edges.compile > 0));
});
test('published foreign files cannot substitute for actual current Expo output', (t) => {
  const f = fixture(t); const expo = publishedExpo(f); rmSync(expo.current, { recursive: true });
  assert.throws(() => verifyNativeCompilePools(f.root), /no verified current build of the same module/);
});
test('published foreign files cannot mask an unbounded current Expo compiler', (t) => {
  const f = fixture(t); const expo = publishedExpo(f); const file = join(expo.current, 'build.ninja');
  writeFileSync(file, readFileSync(file, 'utf8').replace('  pool = moyo_native\n', ''));
  assert.throws(() => verifyNativeCompilePools(f.root), /unbounded/);
});
for (const name of ['build.ninja', 'CMakeFiles/rules.ninja', 'CMakeCache.txt']) test(`changed published ${name} fails closed`, (t) => {
  const f = fixture(t); const expo = publishedExpo(f); const file = join(expo.old, name);
  writeFileSync(file, `${readFileSync(file, 'utf8')}\n# changed\n`);
  assert.throws(() => verifyNativeCompilePools(f.root), /unrecognized foreign/);
});
test('missing and malformed current cache provenance fail closed', (t) => {
  const f = fixture(t); const cache = join(dirname(f.build), 'CMakeCache.txt');
  rmSync(cache); assert.throws(() => verifyNativeCompilePools(f.root), /CMakeCache/);
  writeFileSync(cache, 'CMAKE_CACHEFILE_DIR:INTERNAL=\n');
  assert.throws(() => inspectBuildProvenance(f.root, f.build), /malformed CMAKE_CACHEFILE_DIR/);
});
test('current Ninja and cache directories must agree and source must belong to this checkout', (t) => {
  const f = fixture(t); const cache = join(dirname(f.build), 'CMakeCache.txt');
  writeFileSync(cache, `CMAKE_CACHEFILE_DIR:INTERNAL=${dirname(f.build)}\nCMAKE_HOME_DIRECTORY:INTERNAL=/foreign/source\n`);
  assert.throws(() => inspectBuildProvenance(f.root, f.build), /source is outside/);
  writeFileSync(cache, `CMAKE_CACHEFILE_DIR:INTERNAL=${f.root}/different\nCMAKE_HOME_DIRECTORY:INTERNAL=${f.skia}\n`);
  assert.throws(() => inspectBuildProvenance(f.root, f.build), /directories disagree/);
});
test('diagnostics retain every module and observed pool settings even after an earlier failure', (t) => {
  const f = fixture(t); publishedExpo(f); writeFileSync(f.rules, 'pool moyo_native\n  depth = 3\n');
  const report = inspectNativeCompilePools(f.root);
  assert.equal(report.builds.length, 4); assert.ok(report.errors.length > 0);
  assert.ok(report.builds.some((build) => build.pools.declarations.includes('pool moyo_native\n  depth = 3\n')));
  assert.ok(report.builds.every((build) => Array.isArray(build.pools.cachePoolSettings)));
  assert.ok(report.builds.some((build) => build.module.includes('expo-modules-core') && build.edges?.compile === 1));
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
  assert.deepEqual(findBuildNinjas(f.root), [f.appBuild, f.build].sort());
});
test('requires the application Debug output used by AGP for questDebug', (t) => {
  const f = fixture(t); rmSync(f.appBuild);
  assert.throws(() => verifyNativeCompilePools(f.root), /missing generated application/);
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
test('registers pool callbacks before root plugins can eagerly finalize the app DSL', () => {
  const gradle = readFileSync(join(tooling, '../apps/mobile/android/build.gradle'), 'utf8');
  const assertOrder = (source) => {
    const callback = source.indexOf("getByName('androidComponents').finalizeDsl");
    assert.ok(callback >= 0);
    for (const plugin of ['expo-root-project', 'com.facebook.react.rootproject']) {
      assert.ok(source.indexOf(`apply plugin: "${plugin}"`) > callback, `${plugin} must follow pool registration`);
    }
  };
  assertOrder(gradle);
  const eagerPlugin = 'apply plugin: "com.facebook.react.rootproject"';
  assert.throws(() => assertOrder(`${eagerPlugin}\n${gradle.replace(eagerPlugin, '')}`), /must follow pool registration/);
});

// Offline filesystem contracts; native compilation remains the Actions matrix's responsibility.
// SOT: tooling/enable-skia-graphite.mjs
// SOT-KEYWORDS: skia graphite dawn postinstall provenance warm cache tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ADMISSION, ABIS, enableSkiaGraphite, verifyHeaderArchive } from './enable-skia-graphite.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'moyo-graphite-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const write = (path, content) => { mkdirSync(join(root, path, '..'), { recursive: true }); writeFileSync(join(root, path), content); };
  const pkg = (name, data) => write(`node_modules/${name}/package.json`, JSON.stringify({ name, ...data }));
  pkg('@shopify/react-native-skia', { version: ADMISSION.renderer });
  pkg('react-native-webgpu', { version: ADMISSION.webgpu, dawn: ADMISSION.dawnTag, dependencies: { 'react-native-webgpu-dawn': ADMISSION.version } });
  pkg('react-native-webgpu-dawn', { version: ADMISSION.version, dawn: { skia: ADMISSION.skia, commit: ADMISSION.dawnCommit, patches: ADMISSION.patches } });
  for (const suffix of ['android', 'apple-ios', 'apple-macos']) pkg(`react-native-skia-graphite-${suffix}`, { version: ADMISSION.version, skia: { version: ADMISSION.skia, graphite: true } });
  for (const name of ['dawn/native/MetalBackend.h', 'dawn/native/VulkanBackend.h', 'dawn/dawn_version.h', 'dawn/webgpu.h', 'dawn/webgpu_cpp.h', 'webgpu/webgpu.h', 'webgpu/webgpu_cpp.h', 'webgpu/webgpu_cpp_print.h']) write(`node_modules/react-native-webgpu-dawn/include/${name}`, `fresh ${name}`);
  write('node_modules/react-native-webgpu-dawn/include/dawn/dawn_proc_table.h', '#include "dawn/webgpu.h"');
  write('node_modules/react-native-webgpu-dawn/include/dawn/dawn_version.h', `kDawnVersion = {${ADMISSION.dawnCommit.match(/../g).map((byte) => `0x${byte}`).join(',')}};`);
  for (const abi of ABIS) {
    write(`node_modules/react-native-webgpu-dawn/libs/android/${abi}/libwebgpu_dawn.so`, `shared ${abi}`);
    write(`node_modules/react-native-skia-graphite-android/libs/${abi}/libskia.a`, 'Graphite fixture, not a compiled library');
  }
  let fetches = 0;
  const fetchHeaders = async (destination) => {
    fetches += 1;
    const path = join(destination, 'private-headers'); mkdirSync(path);
    for (const name of ['ContextOptionsPriv.h', 'ResourceTypes.h', 'TextureProxyView.h']) writeFileSync(join(path, name), `fresh ${name}`);
    return path;
  };
  return { root, write, pkg, fetchHeaders, fetches: () => fetches,
    skia: join(root, 'node_modules/@shopify/react-native-skia'),
    run: () => enableSkiaGraphite({ root, fetchHeaders }) };
}

test('absent renderer keeps web-only installation a no-op', async (t) => {
  const f = fixture(t); rmSync(f.skia, { recursive: true });
  assert.match(await f.run(), /absent/); assert.equal(f.fetches(), 0);
});
test('rejects unknown package combinations before publishing a marker', async (t) => {
  const f = fixture(t); f.pkg('react-native-webgpu-dawn', { version: '154.2.0', dawn: {} });
  await assert.rejects(f.run(), /unreviewed/);
  assert.equal(existsSync(join(f.skia, 'libs/.dawn-version')), false); assert.equal(f.fetches(), 0);
});
test('rejects differing Dawn source patches', async (t) => {
  const f = fixture(t); f.pkg('react-native-webgpu-dawn', { version: ADMISSION.version, dawn: { skia: ADMISSION.skia, commit: ADMISSION.dawnCommit, patches: [] } });
  await assert.rejects(f.run(), /unreviewed/);
});
test('rejects Graphite source identity different from shared Dawn', async (t) => {
  const f = fixture(t); f.pkg('react-native-skia-graphite-apple-ios', { version: ADMISSION.version, skia: { version: 'm154', graphite: true } });
  await assert.rejects(f.run(), /unreviewed/);
});
test('requires every Android source artifact before publishing', async (t) => {
  const f = fixture(t); rmSync(join(f.root, 'node_modules/react-native-webgpu-dawn/libs/android/arm64-v8a/libwebgpu_dawn.so'));
  await assert.rejects(f.run(), /incomplete/); assert.equal(f.fetches(), 0);
});
test('rejects stale Dawn headers despite current package metadata', async (t) => {
  const f = fixture(t); f.write('node_modules/react-native-webgpu-dawn/include/dawn/dawn_version.h', 'kDawnVersion = {0x00};');
  await assert.rejects(f.run(), /header source differs/); assert.equal(f.fetches(), 0);
});
test('stages exact owner binaries and normalizes headers like upstream', async (t) => {
  const f = fixture(t); await f.run();
  assert.equal(readFileSync(join(f.skia, 'libs/.dawn-version'), 'utf8'), 'dawn-chrome-m154a');
  assert.equal(readFileSync(join(f.skia, 'cpp/dawn/include/webgpu/webgpu.h'), 'utf8'), 'fresh dawn/webgpu.h');
  assert.equal(existsSync(join(f.skia, 'cpp/dawn/include/dawn/webgpu.h')), false);
  assert.equal(readFileSync(join(f.skia, 'cpp/dawn/include/dawn/dawn_proc_table.h'), 'utf8'), '#include "webgpu/webgpu.h"');
  for (const abi of ABIS) assert.equal(readFileSync(join(f.root, `node_modules/react-native-skia-graphite-android/libs/${abi}/libwebgpu_dawn.so`), 'utf8'), `shared ${abi}`);
});
test('old marker and existing headers cannot preserve stale copy caches', async (t) => {
  const f = fixture(t); const prefix = 'node_modules/@shopify/react-native-skia';
  f.write(`${prefix}/libs/.graphite`, 'm154'); f.write(`${prefix}/libs/.dawn-version`, 'dawn-chrome-m154');
  f.write(`${prefix}/cpp/dawn/include/dawn/native/MetalBackend.h`, 'stale');
  f.write(`${prefix}/cpp/skia/src/gpu/graphite/ContextOptionsPriv.h`, 'stale');
  for (const platform of ['ios', 'macos', 'tvos', 'android']) f.write(`${prefix}/libs/${platform}/.version`, ADMISSION.version);
  await f.run(); assert.equal(f.fetches(), 1);
  assert.equal(readFileSync(join(f.skia, 'cpp/skia/src/gpu/graphite/ContextOptionsPriv.h'), 'utf8'), 'fresh ContextOptionsPriv.h');
  for (const platform of ['ios', 'macos', 'tvos', 'android']) assert.equal(existsSync(join(f.skia, 'libs', platform, '.version')), false);
});
test('warm rerun refreshes stale Dawn headers and shared libraries without redownload', async (t) => {
  const f = fixture(t); await f.run();
  f.write('node_modules/@shopify/react-native-skia/cpp/dawn/include/dawn/native/MetalBackend.h', 'stale');
  f.write('node_modules/react-native-skia-graphite-android/libs/arm64-v8a/libwebgpu_dawn.so', 'stale');
  await f.run(); assert.equal(f.fetches(), 1);
  assert.equal(readFileSync(join(f.skia, 'cpp/dawn/include/dawn/native/MetalBackend.h'), 'utf8'), 'fresh dawn/native/MetalBackend.h');
  assert.equal(readFileSync(join(f.root, 'node_modules/react-native-skia-graphite-android/libs/arm64-v8a/libwebgpu_dawn.so'), 'utf8'), 'shared arm64-v8a');
});
test('incomplete private headers invalidate an otherwise matching stamp', async (t) => {
  const f = fixture(t); await f.run(); rmSync(join(f.skia, 'cpp/skia/src/gpu/graphite/TextureProxyView.h'));
  await f.run(); assert.equal(f.fetches(), 2);
});
test('download failure cannot publish a current admission stamp', async (t) => {
  const f = fixture(t);
  await assert.rejects(enableSkiaGraphite({ root: f.root, fetchHeaders: async () => { throw new Error('download failure'); } }), /download failure/);
  assert.equal(existsSync(join(f.skia, 'libs/.graphite-admission.json')), false);
  assert.equal(existsSync(join(f.skia, 'libs/.dawn-version')), false);
});
test('checksum verifier rejects modified header archive bytes', () => {
  assert.throws(() => verifyHeaderArchive(Buffer.from('tampered headers')), /checksum mismatch/);
});

test('normalizes generated headers without optional upstream webgpu shims', async (t) => {
  const f = fixture(t);
  rmSync(join(f.root, 'node_modules/react-native-webgpu-dawn/include/webgpu'), { recursive: true });
  await f.run();
  assert.equal(readFileSync(join(f.skia, 'cpp/dawn/include/webgpu/webgpu.h'), 'utf8'), 'fresh dawn/webgpu.h');
  assert.equal(readFileSync(join(f.skia, 'cpp/dawn/include/webgpu/webgpu_cpp.h'), 'utf8'), 'fresh dawn/webgpu_cpp.h');
  assert.equal(existsSync(join(f.skia, 'cpp/dawn/include/dawn/webgpu.h')), false);
  assert.equal(readFileSync(join(f.skia, 'libs/.graphite-admission.json'), 'utf8'), JSON.stringify(ADMISSION));
});

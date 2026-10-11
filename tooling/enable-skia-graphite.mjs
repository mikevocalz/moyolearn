#!/usr/bin/env node
// Complete @shopify/react-native-skia's Graphite backend with one reviewed Dawn.
// SOT: upstream skia gitHead 6a53dcd8b63b739f60613dbed61475f6b3c1d9e5;
// docs/decisions/adr-121-gpu-device-topology.md.
// SOT-KEYWORDS: skia graphite dawn webgpu postinstall headers provenance cache
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The 154.3.0 Graphite and shared-Dawn npm artifacts were published from the
// same upstream commit. Dawn's own metadata records both its source and patches.
export const ADMISSION = Object.freeze({
  renderer: '2.14.0', version: '154.3.0', skia: 'm154_8037_58c',
  dawnCommit: '3d786993a7ded64c4ebb4884b9b079db9ad0e580',
  dawnTag: 'chrome-m154a', webgpu: '0.13.1',
  patches: ['metal-maccatalyst.patch', 'tint-looprange-function-variable.patch'],
  // This release and the 154.3.0 publisher both use Skia commit 2466dcf3937437e217e7f284afe0e1aae15891ce.
  // Only its three private Graphite headers are used; Dawn comes from the npm package.
  headersUrl: 'https://github.com/wcandillon/react-native-skia/releases/download/skia-graphite-m154_8037_58a/skia-graphite-headers-skia-graphite-m154_8037_58a.tar.gz',
  headersSha256: '3914793c10cb14949d038e37c0607d5ad7fa29f54f453329f03bc70ae020bf34',
});
export const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86', 'x86_64'];
const GRAPHITE_PACKAGES = ['react-native-skia-graphite-android', 'react-native-skia-graphite-apple-ios', 'react-native-skia-graphite-apple-macos'];
const GRAPHITE_HEADERS = ['ContextOptionsPriv.h', 'ResourceTypes.h', 'TextureProxyView.h'];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

function packageAt(root, name) {
  const path = join(root, 'node_modules', name);
  const manifest = readJson(join(path, 'package.json'));
  if (manifest.name !== name) throw new Error(`skia-graphite: unexpected package identity for ${name}`);
  return { path, manifest };
}

export function inspectPackages(root) {
  const renderer = packageAt(root, '@shopify/react-native-skia');
  const webgpu = packageAt(root, 'react-native-webgpu');
  const dawn = packageAt(root, 'react-native-webgpu-dawn');
  const graphite = GRAPHITE_PACKAGES.map((name) => packageAt(root, name));
  if (renderer.manifest.version !== ADMISSION.renderer || webgpu.manifest.version !== ADMISSION.webgpu ||
      webgpu.manifest.dawn !== ADMISSION.dawnTag ||
      webgpu.manifest.dependencies?.['react-native-webgpu-dawn'] !== ADMISSION.version ||
      dawn.manifest.version !== ADMISSION.version || dawn.manifest.dawn?.skia !== ADMISSION.skia ||
      dawn.manifest.dawn?.commit !== ADMISSION.dawnCommit ||
      JSON.stringify(dawn.manifest.dawn?.patches) !== JSON.stringify(ADMISSION.patches) ||
      graphite.some(({ manifest }) => manifest.version !== ADMISSION.version ||
        manifest.skia?.version !== ADMISSION.skia || manifest.skia?.graphite !== true)) {
    throw new Error('skia-graphite: unreviewed Skia/Graphite/Dawn combination; re-admit matching source, headers and binaries');
  }
  const required = ['dawn/native/MetalBackend.h', 'dawn/native/VulkanBackend.h', 'dawn/dawn_version.h',
    'dawn/dawn_proc_table.h', 'dawn/webgpu.h', 'dawn/webgpu_cpp.h'];
  for (const path of required) {
    if (!existsSync(join(dawn.path, 'include', path))) throw new Error(`skia-graphite: missing shared Dawn header ${path}`);
  }
  const versionHeader = readFileSync(join(dawn.path, 'include/dawn/dawn_version.h'), 'utf8');
  const versionBytes = versionHeader.match(/kDawnVersion\s*=\s*\{([^}]+)\}/)?.[1].match(/0x[\da-f]{2}/gi) ?? [];
  if (versionBytes.map((byte) => byte.slice(2).toLowerCase()).join('') !== ADMISSION.dawnCommit) {
    throw new Error('skia-graphite: shared Dawn header source differs from admitted binary metadata');
  }
  for (const abi of ABIS) {
    if (!existsSync(join(dawn.path, 'libs', 'android', abi, 'libwebgpu_dawn.so')) ||
        !existsSync(join(graphite[0].path, 'libs', abi, 'libskia.a'))) {
      throw new Error(`skia-graphite: incomplete shared-Dawn/Graphite binaries for ${abi}`);
    }
  }
  return { renderer, dawn, graphite };
}

export function verifyHeaderArchive(bytes) {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== ADMISSION.headersSha256) throw new Error(`skia-graphite: header checksum mismatch (${actual})`);
}

async function fetchPrivateHeaders(destination) {
  const response = await fetch(ADMISSION.headersUrl, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`skia-graphite: header download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  verifyHeaderArchive(bytes);
  const tarball = join(destination, 'headers.tgz');
  writeFileSync(tarball, bytes);
  execFileSync('tar', ['--no-same-owner', '-xzf', tarball, '-C', destination]);
  return join(destination, 'packages/skia/cpp/skia/src/gpu/graphite');
}

function copyDawnHeaders(source, destination) {
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
  // Match upstream's copyHeaders normalization: Xcode maps headers by basename.
  // Keep the generated declarations under webgpu/, rather than their forwarding shims.
  rmSync(join(destination, 'dawn/wire'), { recursive: true, force: true });
  const table = join(destination, 'dawn/dawn_proc_table.h');
  writeFileSync(table, readFileSync(table, 'utf8').replaceAll('#include "dawn/webgpu.h"', '#include "webgpu/webgpu.h"'));
  for (const name of ['webgpu.h', 'webgpu_cpp.h']) {
    copyFileSync(join(destination, 'dawn', name), join(destination, 'webgpu', name));
    rmSync(join(destination, 'dawn', name));
  }
  rmSync(join(destination, 'webgpu/webgpu_cpp_print.h'), { force: true });
}

// fetchHeaders is injected only by offline filesystem contract tests; the CLI
// always downloads and verifies the pinned upstream archive above.
export async function enableSkiaGraphite({ root = ROOT, fetchHeaders = fetchPrivateHeaders } = {}) {
  const skia = join(root, 'node_modules/@shopify/react-native-skia');
  if (!existsSync(skia)) return 'skia-graphite: renderer absent, nothing to mark';
  const { dawn, graphite } = inspectPackages(root);
  const libs = join(skia, 'libs');
  const stamp = join(libs, '.graphite-admission.json');
  const expected = JSON.stringify(ADMISSION);
  const privateHeaders = join(skia, 'cpp/skia/src/gpu/graphite');
  const current = existsSync(stamp) && readFileSync(stamp, 'utf8') === expected &&
    existsSync(join(libs, '.graphite')) && GRAPHITE_HEADERS.every((name) => existsSync(join(privateHeaders, name)));
  let temporary;
  try {
    let downloaded;
    if (!current) {
      temporary = mkdtempSync(join(tmpdir(), 'skia-graphite-headers-'));
      downloaded = await fetchHeaders(temporary);
      for (const name of GRAPHITE_HEADERS) {
        if (!existsSync(join(downloaded, name))) throw new Error(`skia-graphite: archive lacks ${name}`);
      }
    }
    // Publish no current marker until all verified headers and shared binaries are staged.
    // On a failed mutation the next install must reconstruct the cache.
    rmSync(stamp, { force: true });
    mkdirSync(libs, { recursive: true });
    if (!current) {
      for (const platform of ['ios', 'macos', 'tvos', 'android']) rmSync(join(libs, platform, '.version'), { force: true });
      rmSync(privateHeaders, { recursive: true, force: true });
      cpSync(downloaded, privateHeaders, { recursive: true });
    }
    // Always refresh these copies, including on a warm reinstall. The app's
    // owner is react-native-webgpu-dawn; stale destination existence is no cache key.
    copyDawnHeaders(join(dawn.path, 'include'), join(skia, 'cpp/dawn/include'));
    for (const abi of ABIS) {
      copyFileSync(join(dawn.path, 'libs/android', abi, 'libwebgpu_dawn.so'),
        join(graphite[0].path, 'libs', abi, 'libwebgpu_dawn.so'));
    }
    writeFileSync(join(libs, '.graphite'), ADMISSION.skia);
    writeFileSync(join(libs, '.dawn-version'), `dawn-${ADMISSION.dawnTag}`);
    writeFileSync(stamp, expected);
    return 'skia-graphite: verified shared Dawn, headers and Graphite binaries staged';
  } finally {
    if (temporary) rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  enableSkiaGraphite().then(console.log).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

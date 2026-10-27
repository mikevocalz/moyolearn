#!/usr/bin/env node
// Complete @shopify/react-native-skia's Graphite backend with one reviewed Dawn.
// SOT: upstream skia gitHead 6a53dcd8b63b739f60613dbed61475f6b3c1d9e5;
// docs/decisions/adr-121-gpu-device-topology.md.
// SOT-KEYWORDS: skia graphite dawn webgpu postinstall headers provenance cache
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The 157.0.0 Graphite and shared-Dawn npm artifacts were published from the
// same upstream commit. Dawn's own metadata records both its source and patches.
export const ADMISSION = Object.freeze({
  renderer: '2.14.0', version: '157.0.0', skia: 'm157',
  dawnCommit: 'ada567700e13aecf7989d78b21f7d330b522ea80',
  dawnTag: 'chrome-m157', webgpu: '0.19.1',
  patches: ['metal-maccatalyst.patch', 'vulkan-fifo-three-images-android.patch'],
  // No m157 header release exists, so the three private Graphite headers come
  // straight from Skia at the externals/skia commit of the 157.0.0 publisher
  // (react-native-skia gitHead 15be4cf71b04d64f0db47e2e8f8ef0f41d5a0517).
  // Dawn comes from the npm package.
  headersBaseUrl: 'https://raw.githubusercontent.com/google/skia/b94213a11b3a2edadfae89f0c57a7f4ab72772c9/src/gpu/graphite/',
  headersSha256: Object.freeze({
    'ContextOptionsPriv.h': 'f801bcda10ea519d50983d312a06bd809cb01031c9d4f852e0dcdb8db6323274',
    'ResourceTypes.h': '1822b5e90d4202026225cdf5aa1bd89bbc09d4aad57ee84357be98771ecbb10e',
    'TextureProxyView.h': '2287d9848e01fa42f9a5e9894ccd3d73c6979e0272d1ae46fe24d3b7ce01362d',
  }),
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

export function verifyHeader(name, bytes) {
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== ADMISSION.headersSha256[name]) throw new Error(`skia-graphite: header checksum mismatch for ${name} (${actual})`);
}

async function fetchPrivateHeaders(destination) {
  for (const name of GRAPHITE_HEADERS) {
    const response = await fetch(`${ADMISSION.headersBaseUrl}${name}`, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`skia-graphite: header download failed for ${name} (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    verifyHeader(name, bytes);
    writeFileSync(join(destination, name), bytes);
  }
  return destination;
}

function copyDawnHeaders(source, destination) {
  rmSync(destination, { recursive: true, force: true });
  cpSync(source, destination, { recursive: true });
  // Match upstream's copyHeaders normalization: Xcode maps headers by basename.
  // Keep the generated declarations under webgpu/, rather than their forwarding shims.
  rmSync(join(destination, 'dawn/wire'), { recursive: true, force: true });
  const table = join(destination, 'dawn/dawn_proc_table.h');
  writeFileSync(table, readFileSync(table, 'utf8').replaceAll('#include "dawn/webgpu.h"', '#include "webgpu/webgpu.h"'));
  mkdirSync(join(destination, 'webgpu'), { recursive: true });
  for (const name of ['webgpu.h', 'webgpu_cpp.h']) {
    copyFileSync(join(destination, 'dawn', name), join(destination, 'webgpu', name));
    rmSync(join(destination, 'dawn', name));
  }
  rmSync(join(destination, 'webgpu/webgpu_cpp_print.h'), { force: true });
}

// fetchHeaders is injected only by offline filesystem contract tests; the CLI
// always downloads and verifies the pinned upstream headers above.
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

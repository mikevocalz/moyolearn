#!/usr/bin/env node
/**
 * One-shot Skia v3 source migration.
 *
 * v3 is published as react-native-skia, not @shopify/react-native-skia.
 * This deliberately never touches docs, vendor archives, patches or the
 * historical v2 Graphite admission script/test. After --write, run the
 * package-level build/typecheck and native device gates.
 *
 * Usage:
 *   node tooling/migrate-skia-v3.mjs --write
 *   node tooling/migrate-skia-v3.mjs --check
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const OLD_SPECIFIER = '@shopify/react-native-skia';
export const NEW_SPECIFIER = 'react-native-skia';
const SRC_EXTENSIONS = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/;
const LEGACY_TOOLS = new Set([
  'tooling/enable-skia-graphite.mjs',
  'tooling/enable-skia-graphite.test.mjs',
  'tooling/migrate-skia-v3.mjs',
  'tooling/migrate-skia-v3.test.mjs',
]);

export function rewriteSkiaSpecifier(contents) {
  return contents.replaceAll(OLD_SPECIFIER, NEW_SPECIFIER);
}

export function candidateSource(path) {
  if (!SRC_EXTENSIONS.test(path)) return false;
  if (LEGACY_TOOLS.has(path)) return false;
  if (path.startsWith('patches/') || path.startsWith('vendors/')) return false;
  if (path.startsWith('docs/') || path.startsWith('probes/')) return false;
  return true;
}

export function detectRemovedV3Apis(contents) {
  const patterns = [
    /\bmakeImageFromView\b/,
    /\bmakeImageSnapshotAsync\b/,
    /\bMakeImageFromNativeTextureUnstable\b/,
    /\bgetNativeTextureUnstable\b/,
    /\bSkia\.Surface\.Make\s*\(/,
    /\bSkia\.Image\.MakeImage\s*\(/,
    /\buseCanvasSize\s*\(/,
  ];
  return patterns.filter((re) => re.test(contents)).map((re) => re.source);
}

export function migrationInventory(root) {
  const buf = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 16 * 1024 * 1024 });
  const files = buf.toString('utf8').split('\0').filter(candidateSource);
  const changed = [];
  const removedApi = [];
  for (const path of files) {
    const original = readFileSync(resolve(root, path), 'utf8');
    if (original.includes(OLD_SPECIFIER)) changed.push(path);
    const methods = detectRemovedV3Apis(original);
    if (methods.length) removedApi.push({ path, methods });
  }
  return { changed, removedApi };
}

export function migrate(root, write = false) {
  const inventory = migrationInventory(root);
  if (write) {
    for (const path of inventory.changed) {
      const absolute = resolve(root, path);
      writeFileSync(absolute, rewriteSkiaSpecifier(readFileSync(absolute, 'utf8')));
    }
  }
  return inventory;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = new Set(process.argv.slice(2));
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  if (args.has('--write') === args.has('--check')) {
    console.error('Specify exactly one of --write or --check');
    process.exitCode = 1;
  } else {
    const inventory = migrate(root, args.has('--write'));
    console.log(JSON.stringify({
      changedFiles: inventory.changed.length,
      files: inventory.changed,
      removedApiReferencesToReview: inventory.removedApi,
    }, null, 2));
    if (args.has('--check') && inventory.changed.length > 0) process.exitCode = 2;
  }
}

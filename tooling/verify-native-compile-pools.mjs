#!/usr/bin/env node
// Verify generated Ninja scheduling, rather than trusting a Gradle argument string.
// SOT: apps/mobile/android/build.gradle and .github/workflows/android-native.yml
// SOT-KEYWORDS: android native ci memory ninja compile link pool verification
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POOL = 'moyo_native';
const SKIP = new Set(['.git', '.gradle', '.next', '.turbo', 'Pods', 'artifacts', 'vendors']);

export function verifyBuildNinja(buildFile) {
  const lines = readFileSync(buildFile, 'utf8').split(/\r?\n/);
  const rules = readFileSync(join(dirname(buildFile), 'CMakeFiles/rules.ninja'), 'utf8');
  const definitions = `${lines.join('\n')}\n${rules}`.match(/^pool moyo_native\r?\n[ \t]+depth = 2[ \t]*$/gm) ?? [];
  if (definitions.length !== 1) throw new Error(`${buildFile}: expected one shared depth-2 ${POOL} pool`);
  let compile = 0; let link = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const edge = /^build .+: (\S*(?:COMPILER|LINKER)\S*)(?:\s|$)/.exec(lines[index]);
    if (!edge) continue;
    const settings = [];
    for (let next = index + 1; next < lines.length && /^\s+\S/.test(lines[next]); next += 1) settings.push(lines[next]);
    const pools = settings.filter((line) => /^\s+pool\s*=/.test(line));
    if (pools.length !== 1 || pools[0].trim() !== `pool = ${POOL}`) {
      throw new Error(`${buildFile}: unbounded or different pool on ${edge[1]}`);
    }
    if (edge[1].includes('COMPILER')) compile += 1; else link += 1;
  }
  if (compile === 0) throw new Error(`${buildFile}: no compiler edges to verify`);
  return { compile, link };
}

export function findBuildNinjas(root) {
  const base = realpathSync(root); const seen = new Set(); const files = [];
  function walk(path) {
    const resolved = realpathSync(path);
    if (resolved !== base && !resolved.startsWith(`${base}${sep}`)) return;
    if (seen.has(resolved)) return;
    seen.add(resolved);
    for (const entry of readdirSync(resolved, { withFileTypes: true })) {
      if (SKIP.has(entry.name)) continue;
      const child = join(resolved, entry.name);
      if (entry.name === '.cxx' && entry.isDirectory()) {
        const debug = join(child, 'Debug');
        if (existsSync(debug)) {
          for (const hash of readdirSync(debug, { withFileTypes: true })) {
            const file = join(debug, hash.name, 'arm64-v8a/build.ninja');
            if (hash.isDirectory() && existsSync(file)) files.push(file);
          }
        }
      } else if (entry.isDirectory() || (entry.isSymbolicLink() && existsSync(child) && statSync(child).isDirectory())) walk(child);
    }
  }
  walk(base);
  return files.sort();
}

export function verifyNativeCompilePools(root = ROOT) {
  const files = findBuildNinjas(root);
  const skia = realpathSync(join(root, 'node_modules/@shopify/react-native-skia/android'));
  if (!files.some((file) => file.startsWith(`${skia}${sep}.cxx${sep}`))) {
    throw new Error('native-pools: missing generated Skia arm64 Debug build.ninja');
  }
  const counts = files.reduce((total, file) => {
    const result = verifyBuildNinja(file);
    return { compile: total.compile + result.compile, link: total.link + result.link };
  }, { compile: 0, link: 0 });
  if (counts.link === 0) throw new Error('native-pools: no linker edges to verify');
  return { ...counts, files: files.map((file) => relative(root, file)) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = verifyNativeCompilePools();
    console.log(`native-pools: verified shared depth-2 compile/link pools on ${result.compile} compiler and ${result.link} linker edges in ${result.files.length} generated arm64 Debug builds`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

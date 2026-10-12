#!/usr/bin/env node
// Verify generated Ninja scheduling, rather than trusting a Gradle argument string.
// SOT: apps/mobile/android/build.gradle and .github/workflows/android-native.yml
// SOT-KEYWORDS: android native ci memory ninja compile link pool verification
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POOL = 'moyo_native';
const SKIP = new Set(['.git', '.gradle', '.next', '.turbo', 'Pods', 'artifacts', 'vendors']);
// These integrity-verified npm tarballs contain publisher .cxx debris.
// Exclude only each exact three-file set, beside a verified current build
// of the same module. Foreign or modified output otherwise remains a hard error.
const PUBLISHED_NINJA = [{
  source: 'https://registry.npmjs.org/expo-modules-core/-/expo-modules-core-58.0.8.tgz',
  integrity: 'sha512-hRXU9H3ano63giLGF/TVJ9JUSt3f2BKnLp5bwiGP3fvcAlnswssgtpOLzVFs4YuskVOvAMnb18TiPWW7n7EKHg==',
  files: {
    'build.ninja': '56a012e25dd6a73000b32a4394b7a15873dea2a511dcdb86a5f7503f855c5ec2',
    'CMakeFiles/rules.ninja': 'c3a02060c7dcade029c5b395aa74b70d7b8f0de2df3af889f5e787039cef425d',
    'CMakeCache.txt': '8b6e444cf4d28ca5c99155f244bac5c25e4690c841ba0a63bf4e05a6384edc7c',
  },
}, {
  source: 'https://registry.npmjs.org/expo-updates/-/expo-updates-58.0.10.tgz',
  integrity: 'sha512-1VyCfmjXmOApRsPwuAECqQ+pMcF2WbooKwFThXoKeNJE+LYzdfzD/SUbhnEchgT46ahjEJMUThff3M3ZMnDzxg==',
  files: {
    'build.ninja': '1df8aa04c578e762297330129f4e550925bdbca7d2c92ecf3e26282952a15835',
    'CMakeFiles/rules.ninja': '13b4b71ba2d5c6b2807c02c8eca1efbf8e554f41332022515fdac3ff3c19f86c',
    'CMakeCache.txt': 'def8598fe1027f7d0e4f813a9c2b0a8a5c9580138b43ce09ed595d2d1622085d',
  },
}];
const inside = (root, path) => path === root || path.startsWith(`${root}${sep}`);
const canonical = (path) => existsSync(path) ? realpathSync(path) : resolve(path);

export function inspectBuildProvenance(root, buildFile) {
  const directory = realpathSync(dirname(buildFile));
  const cache = readFileSync(join(directory, 'CMakeCache.txt'), 'utf8');
  const readEntry = (name) => {
    const matches = [...cache.matchAll(new RegExp(`^${name}:[^=\\r\\n]+=(.*)$`, 'gm'))];
    if (matches.length !== 1 || !matches[0][1].trim()) throw new Error(`${buildFile}: missing or malformed ${name}`);
    return matches[0][1].trim();
  };
  const buildDirectory = readEntry('CMAKE_CACHEFILE_DIR');
  const sourceDirectory = readEntry('CMAKE_HOME_DIRECTORY');
  const ninja = readFileSync(buildFile, 'utf8');
  const workdirs = [...ninja.matchAll(/^cmake_ninja_workdir = (.+)$/gm)];
  if (!isAbsolute(buildDirectory) || !isAbsolute(sourceDirectory) || workdirs.length !== 1) {
    throw new Error(`${buildFile}: missing or malformed generated-directory provenance`);
  }
  const workdir = workdirs[0][1].trim().replace(/\$(\$| |:)/g, '$1');
  if (canonical(workdir) !== canonical(buildDirectory)) throw new Error(`${buildFile}: Ninja/cache build directories disagree`);
  const base = realpathSync(root);
  if (canonical(buildDirectory) === directory) {
    if (!existsSync(sourceDirectory) || !inside(base, realpathSync(sourceDirectory))) {
      throw new Error(`${buildFile}: current build source is outside this checkout`);
    }
    return { kind: 'current', buildDirectory: relative(base, directory), sourceDirectory: relative(base, realpathSync(sourceDirectory)) };
  }
  if (inside(base, canonical(buildDirectory)) || inside(base, canonical(sourceDirectory))) {
    throw new Error(`${buildFile}: mismatched current-checkout build provenance`);
  }
  const knownPublisher = PUBLISHED_NINJA.find((artifact) => Object.entries(artifact.files).every(([name, digest]) =>
    createHash('sha256').update(readFileSync(join(directory, name))).digest('hex') === digest));
  if (!knownPublisher) throw new Error(`${buildFile}: unrecognized foreign generated output`);
  return { kind: 'published-foreign', reason: 'Exact npm-published files record another checkout, not this build', ...knownPublisher };
}

function poolMetadata(buildFile) {
  const directory = dirname(buildFile);
  const build = readFileSync(buildFile, 'utf8');
  const rules = readFileSync(join(directory, 'CMakeFiles/rules.ninja'), 'utf8');
  const cacheFile = join(directory, 'CMakeCache.txt');
  const cache = existsSync(cacheFile) ? readFileSync(cacheFile, 'utf8') : '';
  return {
    declarations: (`${build}\n${rules}`).match(/^pool \S+\r?\n(?:[ \t]+[^\r\n]*\r?\n?)*/gm) ?? [],
    assignments: [...new Set(build.match(/^[ \t]+pool\s*=.*$/gm) ?? [])],
    cachePoolSettings: cache.match(/^CMAKE_JOB_POOL(?:S|_COMPILE|_LINK):[^\r\n]*$/gm) ?? [],
  };
}

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

export function inspectNativeCompilePools(root = ROOT) {
  const files = findBuildNinjas(root);
  const errors = []; const builds = []; const verified = [];
  let compile = 0; let link = 0;
  for (const file of files) {
    const module = file.slice(0, file.lastIndexOf(`${sep}.cxx${sep}`));
    const record = { file: relative(root, file), module: relative(root, module) };
    builds.push(record);
    try {
      record.pools = poolMetadata(file);
      record.provenance = inspectBuildProvenance(root, file);
      if (record.provenance.kind === 'current') {
        record.edges = verifyBuildNinja(file);
        compile += record.edges.compile; link += record.edges.link; verified.push(file);
      }
    } catch (error) { record.error = error.message; errors.push(error.message); }
  }
  for (const record of builds.filter((build) => build.provenance?.kind === 'published-foreign')) {
    if (!builds.some((build) => build.module === record.module && build.provenance?.kind === 'current' && !build.error)) {
      errors.push(`${record.file}: published foreign output has no verified current build of the same module`);
    }
  }
  // AGP 9.2.1 maps questDebug to the Debug optimization tag. Require the app
  // explicitly so a future staging-path change cannot silently evade this gate.
  for (const [name, path] of [['Skia', 'node_modules/@shopify/react-native-skia/android'], ['application', 'apps/mobile/android/app']]) {
    const directory = join(root, path);
    if (!existsSync(directory) || !verified.some((file) => file.startsWith(`${realpathSync(directory)}${sep}.cxx${sep}`))) {
      errors.push(`native-pools: missing generated ${name} arm64 Debug build.ninja with verified current pools`);
    }
  }
  if (link === 0) errors.push('native-pools: no linker edges to verify');
  return { compile, link, files: verified.map((file) => relative(root, file)), builds, errors };
}

export function verifyNativeCompilePools(root = ROOT) {
  const result = inspectNativeCompilePools(root);
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = inspectNativeCompilePools();
    const report = join(ROOT, 'apps/mobile/android/build/reports/native-pools.json');
    mkdirSync(dirname(report), { recursive: true });
    writeFileSync(report, `${JSON.stringify(result, null, 2)}\n`);
    for (const build of result.builds) console.log(`native-pools: ${JSON.stringify(build)}`);
    if (result.errors.length) throw new Error(result.errors.join('\n'));
    console.log(`native-pools: verified shared depth-2 compile/link pools on ${result.compile} compiler and ${result.link} linker edges in ${result.files.length} generated arm64 Debug builds`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

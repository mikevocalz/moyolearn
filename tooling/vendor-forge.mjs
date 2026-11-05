#!/usr/bin/env node
// Build reviewed private source artifacts; generated bindings must match the host.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pins = { board: 'fb6b14b9f9093d663e18c657ac6016ff972dc63a', icons: '3c79e3d4c2dbd0c42d7fdccea40eb0a7162b6c48' };
const nitro = '1.0.0-alpha.nightly.100.g107f6fc66597';
const temporary = mkdtempSync(join(tmpdir(), 'moyo-forge-vendor-'));
const run = (cmd, args, cwd = temporary) => execFileSync(cmd, args, { cwd, stdio: 'inherit' });
const repository = process.argv[2] ? resolve(process.argv[2]) : join(temporary, 'source');
if (!process.argv[2]) run('git', ['clone', '--no-checkout', 'git@github.com:mikevocalz/nitro-forge.git', repository]);
const provenance = {};
mkdirSync(join(root, 'vendors'), { recursive: true });
for (const name of Object.keys(pins)) {
  const commit = execFileSync('git', ['rev-parse', `${pins[name]}^{commit}`], { cwd: repository, encoding: 'utf8' }).trim();
  const archive = execFileSync('git', ['archive', commit, `packages/${name}`], { cwd: repository, maxBuffer: 20 * 1024 * 1024 });
  execFileSync('tar', ['-x', '-C', temporary], { input: archive });
  const directory = join(temporary, 'packages', name);
  const manifestPath = join(directory, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.version = '0.1.0-moyo.1';
  manifest.moyoSource = { repository: 'mikevocalz/nitro-forge', commit };
  if (name === 'board') {
    // The native preview stays disabled in the host unless explicitly built.
    // Codegen at the host's exact v1 pin prevents two incompatible runtimes.
    for (const field of ['peerDependencies', 'devDependencies']) {
      for (const dependency of ['nitro-core', 'react-native-nitro-modules', 'nitrogen']) {
        if (manifest[field]?.[dependency]) manifest[field][dependency] = nitro;
      }
    }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir');
    run('pnpm', [`--package=nitrogen@${nitro}`, 'dlx', 'nitrogen'], directory);
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  run('pnpm', ['pack', '--pack-destination', join(root, 'vendors')], directory);
  const file = `nitro-forge-${name}-${manifest.version}.tgz`;
  provenance[name] = { ...manifest.moyoSource, file, sha256: createHash('sha256').update(readFileSync(join(root, 'vendors', file))).digest('hex'), ...(name === 'board' ? { nitrogen: nitro, runtime: nitro, android: 'opt-in; requires CanvasSurfaces-enabled Viro' } : {}) };
}
writeFileSync(join(root, 'vendors', 'forge-source-lock.json'), `${JSON.stringify(provenance, null, 2)}\n`);

#!/usr/bin/env node
// Install only reviewed BLE archive bytes; retain every unrelated source and build cache.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'node_modules/@nitro-forge/bluetooth-v1');
function otherNativeFingerprint() {
  const entries = [];
  function walk(directory) {
    if (directory === target) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (['.git', '.cxx', 'build', 'Pods', '.cache'].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && /(?:\.(?:kt|java|cpp|c|h|hpp|mm|m|cmake|gradle)|CMakeLists\.txt|package\.json|\.nitro\.ts)$/.test(entry.name)) {
        const stat = statSync(path, { bigint: true });
        entries.push([relative(root, path), stat.size.toString(), stat.mtimeNs.toString()]);
      }
    }
  }
  walk(join(root, 'node_modules'));
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  return { count: entries.length, sha256: createHash('sha256').update(JSON.stringify(entries)).digest('hex') };
}
const baselinePath = process.argv[2];
if (process.argv.includes('--snapshot')) {
  const result = otherNativeFingerprint();
  writeFileSync(baselinePath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result));
  process.exit(0);
}
if (!baselinePath || !existsSync(baselinePath)) throw new Error('Provide the pre-lock-update native fingerprint file');
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
if (JSON.stringify(otherNativeFingerprint()) !== JSON.stringify(baseline)) throw new Error('Unrelated native source/config mtimes changed before sync');
const receipt = JSON.parse(readFileSync(join(root, 'vendors/forge-source-lock.json'), 'utf8'))['bluetooth-v1'];
const archive = join(root, 'vendors', receipt.file);
if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== receipt.sha256) throw new Error('Bluetooth archive hash mismatch');
const listing = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
if (listing.some((name) => !name.startsWith('package/') || name.split('/').includes('..'))) throw new Error('Unsafe archive path');
const temporary = mkdtempSync(join(tmpdir(), 'moyo-bluetooth-sync-'));
execFileSync('tar', ['-xzf', archive, '-C', temporary]);
let changed = 0; let unchanged = 0;
function sync(source, destination) {
  mkdirSync(destination, { recursive: true });
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = join(source, entry.name); const to = join(destination, entry.name);
    if (entry.isDirectory()) sync(from, to);
    else {
      if (!entry.isFile()) throw new Error('Archive must contain regular files only');
      const bytes = readFileSync(from);
      if (existsSync(to) && readFileSync(to).equals(bytes)) unchanged++;
      else { writeFileSync(to, bytes); changed++; }
      if (!readFileSync(to).equals(bytes)) throw new Error(`Installed bytes differ: ${to}`);
    }
  }
}
sync(join(temporary, 'package'), target);
const after = otherNativeFingerprint();
if (JSON.stringify(after) !== JSON.stringify(baseline)) throw new Error('Unrelated native source/config mtimes changed during sync');
console.log(JSON.stringify({ changed, unchanged, packedBytesMatch: true, unrelatedNativeSources: after }));

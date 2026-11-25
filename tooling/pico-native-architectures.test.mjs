// Execute the actual Gradle settings callback and installed PICO ABI lookup.
// No Android SDK is needed; native compilation remains a separate CI gate.
// SOT: apps/mobile/plugins/pico-native-architectures.js
// SOT-KEYWORDS: pico native abi gradle cli properties emulator regression
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { propagatePicoNativeArchitectures } = require('../apps/mobile/plugins/pico-native-architectures');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const picoRoot = dirname(require.resolve('@expo-pico/core/package.json'));
const picoBuild = readFileSync(join(picoRoot, 'android/build.gradle'), 'utf8');
const lookup = picoBuild.match(/^def reactNativeArchitectures\(\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(lookup, 'the installed PICO ABI lookup must be reviewed when its shape changes');
assert.match(picoBuild, /abiFilters\(\*reactNativeArchitectures\(\)\)/);
const legacy = readFileSync(join(root, 'tooling/fixtures/pico-legacy-abi-settings.gradle'), 'utf8');
const appProperties = readFileSync(join(root, 'apps/mobile/android/gradle.properties'), 'utf8');
const abiProperty = appProperties.match(/^reactNativeArchitectures=.+$/m)?.[0];
assert.ok(abiProperty);

for (const { name, cli, expected, old = false } of [
  { name: 'reproduces the old callback ignoring the x86_64 CLI request', cli: 'x86_64', expected: 'arm64-v8a', old: true },
  { name: 'passes the emulator x86_64 CLI request to the real PICO lookup', cli: 'x86_64', expected: 'x86_64' },
  { name: 'preserves the application default arm64 ABI without a CLI override', expected: 'arm64-v8a' },
  { name: 'preserves the Quest arm64 CLI request', cli: 'arm64-v8a', expected: 'arm64-v8a' },
  { name: 'preserves a multi-ABI request without narrowing or adding architectures', cli: 'arm64-v8a,x86_64', expected: 'arm64-v8a,x86_64' },
]) test(name, (t) => {
  const fixture = mkdtempSync(join(tmpdir(), 'moyo-pico-abi-'));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  const module = join(fixture, 'expo-pico-core');
  mkdirSync(module);
  const settings = "rootProject.name = 'moyo-pico-abi-contract'\ninclude ':expo-pico-core'\n";
  writeFileSync(join(fixture, 'settings.gradle'), old ? settings + legacy : propagatePicoNativeArchitectures(settings + legacy));
  writeFileSync(join(fixture, 'gradle.properties'), `${abiProperty}\n`);
  writeFileSync(join(fixture, 'build.gradle'), '');
  writeFileSync(join(module, 'gradle.properties'), readFileSync(join(picoRoot, 'android/gradle.properties')));
  writeFileSync(join(module, 'build.gradle'), `${lookup}\ntasks.register('reportRequestedAbis') { doLast { println('MOYO_PICO_ABIS=' + reactNativeArchitectures().join(',')) } }\n`);
  const wrapper = process.env.MOYO_TEST_GRADLE || join(root, 'apps/mobile/android/gradlew');
  const args = [wrapper, '-p', fixture, ':expo-pico-core:reportRequestedAbis', '--no-daemon', '--console=plain', '--quiet'];
  if (cli) args.push(`-PreactNativeArchitectures=${cli}`);
  const result = spawnSync('bash', args, { encoding: 'utf8', timeout: 180_000, maxBuffer: 1024 * 1024 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(result.stdout.match(/^MOYO_PICO_ABIS=(.+)$/m)?.[1], expected, result.stdout);
});

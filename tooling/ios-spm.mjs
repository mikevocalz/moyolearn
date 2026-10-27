#!/usr/bin/env node
// Generates apps/mobile/ios from config and moves it to SwiftPM.
//
// Nitro 1.0 is SwiftPM-only on Apple, so the iOS app no longer resolves native
// code through CocoaPods. ios/ is not committed: `expo prebuild` writes it from
// app.config.ts (CNG), then React Native's `react-native spm add --deintegrate`
// strips CocoaPods and wires the autolinked SwiftPM packages into Moyo.xcodeproj.
//
// Expo modules that mix Swift and Objective-C link as prebuilt XCFrameworks.
// Build them first with tooling/expo-prebuilds/build.sh and pass the output
// directory as EXPO_PRECOMPILED_MODULES_PATH.
//
// Usage: EXPO_PRECOMPILED_MODULES_PATH=<dir> node tooling/ios-spm.mjs
// SOT-KEYWORDS: ios swiftpm spm nitro v1 expo prebuild cng xcodeproj deintegrate
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = join(root, 'apps/mobile');

const precompiled = process.env.EXPO_PRECOMPILED_MODULES_PATH;
if (!precompiled || !existsSync(join(precompiled, 'expo-modules-core'))) {
  console.error(
    'EXPO_PRECOMPILED_MODULES_PATH must point at the output of tooling/expo-prebuilds/build.sh.',
  );
  process.exit(1);
}

function run(cmd, args, cwd) {
  console.log(`$ ${cmd} ${args.join(' ')}  (in ${cwd})`);
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    console.error(`${cmd} exited with ${result.status ?? result.signal}`);
    process.exit(result.status ?? 1);
  }
}

// The visionOS plugin in @reactvision/react-viro rewrites metro.config.js on every
// prebuild. That file is source, so put it back byte for byte.
const metroPath = join(mobile, 'metro.config.js');
const metro = readFileSync(metroPath);
try {
  run('npx', ['expo', 'prebuild', '--platform', 'ios', '--clean', '--no-install'], mobile);
} finally {
  writeFileSync(metroPath, metro);
}

run('npx', ['react-native', 'spm', 'add', '--deintegrate', '--yes'], mobile);

// What is left of the Podfile after deintegration installs nothing.
for (const leftover of ['Podfile', 'Podfile.lock', 'Podfile.properties.json', 'Pods']) {
  rmSync(join(mobile, 'ios', leftover), { recursive: true, force: true });
}

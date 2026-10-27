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
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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

// react-native-executorch's Package.swift (patches/react-native-executorch@*.patch)
// links binaries CocoaPods used to fetch or pass through OTHER_LDFLAGS. Put them
// where the manifest reads them. See the comment at the top of that manifest.
const executorch = join(root, 'node_modules/react-native-executorch/third-party/ios');
if (existsSync(executorch)) {
  const opencv = join(executorch, 'opencv2.xcframework');
  if (!existsSync(join(opencv, 'Info.plist'))) {
    // The `opencv-rne` pod the podspec depends on (~> 4.11.0); its only release.
    const checkout = join(root, '.cache/opencv-rne-4.11.0');
    if (!existsSync(join(checkout, 'opencv2.xcframework/Info.plist'))) {
      rmSync(checkout, { recursive: true, force: true });
      run('git', ['clone', '--quiet', '--depth', '1', '--branch', '4.11.0',
        'https://github.com/software-mansion-labs/opencv-rne.git', checkout], root);
    }
    // The pod ships static frameworks (macOS-style deep bundles whose Versions/
    // symlinks git stored as directories). CocoaPods only linked them. A framework
    // binary target is embedded instead, and Xcode 27.1 fails embedding a static
    // one ("Injecting stub binary into codeless framework", then an empty lipo).
    // Repackage each slice as a static-library XCFramework, which SwiftPM links
    // and never embeds. Headers keep the <opencv2/...> include path.
    const staging = join(root, '.cache/opencv2-library');
    rmSync(staging, { recursive: true, force: true });
    const args = ['-create-xcframework'];
    const source = join(checkout, 'opencv2.xcframework');
    for (const slice of readdirSync(source)) {
      const framework = join(source, slice, 'opencv2.framework');
      if (!existsSync(join(framework, 'opencv2'))) continue;
      const out = join(staging, slice);
      mkdirSync(join(out, 'include'), { recursive: true });
      cpSync(join(framework, 'opencv2'), join(out, 'libopencv2.a'));
      cpSync(join(framework, 'Headers'), join(out, 'include', 'opencv2'), { recursive: true });
      args.push('-library', join(out, 'libopencv2.a'), '-headers', join(out, 'include'));
    }
    run('xcodebuild', [...args, '-output', opencv], root);
  }
  const libs = join(executorch, 'libs');
  const layout = {
    iphoneos: 'pthreadpool/physical-arm64-release/libpthreadpool.a',
    iphonesimulator: 'pthreadpool/simulator-arm64-debug/libpthreadpool.a',
  };
  for (const [sdk, pthreadpool] of Object.entries(layout)) {
    const dir = join(executorch, 'spm-libs', sdk);
    mkdirSync(dir, { recursive: true });
    cpSync(join(libs, pthreadpool), join(dir, 'libpthreadpool.a'));
    cpSync(join(libs, 'cpuinfo/libcpuinfo.a'), join(dir, 'libcpuinfo.a'));
  }
}

run('npx', ['react-native', 'spm', 'add', '--deintegrate', '--yes'], mobile);

// What is left of the Podfile after deintegration installs nothing.
for (const leftover of ['Podfile', 'Podfile.lock', 'Podfile.properties.json', 'Pods']) {
  rmSync(join(mobile, 'ios', leftover), { recursive: true, force: true });
}

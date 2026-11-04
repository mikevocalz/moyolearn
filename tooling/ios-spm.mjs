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

// react-native-audio-api's Package.swift (patches/react-native-audio-api@*.patch)
// links the FFmpeg XCFrameworks and the Ogg/Opus/Vorbis static libraries that the
// podspec's prepare_command downloads. SwiftPM runs no such step, so run the
// package's own script here. It skips what is already in place, and it reports a
// failed download without failing, so check the files the manifest links.
const audioApi = join(root, 'node_modules/react-native-audio-api');
if (existsSync(audioApi)) {
  run('bash', ['scripts/download-prebuilt-binaries.sh', 'ios'], audioApi);
  const external = join(audioApi, 'common/cpp/audioapi/external');
  const required = [
    ...['libavcodec', 'libavformat', 'libavutil', 'libswresample'].map(
      (name) => `ffmpeg_ios/${name}.xcframework/Info.plist`,
    ),
    ...['iphoneos', 'iphonesimulator'].flatMap((sdk) =>
      ['libopusfile', 'libopus', 'libogg', 'libvorbis', 'libvorbisenc', 'libvorbisfile'].map(
        (lib) => `${sdk}/${lib}.a`,
      ),
    ),
  ];
  const absent = required.filter((file) => !existsSync(join(external, file)));
  if (absent.length > 0) {
    console.error(`react-native-audio-api binaries missing after download: ${absent.join(', ')}`);
    process.exit(1);
  }
}

run('npx', ['react-native', 'spm', 'add', '--deintegrate', '--yes'], mobile);

// `react-native spm add` links only the app's direct dependencies. CocoaPods went
// through Expo's autolinking, which also finds native packages that workspace
// packages (packages/app, packages/ui) depend on. A package found there but not
// here builds fine and then throws "native module could not be found" at launch,
// so fail now and name it. The fix is a direct dependency in apps/mobile.
const expoLinked = spawnSync(
  'node',
  [join(root, 'node_modules/expo-modules-autolinking/bin/expo-modules-autolinking.js'), 'react-native-config', '--platform', 'ios', '--json'],
  { cwd: mobile, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
if (expoLinked.status !== 0) {
  console.error(expoLinked.stderr);
  process.exit(expoLinked.status ?? 1);
}
const spmLinked = JSON.parse(
  readFileSync(join(mobile, 'ios/build/generated/autolinking/autolinking.json'), 'utf8'),
).dependencies;
const missing = Object.entries(JSON.parse(expoLinked.stdout).dependencies)
  .filter(([name, dep]) => dep.platforms?.ios && !spmLinked[name])
  .map(([name]) => name);
if (missing.length > 0) {
  console.error(`Not linked into the SwiftPM app (add to apps/mobile/package.json): ${missing.join(', ')}`);
  process.exit(1);
}

// CocoaPods defined RCT_NEW_ARCH_ENABLED for every pod; SwiftPM defines nothing.
// A package whose sources guard their Fabric code with it and whose manifest does
// not define it compiles that code out: its component views register a provider
// with a null constructor and the app dies on the first render
// (EXC_BAD_ACCESS at 0x0 in ComponentDescriptorRegistry::add).
const guardsNewArch = (dir) =>
  spawnSync('grep', ['-rlq', 'RCT_NEW_ARCH_ENABLED', ...['ios', 'apple', 'cpp', 'common'].map((d) => join(dir, d)).filter(existsSync)]).status === 0;
const undefinedNewArch = Object.keys(spmLinked).filter((name) => {
  const dir = join(root, 'node_modules', name);
  const manifest = join(dir, 'Package.swift');
  return existsSync(manifest) && guardsNewArch(dir) && !readFileSync(manifest, 'utf8').includes('RCT_NEW_ARCH_ENABLED');
});
if (undefinedNewArch.length > 0) {
  console.error(`Package.swift must define RCT_NEW_ARCH_ENABLED: ${undefinedNewArch.join(', ')}`);
  process.exit(1);
}

// What is left of the Podfile after deintegration installs nothing.
for (const leftover of ['Podfile', 'Podfile.lock', 'Podfile.properties.json', 'Pods']) {
  rmSync(join(mobile, 'ios', leftover), { recursive: true, force: true });
}

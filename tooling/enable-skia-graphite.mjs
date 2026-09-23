#!/usr/bin/env node
// Selects Skia's Graphite backend and completes the published package so it
// can compile that backend.
//
// `react-native-skia.podspec` chooses the backend from a file, not a flag:
//
//     use_graphite = File.exist?(File.join(__dir__, 'libs', '.graphite'))
//
// With the marker it links `react-native-skia-graphite-apple-ios` /
// `-android` and compiles `SK_GRAPHITE=1`; without it, `react-native-skia-apple-*`
// and `SK_METAL=1 SK_GANESH=1`. Both variants ship at the same Skia milestone
// (154.0.0), so this is a backend swap, not a version change.
//
// WHY A POSTINSTALL AND NOT A COMMITTED FILE. Everything here has to live inside
// `node_modules/@shopify/react-native-skia/`, which every `pnpm install`
// rebuilds. Skia's own `install-skia-graphite` script is a development script in
// its repo and is not shipped in the published package, so this does the
// consumer-facing subset of what it does.
//
// WHY HEADERS TOO. The Graphite bridge (`cpp/rnskia/RNDawn*.{h,cpp}`) includes
// `dawn/native/MetalBackend.h`, `webgpu/webgpu_cpp.h` and
// `src/gpu/graphite/ContextOptionsPriv.h`. The podspec searches
// `cpp/dawn/include` for the first two and `cpp/skia` for the third, and the
// published package ships NONE of them: neither the prebuilt-binary packages nor
// react-native-webgpu's xcframework carry `MetalBackend.h`. Upstream's install
// script fills both directories from one release tarball
// (`skia-graphite-headers-<tag>.tar.gz`, generated from the same Dawn commit —
// `dawn/dawn_version.h` inside it is 3d786993…, the commit chrome/m154 pins and
// the one react-native-webgpu 0.10.x links). That tarball is what this fetches.
//
// WHY THE DAWN MARKER. The podspec compares `libs/.dawn-version` against
// react-native-webgpu's `dawn` field so the app contains exactly one Dawn — but
// only `if File.exist?(dawn_marker)`. Nothing in the published package writes
// it, so the guard silently never ran. Writing the tag upstream's script writes
// makes it real.
//
// WHY GRAPHITE. Ganesh renders through Metal directly and links no Dawn, so it
// cannot share a device with `react-native-webgpu` no matter how the versions
// line up. Graphite is the backend built for explicit APIs and the one that puts
// Skia on the same Dawn — which is the precondition for ADR-121's Option A and
// for the one-Dawn build guard meaning anything.
// SOT: node_modules/@shopify/react-native-skia/react-native-skia.podspec ·
//      docs/decisions/adr-121-gpu-device-topology.md
// SOT-KEYWORDS: skia graphite ganesh backend marker dawn webgpu postinstall
//               MetalBackend headers tarball dawn-version
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Same milestone as the `react-native-skia-graphite-apple-*` catalog pins and
// the `dawn` field of the installed react-native-webgpu. Bump all three together.
const SKIA_MILESTONE = 'm154';
const DAWN_RELEASE_TAG = 'dawn-chrome-m154';
const HEADERS_URL = `https://github.com/Shopify/react-native-skia/releases/download/skia-graphite-${SKIA_MILESTONE}/skia-graphite-headers-skia-graphite-${SKIA_MILESTONE}.tar.gz`;
// Upstream publishes no checksum for this asset; this is the sha256 of the
// file as fetched on 2026-09-23. A mismatch means the release was re-cut.
const HEADERS_SHA256 = 'd81916d7cceb0b45f1ca470e37ab23e93a69ef9ce5521e2a25f3e6fdc751c0f6';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const skia = join(root, 'node_modules', '@shopify', 'react-native-skia');

/*
  Absent Skia is not a failure. This runs on every install, including ones that
  have not linked the mobile workspace yet, and a postinstall that exits 1
  because an optional path is missing breaks installs for everyone.
*/
if (!existsSync(skia)) {
  console.log('skia-graphite: @shopify/react-native-skia not installed, nothing to mark');
  process.exit(0);
}

const marker = join(skia, 'libs', '.graphite');
if (!existsSync(marker)) {
  mkdirSync(dirname(marker), { recursive: true });
  writeFileSync(marker, SKIA_MILESTONE);

  /*
    AND INVALIDATE THE COPY CACHE, OR THE SWITCH IS COSMETIC.

    The podspec copies the selected variant's frameworks into `libs/<platform>/`
    and skips the copy when `libs/<platform>/.version` already matches the source
    package's version:

        next if File.exist?(marker) && File.read(marker).strip == version

    Both variants ship as `154.0.0`. So flipping Ganesh -> Graphite leaves that
    marker matching, the copy is skipped, and `libs/ios/` keeps the GANESH
    frameworks while the generated xcconfig compiles `SK_GRAPHITE=1`. Defines from
    one backend against the binaries of the other, with nothing in the build
    saying so. The podspec's own header calls this out and says a clean reinstall
    fixes it; deleting the stale version markers is that reinstall, scoped.
  */
  for (const platform of ['ios', 'macos', 'tvos', 'android']) {
    const stale = join(skia, 'libs', platform, '.version');
    if (existsSync(stale)) rmSync(stale);
  }
  console.log('skia-graphite: marker written, copy cache invalidated');
}

writeFileSync(join(skia, 'libs', '.dawn-version'), DAWN_RELEASE_TAG);

const dawnInclude = join(skia, 'cpp', 'dawn', 'include');
const graphiteSrc = join(skia, 'cpp', 'skia', 'src', 'gpu', 'graphite');
const complete =
  existsSync(join(dawnInclude, 'dawn', 'native', 'MetalBackend.h')) &&
  existsSync(join(graphiteSrc, 'ContextOptionsPriv.h'));

if (complete) {
  console.log('skia-graphite: selected, headers present — pod install will report SK_GRAPHITE: ON');
  process.exit(0);
}

console.log(`skia-graphite: fetching Dawn + Graphite headers (${HEADERS_URL})`);
const res = await fetch(HEADERS_URL);
if (!res.ok) {
  console.error(`skia-graphite: download failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const bytes = Buffer.from(await res.arrayBuffer());
const sha = createHash('sha256').update(bytes).digest('hex');
if (sha !== HEADERS_SHA256) {
  console.error(`skia-graphite: checksum mismatch\n  expected ${HEADERS_SHA256}\n  got      ${sha}`);
  process.exit(1);
}

const tmp = mkdtempSync(join(tmpdir(), 'skia-graphite-headers-'));
try {
  const tarball = join(tmp, 'headers.tgz');
  writeFileSync(tarball, bytes);
  execFileSync('tar', ['-xzf', tarball, '-C', tmp]);
  const src = join(tmp, 'packages', 'skia', 'cpp');
  rmSync(join(skia, 'cpp', 'dawn'), { recursive: true, force: true });
  cpSync(join(src, 'dawn'), join(skia, 'cpp', 'dawn'), { recursive: true });
  rmSync(graphiteSrc, { recursive: true, force: true });
  cpSync(join(src, 'skia', 'src', 'gpu', 'graphite'), graphiteSrc, { recursive: true });
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('skia-graphite: headers installed — pod install will report SK_GRAPHITE: ON');

#!/usr/bin/env node
// Selects Skia's Graphite backend by writing the marker its podspec looks for.
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
// WHY A POSTINSTALL AND NOT A COMMITTED FILE. The marker has to live inside
// `node_modules/@shopify/react-native-skia/`, which every `pnpm install`
// rebuilds. Skia's own `install-skia-graphite` script is a development script in
// its repo and is not shipped in the published package, so there is nothing to
// call — writing the marker is the whole of the consumer-side switch.
//
// WHY GRAPHITE. Ganesh renders through Metal directly and links no Dawn, so it
// cannot share a device with `react-native-webgpu` no matter how the versions
// line up. Graphite is the backend built for explicit APIs and the one that puts
// Skia on the same Dawn — which is the precondition for ADR-121's Option A and
// for the one-Dawn build guard meaning anything.
// SOT: node_modules/@shopify/react-native-skia/react-native-skia.podspec ·
//      docs/decisions/adr-121-gpu-device-topology.md
// SOT-KEYWORDS: skia graphite ganesh backend marker dawn webgpu postinstall
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
if (existsSync(marker)) {
  console.log('skia-graphite: already selected');
  process.exit(0);
}

mkdirSync(dirname(marker), { recursive: true });
writeFileSync(marker, '');

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

console.log('skia-graphite: marker written, copy cache invalidated — pod install will report SK_GRAPHITE: ON');

# vendors/

Tarballs that cannot come from a registry. Committed on purpose — the `file:`
protocol pins a path, so CI and every collaborator must resolve the same
artefact (redraw.dev/docs/installation).

## `@reactvision/react-viro` 3.0.0-moyo.3 (the spatial whiteboard + avatar bones)

`reactvision-react-viro-3.0.0-moyo.3.tgz` is our fork of ReactVision's Viro,
pinned through `pnpm.overrides` in the root `package.json` and registered as a
config plugin in `apps/mobile/app.config.ts`. It carries the visionOS podspec
work and the AR path the spatial board needs.

**It ships no `PrivacyInfo.xcprivacy`, and it does not need to — we declare its
required-reason APIs in the app's own manifest.** Measured on the tarball's two
binaries (2026-09-13, `nm -u` plus a selector scan of `__objc_methname`):

| Binary | Required-reason symbols | Category → reason |
|---|---|---|
| `ios/dist/ViroRenderer/ViroKit.framework/ViroKit` | `stat`, `fstat` | `FileTimestamp` → `C617.1` (app-container assets: shaders, textures, `.mlmodelc`) |
| same | `mach_absolute_time` | `SystemBootTime` → `35F9.1` (frame clock) |
| `ios/dist/lib/libViroReact.a` | none | — |

No `statfs`/`statvfs`/volume-capacity key (so no `DiskSpace`), no
`NSUserDefaults`/`CFPreferences` (no `UserDefaults`), no `activeInputModes` (no
`ActiveKeyboards`). Both categories it does need were already declared for
Sentry and `expo-file-system`, so the fork added no new category — but the
attribution is written out in `app.config.ts` so the next person can tell which
reason survives if a dependency is dropped.

Two things to re-measure if the tarball is ever recut:

- Run the same `nm -u` scan. A renderer that gains a disk-space check or a
  `NSUserDefaults` write needs a new entry, and nothing catches that for you.
- **ARCore and Firebase are weak-linked and currently absent.** `ViroKit.podspec`
  documents opt-in pods (`ARCore/CloudAnchors`, `ARCore/Geospatial`,
  `ARCore/Semantics`) that pull Firebase in behind them. Our Podfile adds none of
  them, which matters: several Firebase and GoogleUtilities pods are on Apple's
  list of SDKs that must ship a signed privacy manifest (ITMS-91061). Adding a
  Cloud Anchors feature is therefore a privacy-manifest decision as well as a
  product one.

## Redraw (the animated splash)

`redraw` and `react-native-redraw` are a technical preview distributed as
`.tgz` files through GitHub Releases to wcandillon.dev subscribers. There is no
public npm package — `react-native-redraw@0.0.1` on the registry is a name
placeholder whose tarball contains a `package.json` and nothing else, and
installing it gets you no library.

Everything the splash needs is already wired:

- `react-native-webgpu` 0.9.0 — the peer dependency (≥ 0.5.11), registered as a
  config plugin in `apps/mobile/app.config.ts` with the API 26 floor Dawn needs
- `unplugin-typegpu` + the `unplugin-typegpu/babel` plugin in
  `apps/mobile/babel.config.js` — without it the `"use gpu"` stroke body ships
  as plain JS and the ink head draws nothing
- the scene itself, authored against Redraw, at
  `apps/mobile/components/splash/redraw/`

TO FINISH IT, drop both tarballs here and run one command:

```
cp ~/Downloads/redraw-<ver>.tgz ~/Downloads/react-native-redraw-<ver>.tgz vendors/
pnpm add -w "redraw@file:./vendors/redraw-<ver>.tgz" \
             "react-native-redraw@file:./vendors/react-native-redraw-<ver>.tgz"
```

Then swap the one import in `apps/mobile/components/splash/MoyoSplash.tsx`
(marked `REDRAW HAND-OFF`) and rebuild — the native side is already in the
binary, so it is a JS-only change from there.

## `@viro-external/*` at viro-external `4dc2775`

The seven `viro-external-*-4dc2775.tgz` files are `pnpm pack` output of
mikevocalz/viro-external branch `feat/native-whiteboard-rive-panels` at
`4dc2775d3a07a3f9267b9e8db201fe3edda51287` (clean tree), packed 2026-10-25.
`pnpm.overrides` in the root `package.json` points every `@viro-external/*`
name at them. The older unsuffixed tarballs are what `main` used before.

| Tarball | sha256 |
| --- | --- |
| `viro-external-core-0.1.0-4dc2775.tgz` | `d5641912a3c8fa6b7de84b14506ae777071f616715bbf4b8373d25789510b4a7` |
| `viro-external-media-0.1.0-4dc2775.tgz` | `d1e16969473154fbe195746b1351316ca8ef336123c8f4b0034ed92e5a8dd64f` |
| `viro-external-meta-layout-0.1.0-4dc2775.tgz` | `874d2db8963b90197a8f95abdd9e3b33a80e9e4f1080cd1109530ae17433c5d4` |
| `viro-external-native-panels-0.1.0-4dc2775.tgz` | `d8d6248a573597dce32b8797987c5e353336535db0cb825ffe0e3185ca0845a9` |
| `viro-external-spatial-panels-0.1.0-4dc2775.tgz` | `3e1d3a7d3a69d86ab1acd24148e92ed165f62f8b05b986be4892a657cb2a30c6` |
| `viro-external-ui-0.1.0-4dc2775.tgz` | `d9139af42ac8822211587bd7715a1ff9c8b3833ccde6ccbdef0359b33a96dc61` |
| `viro-external-xr-contract-0.3.0-4dc2775.tgz` | `ed18283a2019bda2698d4db5b5b9f7ba9b4609fe3ea68def340730d12f39c892` |

Two of them are not live yet:

- **native-panels** is a dependency of `@acme/app` for its JavaScript, but
  its Android library is excluded from autolinking unless `MOYO_NATIVE_PANELS=1`
  (`apps/mobile/react-native.config.js` says why: its Kotlin needs viro
  3.0.3-moyo.1's `CanvasSurfaces`. Nitro stopped being a reason when the app
  moved to Nitro 1.0).
- **spatial-panels** is vendored and overridden but nothing depends on it.
  It is an Expo module, and Expo autolinking would compile its Kotlin, which
  needs viro 3.0.3-moyo.1's renderer classes. Add it as a dependency in the
  same change that moves the app to that viro.

## Nitro V1 ports (`*-nitro-v1*.tgz`)

The app runs Nitro Modules 1.0 alpha (`react-native-nitro-modules`,
`nitro-core` and `nitrogen` at `1.0.0-alpha.nightly.100.g107f6fc66597`, set in
the `pnpm-workspace.yaml` catalog). No Nitro library on npm targets V1 yet, so
each one below is our port, packed from the `nitro-v1` branch of a private
repo (`~/nitro-v1-ports/<repo>` locally). `pnpm.overrides` in the root `package.json` points
each package name at its tarball. Every tarball is newer than the commit it was
packed from.

| Tarball | Port (`nitro-v1` branch) and commit | sha256 |
| --- | --- | --- |
| `react-native-mmkv-4.3.2-nitro-v1.tgz` | [mikevocalz/react-native-mmkv-nitro-v1](https://github.com/mikevocalz/react-native-mmkv-nitro-v1/tree/nitro-v1) `ecb01694709e9305cc53c9b882bb9f9474fe77b8` | `b060b7531aa1cfc901da6408de38de232e161d1eeb0e1c32454fe2ba0cc70735` |
| `react-native-nitro-fetch-1.6.2-nitro-v1.tgz` | [mikevocalz/react-native-nitro-fetch-nitro-v1](https://github.com/mikevocalz/react-native-nitro-fetch-nitro-v1/tree/nitro-v1) `5341e3fb29045a8a39150171e19733f5d2f9c142` | `7234e18c49360c43f9d11e7f730f108eae97a40737c6afe69c51bf692d307d70` |
| `react-native-nitro-image-0.15.2-nitro-v1.tgz` | [mikevocalz/react-native-nitro-image-nitro-v1](https://github.com/mikevocalz/react-native-nitro-image-nitro-v1/tree/nitro-v1) `8bdac279abde39a9b5fa15ddec1819111867a089` | `9d46659698e506c58a9a9b479acb1e7288da1f61b72e2a0eecc52dcaedb1ef94` |
| `nitro-canvas-in-Vision-0.0.2-rive.4-nitro-v1.tgz` | [mikevocalz/nitro-canvas-in-Vision-nitro-v1](https://github.com/mikevocalz/nitro-canvas-in-Vision-nitro-v1/tree/nitro-v1) `f3393b6331caafa0f6a1113dbedda85369f47598` | `63ec01adc7cee19b3f6cd15fb7b6154d45970d1757cd8300087b5b5d08f8db9e` |
| `expo-pico-core-1.0.0-nitro-v1.tgz` | [mikevocalz/expo-pico](https://github.com/mikevocalz/expo-pico/tree/nitro-v1) `13b799e230eaba5ec1812e8b301ac0ce0f9e10cc` | `eab4590b762533e2f31f59ba61a9a61077b4747ff851cd2f3132a22387bddebd` |
| `react-native-vision-camera-5.2.3-nitro-v1.tgz` | [mikevocalz/react-native-vision-camera-nitro-v1](https://github.com/mikevocalz/react-native-vision-camera-nitro-v1/tree/nitro-v1) `19f6845ba90bbd9f3723394c66215f0ff5b5787d` | `33320156b896358ecc2798e546dd425f4df48ef550ce4bf4bab26588cdf9f146` |

Three patches were deleted with this move because their changes are inside the
ports: `react-native-nitro-image.patch` and `react-native-vision-camera.patch`
(the `com/facebook/react/viewmanagers` source exclusion and `compileOnly`
react-android) and `nitro-canvas-in-Vision.patch` (the C++ is byte-identical in
the port and the Swift edits are carried over).

`react-native-nitro-image` is declared directly by `@acme/app` at
`0.15.2-nitro-v1.0`. Without that, pnpm resolved vision-camera's dependency on
it from the registry (stock 0.15.2, Nitro 0.37) and the override never applied.
`@acme/secure` and `@acme/ui` declare `react-native-nitro-modules` and
`nitro-core` because they import `react-native-mmkv`; with the runtime
undeclared, pnpm kept a stale 0.37.1 for mmkv's optional peer in those two
workspaces.

All ports peer `react-native >=0.88.0`, which 0.88.0-rc.2 does not satisfy
under semver. pnpm warns and installs; nothing enforces it.

To recut one: commit and push on the port's `nitro-v1` branch, `npm pack` from
the package directory, copy the tarball here, update the override and this
table.

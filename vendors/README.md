# vendors/

Tarballs that cannot come from a registry. Committed on purpose — the `file:`
protocol pins a path, so CI and every collaborator must resolve the same
artefact (redraw.dev/docs/installation).

## `@reactvision/react-viro` 3.0.2 + Moyo patch stack

`@reactvision/react-viro@3.0.2` is the upstream release baseline; Moyo-specific visionOS/stylus changes and the selected upstream-next fixes are carried as a patch-package overlay.
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


## ReactVision parity

The Moyo app now targets the public `@reactvision/react-viro@3.0.2` release rather than a stale vendored 3.0.1 tarball. The patch overlay is intentionally separate from the release so the upstream baseline can be verified independently.

Included post-3.0.2 upstream-next patches:
- ReactVision/viro #555 — mid-list active-camera attachment
- ReactVision/viro #556 — iOS ObjectDetector bridge registration
- ReactVision/viro #557 — Quest relaunch-loop fix

ReactVision/viro #554 (function-region pinning) is **not** included yet because it depends on the matching ViroCore change; it remains a separate follow-up until both sides are released/validated together.

ViroCore fixes shipped by the 3.0.2 release line include the renderer fixes from #397, #398 and #399. Post-release ViroCore #403, #404 and #405 remain upstream-next and require a renderer rebuild before they can safely be consumed by the app.

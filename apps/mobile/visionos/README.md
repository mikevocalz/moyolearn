# Moyo on visionOS

This target was adapted from ReactVision/visionos-template commit
`b19d75559314b4dd931d881f024c870850641fb4`. The original template is MIT licensed.
It shares Moyo's Expo Router entry and opens Viro's existing ImmersiveSpace.

## Build on a Mac

Use Xcode with the visionOS 26.5 SDK (the ReactVision guide specifies Xcode 26.6),
CocoaPods, Node and the repository's pinned pnpm version.

```sh
pnpm install --frozen-lockfile
pnpm --filter mobile visionos:prepare
pnpm --filter mobile visionos:build
```

`visionos:prepare` checks for both Apple SDKs, builds both ViroKit slices from
pinned `mikevocalz/virocore` sources, copies the framework and matching shaders
into the installed Viro package, and runs CocoaPods. Run it again after installing
dependencies: the vendor archive omits that framework. Build output is cached
under `.cache/visionos` and is not committed.

Open `Moyo.xcworkspace` for device signing; select your development team and Vision
Pro. Start Metro with `pnpm --filter mobile dev`; Debug loads JS from Metro. Pair
Logitech Muse in the headset settings and allow accessory tracking. Test tip
contact and side-button drawing, pressure, disconnect cancellation, immersive
exit/reentry, and persisted strokes after the raster refresh.

## Integration

- Both Viro Expo plugins are registered. Native project files are already generated.
- A pnpm patch applies the Viro PR #2 pen source and compiled JS/plugin to the
  exact `3.0.1-moyo.1` archive, retaining its Android changes.
- Metro keeps the existing navigation, Three and lib0 rules while routing visionOS
  React Native imports to `@reactvision/react-native-visionos` and React imports
  to the matching 19.2.3 renderer version.
- Live ink uses `ViroGeometry` triangles on visionOS, avoiding the polyline shader
  modifier limitation. The settled raster remains the authoritative presentation.
- The native sources, package patch, geometry and setup are checked in. No
  Interaxon LibMuse binaries are used; those SDKs target EEG headbands.

## Validation still required

This project has not been compiled with Xcode or run on Vision Pro. ReactVision's
verified stack is Expo 57 / RN visionOS 0.86.4; Moyo uses Expo 58 / mobile RN 0.88.
The visionOS fork is installed alongside mobile RN. CocoaPods and runtime
compatibility of Moyo's other native dependencies still need the Mac build above.
Old version-specific patch-package patches from the SDK 57 guide are deliberately
not applied to SDK 58; Moyo uses pnpm patches. Source/JS tests do not establish
native compatibility or stylus focus behavior.

Guide: https://viro-community.readme.io/docs/visionos-setup-guide

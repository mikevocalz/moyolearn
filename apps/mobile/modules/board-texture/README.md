# board-texture

The whiteboard itself, on the spatial paper — the real WebView, not a picture of
it.

ViroReact cannot host a React Native view in a scene (ADR-117 §Context, and the
package's own flexbox docs). **ViroCore can.** `com.viro.core.AndroidViewTexture`
takes an Android `View`, parents it into a sink inside the `ViroView`, redirects
that sink's `dispatchDraw` into a texture surface, and hands the texture out as
a `Texture` — which a named material can carry as its diffuse channel. It ships
in the vendored fork (`viro_renderer-release.aar`, with its JNI symbols in
`libviro_renderer.so`) and nothing in `react_viro` exposes it to React.

This module is that exposure, and no more: one view whose only job is to be
somewhere the Quickdraw WebView can be mounted in the React tree and drawn in
the scene.

## Why it lives here and not in the fork

Adding a `VRTAndroidView` component to `viro_bridge` means rebuilding
`react_viro-release.aar` and re-packing the 52 MB vendored tarball for every
change (see `vendors/README.md` and the AAR-staleness trap). Everything this
needs — `AndroidViewTexture`, `MaterialManager.getMaterial`,
`VRT3DSceneNavigator`'s `ViroView` — is already public on the app's compile
classpath. A local Expo module is the smaller seam, and it survives
`expo prebuild --clean`, which anything written into `android/app/src/main`
would not.

## The contract

| prop | meaning |
| --- | --- |
| `material` | the name a `ViroMaterials.createMaterials` entry was registered under; its diffuse channel becomes the board |
| `pageSize` | the page's CSS size in dp — the same `boardSurfacePixels` the pointer injection scales by |
| `live` | ask to bind. False parks the child in the React tree and nothing else happens |
| `onBound` | `{ bound, reason }`, once per attempt. `bound: false` is not an error to report at a child — it means the scene keeps the raster presentation |

The single child is the page. It stays a React Native view with React Native's
layout; only its *parent* changes.

## What is not verified

Nothing here has run on a headset. Named, so it is not mistaken for tested:

- whether a Chromium `WebView` draws correctly into the sink's **software**
  canvas (`AndroidViewSink.dispatchDraw` locks one with `Surface.lockCanvas`),
  and at what frame cost at `pageSize × density`;
- whether `Material.setDiffuseTexture` re-textures a quad that is already drawn
  with that material, or whether the material has to exist before the quad does;
- whether the ViroView and this view are ever in different activities on PICO
  (the VR-activity hop), which is the one shape `findViroView` cannot see past.

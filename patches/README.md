# Patches

## `@seshuk/payload-storage-bunny@3.0.0`

**Why:** the adapter targets Payload 3 and imports `initClientUploads` from
`@payloadcms/plugin-cloud-storage/utilities`. Payload 4 removed that export —
verified absent from both `@payloadcms/plugin-cloud-storage@4.x` and `payload@4.x`
core. It is the ONLY symbol the adapter imports that no longer exists; every
other one (`cloudStoragePlugin`, `createClientUploadHandler`, `sanitizePrefix`,
`getFileKey`, `getFilePrefix`) is still there.

**What the patch does:** vendors `initClientUploads` verbatim from
`@payloadcms/plugin-cloud-storage@3.88.0` into the adapter's entry file and drops
the import. The function only mutates `config.endpoints` and
`config.admin.{dependencies,components.providers}` — all unchanged in Payload 4 —
so it runs unmodified.

**Also required, in the root `package.json`:**

```json
"pnpm": { "overrides": {
  "@payloadcms/plugin-cloud-storage": "4.0.0-canary.29",
  "@payloadcms/translations": "4.0.0-canary.29"
} }
```

Payload 4 hard-fails at `getPayload()` if any `@payloadcms/*` package disagrees
with core, and the adapter pulls the 3.x line transitively. Keep these pinned to
whatever `payload` itself is on.

**Verified end to end** against the live zone: boot, `payload.create()` with a
file, bytes present under `moyolearn/` with matching content, absent from the
zone root, and `payload.delete()` cascading to Bunny.

**Remove this when** the adapter ships a Payload 4 build. Upstream issue:
`docs/decisions/payload-storage-bunny-payload4-report.md`.

## `expo-router@57.0.15`

**Why:** cold boots logged `Can't perform a React state update on a component
that hasn't mounted yet`, on roughly one boot in three. Symbolicated to
`build/fork/useLinking.native.js` — `getInitialState()` runs during
`NavigationContainerInner`'s FIRST render, and the `getInitialURL()` promise it
returns calls `setLastUnhandledLink` (a `useState` setter on that same
not-yet-committed fiber) when it resolves. Upstream still has it: the code at
`expo-router@latest` is identical, so this is not an upgrade away.

**What the patch does:** gates the setter on the actual mount, in BOTH
`NavigationContainer` copies (`build/fork` and `build/react-navigation/native`,
which take turns depending on the entry). Before the container commits the
value is held in a ref; the mount effect flushes it. Deferring with
`setTimeout(0)` was tried first and is NOT enough — React schedules its own
work on a macrotask too, so the deferred write still sometimes beat the commit,
which is exactly the intermittency that made it look fixed. Nothing reads
`lastUnhandledLink` before the commit (the container renders `fallback` until
that promise resolves), so deep-link handling is unchanged.

## `expo-horizon-core@57.0.2`

Enables `android.buildFeatures.buildConfig` explicitly. The module declares
`META_HORIZON_APP_ID` in `defaultConfig`, but AGP 9 disables BuildConfig generation
by default and otherwise rejects the module during configuration. Remove this
patch when the upstream module enables the feature itself.

## `@reactvision/react-viro@3.0.1-moyo.1`: appcompat on the two Android shims

The `react_viro` and `viro_renderer` Gradle modules are thin wrappers around
prebuilt AARs whose resources use appcompat theme attributes (`colorPrimary`,
`dialogCornerRadius`, `buttonBarButtonStyle`). Neither module declared
appcompat, so a release build failed in `verify<Variant>Resources` with
`AAPT: error: style attribute 'attr/colorPrimary ... not found`. Debug builds
skip that task, so this did not show up until `assemblePicoRelease`. Each shim
now declares `androidx.appcompat:appcompat:1.7.0`, the version React Native
0.88 pins, so it adds no second copy to the app.

The same shims disable every `bundle*Aar` task, because AGP refuses to publish
an AAR that wraps a local `.aar`. That also caught
`bundle<Variant>LocalLintAar`, which only feeds lint, so the app's
`lintVitalAnalyze<Variant>` failed on a missing `out.aar`. The filter now
leaves `*LocalLintAar` enabled; both shims build it. The same patch also carries
the visionOS module changes and the `moyoViroRendererAar` override that were
already in it.

# Forge Board integration

The existing Yjs `BoardDoc` remains authoritative. Forge receives a read-only
snapshot/listener adapter and derives its render data. The native preview no
longer creates a global QuickDraw document or mirrors pointer samples into it.
The current input router, WebView export and OCR path remain in use.

## Workstreams

| Owner role | Files | Result | Validation |
| --- | --- | --- | --- |
| Document adapter | `forge-board-source.ts`, `board-doc.ts`, `board-session.ts` | Read-only Forge source, settled Yjs history, autosave for document undo/redo and local caching of remote merges | Portable board tests and actual Forge integration tests |
| Persistence | `forge-board-storage.ts`, `board-storage.ts` | Exact legacy/corrupt bytes copied to recovery keys before replacement; valid legacy snapshots converted through restore origin | Recovery, corrupt JSON/base64/Yjs and storage failure tests |
| Native presentation | `native-board.native.tsx`, `tutor-xr-screen.native.tsx` | Single input owner, document-driven Forge preview, unsupported-scene fallback, disposal on background/unmount | Typechecks; runtime validation remains separate |
| Toolbar | `ForgeBoardIcon.tsx`, `Whiteboard.tsx` | Original Forge pen/highlighter/eraser artwork, outline/filled crossfade using existing Legend motion, static reduced-motion path; instance Zustand store | UI/mobile types; visual validation separately recorded |
| Build engineering | Nitro Forge PR #22 | Host ABI filters, strict Prefab shared-library linkage, real native regression build/ELF check | Upstream CI and local build evidence in that PR |
| Source intake | `tooling/vendor-forge.mjs`, `vendors/forge-source-lock.json` | Immutable private source artifacts and exact host Nitrogen regeneration | Frozen install, codegen and actual imported bindings |

## Compatibility and rollout

Moyo keeps Nitro v1 nightly 100; Forge's source preview uses nightly 120. The
vendoring script regenerates bindings at the host's exact nightly 100 and adapts
its peer pins. It does not co-install another Nitro runtime. Run
`node tooling/vendor-forge.mjs [optional-local-forge-checkout]` after installing
Moyo's dependencies. Without an argument it clones the owning repository into a
temporary directory; no developer-machine path is embedded in an artifact.

`MOYO_FORGE_BOARD=1` controls native autolinking; the normal app explicitly leaves
it off. The running-process `nativeBoard` validation flag also requires the
registered Forge factory. Moyo's current Viro AAR lacks the CanvasSurfaces class
required by the Forge Android XR backend. A validated Viro upgrade is still
required before enabling it. This XR backend uses Android surface rendering; it
is separate from Forge's Skia v3 2D canvas.

Moyo currently installs `@shopify/react-native-skia@2.14.0` with its established
Graphite preparation. This PR does not label that setup Skia v3 or install v3
alongside it. Forge's isolated native lab tests genuine `react-native-skia@3.8.1`.
The default learner renderer remains unchanged pending native proof and rollback.

The existing `expo-horizon-core` window remains 1024x640dp with orientation
`default`. Scene object size, material surface pixels and app-window size remain
separate. Existing native right-rail and web navigation contracts remain owned
by the app; no pane/navigation rewrite is included.

## Validation limits

- Source tests prove document/encoding behavior, not handwriting latency or GPU pixels.
- PNG capture, Ask Natalie and OCR continue through the existing light-paper export.
- Pen, highlighter and eraser remain the learner toolbar's established tool set.
  Pencil, selection, pan, shapes and text are not claimed as newly implemented.
- Logitech Muse still uses the existing Viro stream. No extra BLE subscription or
  EEG SDK was added. Pressure zero is retained in tested records. Actual pen axes,
  tracking, reconnection and palm rejection require hardware interaction evidence.
- The capture MMKV instance and capture/board keys remain global. Session disposal
  on persona changes does not establish account-scoped storage. Full isolation
  needs a shared capture scope and an explicit ownership policy for legacy data.
  This is a remaining blocker, not fixed by the recovery-key migration.
- Native iOS/iPadOS, physical Surface Duo, screen-reader behavior and measured
  performance require their own validation. No source test is a physical-device pass.

The pinned skill receipt is in [skills.md](skills.md). Execution results are
recorded in the PR and validation record; pending work is not a passing result.

## Rive source and history completion

`apps/mobile/assets/rive/moyo_forge_icons.riv` now contains five original Forge
artboards. The reproducible source and CLI/headless render evidence live under
`probes/forge-icons/`. Compilation, ten outline/filled SVG comparisons, an
intermediate transition frame, and reduced-motion/theme rendering passed. Native
Rive asset loading remains unverified; the toolbar uses the shared SVG artwork
through Moyo's motion layer.

Both toolbar commands and Ctrl/Cmd keyboard history target the document owner.
Text fields retain their editing shortcuts. Pointer gesture boundaries temporarily
keep Yjs capture open, so a long pause inside a stroke does not split it into
multiple undo steps; completion restores the ordinary capture policy. Native
WebView messages and web event handlers carry boundaries only, not another pen
sample stream. Tests exercise real Yjs, QuickDraw store batches and the embedded
page shim, including cancellation and same-task synthetic events.

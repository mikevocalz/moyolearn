# MB-13: PhotoCraft native creative editor and brand assets

<!-- What: PhotoCraft native creative editor and brand assets implementation contract. -->
<!-- Why: ship scoped operations capability without duplicating Moyo Learn or its tenant data. -->
<!-- SOT-KEYWORDS: moyo business photocraft native acceptance provider release -->

**Status:** Documentation and engineering scope only; not an implemented feature. **Implementation blockers:** MB-02, MB-12. See [MB-01 architecture #101](https://github.com/mikevocalz/moyolearn/pull/101) and #95 engine admission only.

## Existing modules and first inspection targets

- `docs/business/photocraft-admission.md`
- `docs/business/creative-studio.md`
- `docs/business/native-lock-provenance.json`
- `packages/app/features/editor`
- `packages/ui`
- `apps/mobile`
- `pnpm-workspace.yaml`

## Complete user journey to implement

1. Authorized marketer opens a Moyo Business design from Campaign Studio, edits editable text/image layers using a genuine iPad-native canvas and Apple Pencil gestures, then saves a revision.
2. Design owner exports an immutable approved PNG/JPEG revision into the organization's asset library, then inserts that asset into the email block composer.
3. A reopened file retains layers, command history, ownership and editability. Exports do not silently replace source documents.

## Ownership and implementation invariants

- Preserve PhotoCraft source/license pin and already-merged admission harness; upstream egui shell is not a React Native editor.
- Introduce a narrowly scoped Rust C ABI/Expo Modules 2 adapter after real compile compatibility is proven; JS uses opaque generation-safe document handles with explicit release.
- Keep PhotoCraft engine as sole document/history owner. Skia/Graphite displays canvas and handles; TypeGPU/WebGPU integrates only where approved by installed renderer/admission.
- No unverified fake device support. Verify iOS device/simulator, Android and WASM separately; evaluate source/notice/license obligations before bundling.
- Reuse Moyo native semantic controls, Gesture Handler and Reanimated current catalog, existing motion where installed, and right-rail tablet/foldable layout.
- Owner/tenant document and asset authorization controls export, sharing and source metadata; native cache disposal cannot leak across tenant switches.
- Do not embed whole desktop PhotoCraft or a native WebView dressed up as a native editor.

## Acceptance criteria and release evidence

- [ ] Rust host document/undo/redo/handles tests and native ABI compile/link on supported targets; reject invalid/stale handles.
- [ ] iPad Pencil tilt/pressure/drag and native undo/redo tested on real supported hardware, not inferred from unit mocks.
- [ ] CPU reference and GPU output parity tolerances documented for raster/vector/text and exports; memory/resource cleanup stress-tested.
- [ ] Cross-tenant asset and concurrent revision writes fail closed; edit drafts survive fold/resize/background.
- [ ] Web preview, native platform adapters, accessibility, keyboard/pointer and reduced-motion workflows tested.
- [ ] Record exact lockfile/runtime source/Graphic version compatibility and hardware not available.

## Review and release plan

**Independent reviewer roster:** Principal Rust/FFI engineer, Expo Modules 2 engineer, GPU/Skia specialist, tablet UX and licensing/security QA.

**Skills:** Read root AGENTS.md/CONTRIBUTING.md and the actual installed target files before runtime changes. Load relevant expo/skills, mattpocock/skills (PR/module design), coreyhaines31/marketingskills, pbakaus/impeccable, petergyang/no-ai-slop and the pinned mikevocalz-foldable-layouts skill for adaptive work. Honor the current catalog and existing @acme/ui/motion/route adapters.

**Rollback:** Feature flag hides native canvas while stored editable documents/export revisions stay intact; release handles and keep existing email composer.

**Actual evidence for this planning PR:** reviewed GitHub source and existing specs; created branch/document/draft PR. No compile, lint, native build, database test, provider sandbox, real device, account connection or deployed changes were executed. Keep PR in draft until a complete tested implementation is added. Document unsupported devices separately. Do not auto-merge, rename subscriptions, send communication or execute transfers based on this contract.

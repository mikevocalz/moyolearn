# Moyo Studio: native-first editor suite with Nitro-Forge

SOT: This decision records the editor architecture for Moyo Business, alongside docs/business/creative-studio.md and docs/business/photocraft-admission.md.
SOT-KEYWORDS: business studio photocraft artcraft nitro-forge wordcraft gridcraft deckcraft editor native wasm rust

**Status: architecture decision / proposed implementation, not a shipped editor.**
**Decision date:** 2026-11-02

## Outcome

Moyo Business will offer its own branded office and creative editors inside the EXISTING shared cross-platform app, rather than a third-party office editor UI. The React Native / Expo and Next.js hosts render shared feature screens from packages/app/features using the established semantic @acme/ui components. Preserve Expo Router/Solito route ownership, the existing business role shell and the foldable/tablet navigation contracts. Do not build independent web and native editors, duplicate routing, ship an egui WebView, or introduce raw HTML feature controls.

The first-party product is **Moyo Studio**, one consistent workspace containing multiple domain editors. It is not a single monolithic rendering or document engine. It can edit Moyo-owned documents and explicitly authorized imported third-party files. Google/Microsoft Connected Apps are file sources and synchronization targets; they do not grant a right to embed their proprietary editors.

## Reusable engine boundary

The previously discussed **Nitro-Forge** components are maintained and released from a **separate independent repository, outside the Moyo monorepo**. Moyo depends on their published, versioned artifacts as any other application would. NitroForge owns the reusable engines, Rust/JS bindings, cross-platform tests and release metadata. Moyo owns only Moyo-specific UI, tenancy, storage and permissions. The independent repository has not yet been provisioned:

| Standalone package (proposed) | Candidate engine(s) | Moyo surface |
| --- | --- | --- |
| @nitro-forge/quillforge | storytold/wordcraft | Docs (.docx) |
| @nitro-forge/gridforge | storytold/gridcraft | Sheets (.xlsx, CSV) |
| @nitro-forge/deckforge | storytold/deckcraft | Slides (.pptx) |
| @nitro-forge/pixforge | storytold/photocraft; evaluate vectorcraft, designcraft, figcraft | Design, image and vector assets |
| @nitro-forge/folioforge | storytold/pdfcraft | PDF |
| @nitro-forge/reelforge | storytold/filmcraft; evaluate effectcraft | Video / effects |
| @nitro-forge/beatforge | storytold/soundcraft | Audio |

Repositories must be audited, separately commit-pinned and licensed before code is copied or linked. A GitHub README is not a tested ABI. These proposed package names do **not** imply that npm packages, mobile bridges or compatible command APIs exist. Source admission and runtime linkage are distinct gates. PhotoCraft already has an immutable reviewed source pin in docs/business/upstream-lock.json; do not silently update it or reinterpret its compile-only PR #95 as a working editor.

Retain upstream copyright and LICENSE/NOTICE/ATTRIBUTION requirements and audit transitive crates, dictionaries, codecs, fonts and assets before shipping. Do not reuse ArtCraft trademarks, logos or branding in Moyo.

## Independent repository, distribution and upstream synchronization

**Hard separation:** NitroForge must be a distinct Git repository, CI pipeline, package release and issue tracker, ideally under a dedicated project organization. Do not put the NitroForge source of truth in `packages/app`, `packages/ui` or Moyo's existing `packages/art` registry. Moyo may temporarily retain its immutable PhotoCraft source-admission history, but future upstream pin changes and adapter implementations belong in NitroForge; Moyo consumes released builds.

Proposed standalone repository layout (to be created separately; not present in this PR):

```text
nitroforge/
  crates/
    engine-core/           # reviewed typed façade, document/revision/undo contracts
    engine-photocraft/     # pinned and audited upstream integration
    engine-wordcraft/
    engine-gridcraft/
    engine-deckcraft/
    ffi/                   # narrow versioned C ABI, handle ownership and cancellation
    wasm/                  # browser-facing engine adapters
  packages/
    core/                  # @nitro-forge/core
    react-native/          # @nitro-forge/react-native; Nitro codegen + Expo config
    web/                   # @nitro-forge/web; worker/WASM loader
    pixforge/              # @nitro-forge/pixforge
    quillforge/
    gridforge/
    deckforge/
    folioforge/
    reelforge/
    beatforge/
  examples/
    expo-playground/       # app-agnostic iOS/Android integration tests
    web-playground/        # web reference application
  tooling/
    upstream/              # pin watcher, review reports, changelog classification
    licenses/              # notices and dependency audit
  .github/workflows/
    upstream-watch.yml
    native-wasm-ci.yml
    publish.yml
  upstream.lock.json
  compatibility.json
```

The `@nitro-forge` namespace is illustrative until the registry scope is verified/reserved. Each engine adapter is optional and can be installed independently. Branding, app accounts, content models, database and Moyo design tokens must not be runtime dependencies of the SDK. Rust crates are separately versioned where necessary; release packages include verified iOS/Android bindings and web WASM artifacts, with compatible toolchains and integrity metadata.

### Keep up with frequent ArtCraft changes safely

1. **Detect:** in the independent NitroForge repository, poll or receive permitted upstream GitHub webhook events for each exact ArtCraft repository. Track merged PRs, commits, tags and license changes. Watch *merged* commits, not unmerged PR heads. An independent project's Actions workflow does not automatically receive upstream `push` events; use polling or a separately configured GitHub App/webhook for event-driven checks.
2. **Classify:** compare the locked commit with the latest approved upstream target, map changes to affected engine crates and identify ABI changes, new capabilities, migrations, licensing/asset notices, security fixes and feature flags.
3. **Propose:** create a NitroForge update PR with a reproducible immutable SHA pin, upstream PR links, a generated change report, compatibility metadata and machine-readable feature declarations. The updater must never silently rewrite production pins.
4. **Test:** compile Rust for host, iOS, Android and WASM; execute engine fixtures, editable-document round-trips and conversion tests; verify Nitro/Expo native linking, wasm execution, Skia image output, memory/resource lifetime, accessibility and relevant device test suites. Handle release-blocking security/license changes explicitly.
5. **Release:** after successful checks and review, publish a new semver NitroForge release with per-platform artifacts, provenance, supported architecture/runtime matrix, feature list, migration notes and changelog. New upstream functionality is *available* only when the adapter exposes and verifies it.
6. **Propagate:** configure Renovate/Dependabot or an equivalent release bot in each consumer (Moyo, NYC-MON, DVNT, Pa'Casa, Harlem Might). It opens PRs against **NitroForge package versions**, not ArtCraft source. Run each app's own CI/device tests before approving rollout.
7. **Roll back:** retain prior release artifacts and per-application lockfiles. Canary one app first, then widen adoption when evidence supports parity; halt rollout and revert the consumer dependency if an integration or document migration fails.

All consumers have the **same upstream SDK release stream**, but not necessarily the same installed version on the same day. For strict fleet-wide consistency, maintain a tested compatibility baseline and coordinate synchronized version-bump PRs; do not force an incompatible upgrade into production. Security backports may require patch releases on supported branches. The system must report *available, tested, released, adopted* separately. Updating a pinned SHA or passing `cargo check` does not establish feature parity.

### Versioned engine capability manifest

Every release publishes an honest capabilities matrix keyed by engine, NitroForge version, upstream commit, ABI schema, supported OS/architectures and validated editing operations. Consuming apps use this manifest to enable tools or show supported fallbacks. Moyo, NYC-MON and DVNT can each provide completely different user interfaces over the exact same SDK APIs.

### API ownership and compatibility

- NitroForge API contracts are application-neutral: session creation, validated operations, revision-aware execution, render, import/export, document history, cancellation and release.
- SemVer governs source/binary compatibility and documented behavior; freeze a versioned FFI schema and validate bridge compatibility before accepting upstream refactors.
- Consumers supply file streams, authorization decisions, workspace identity and persistence callbacks; NitroForge must never access their database or OAuth tokens directly.
- New core APIs require integration tests for all supported platforms and formats. A newer ArtCraft PR does not become a promise that the feature is present in the NitroForge SDK.
- No downstream repo copies or patches arbitrary ArtCraft engine sources independently. Any engine fix enters NitroForge upstream sync or an explicit reviewed NitroForge patch with a plan to upstream it.

## One cross-platform UI foundation: Expo UI, adaptive native views and Tailwind

**Non-negotiable source sharing.** NitroForge stays in its **own repository**, but optional editor UI and Moyo's reusable editor controls must consume **the exact same shared component implementations**, not visually similar forks. Extract product-neutral components into the independently versioned NitroForge UI foundation, then make `@acme/ui` in Moyo compose/re-export those implementations with Moyo-specific theme/semantics. The independently publishable editor UI may depend on the shared foundation; the headless Rust engine SDK must never depend on React, Expo, Tailwind, Moyo, or a UI renderer.

### What already exists in Moyo (verified from source)

- `@expo/ui` Universal `Host` + `RNHostView` are already used in `packages/ui/FieldGroup.native.tsx`, `List.native.tsx`, `Collapsible.native.tsx` and `NativeSlot.native.tsx` to blend **SwiftUI-backed iOS native controls and Jetpack Compose-backed Android native controls** with shared React Native content. Reuse these **actual adapters**, not a WebView or imitation UI.
- `@metavr/layout-compat` and `@metavr/layout-window-compat` are already installed in `apps/mobile/package.json`. Assess their exact supported native adaptive APIs and license/packaging constraints before extracting or asserting live usage; keep Meta layout compatibility in a narrowly tested platform adapter.
- `packages/ui/adaptive-panes/`, `adaptive-navigation.ts`, `reserved-regions.native.ts` and `apps/mobile/modules/reserved-regions` already form a shared adaptive layout system with Expo Modules 2, Android Jetpack WindowManager `FoldingFeature`, Apple reserved regions, explicit hinge boundaries and inspector panes. The current `AdaptivePanes` implementation works across native and web and **does not use** Expo Router's alpha `unstable-split-view` renderer. Reuse the existing behavior and tested semantics.
- Styling is **Tailwind CSS v4**, with `packages/theme/tokens.ts` as source of truth, generating `theme.css` for web and `theme-native.css` for mobile. `packages/ui/tw.tsx` currently uses **Uniwind on native** and **react-native-css on Next.js web** (Uniwind is not the Next.js styling runtime in this repository). It wraps `@expo/html-elements` so web gets semantic HTML and native gets React Native views. Reuse the same tokens, semantic component API and `className` styling boundary; do not introduce another CSS-in-JS system or copy raw web HTML into React Native screens.

### Proposed public packages in independent NitroForge repo

| Package | Responsibility |
| --- | --- |
| `@nitro-forge/native-ui` | Platform-neutral semantic primitives using `@expo/ui` Universal `Host`/`RNHostView` on iOS/Android and matching accessible web implementations; shared toolbars, inputs, menus, lists, property fields, accessible focus and shortcuts |
| `@nitro-forge/adaptive-layout` | Extracted adaptive pane, Inspector, window-size/space budgeting, hinge/posture/reserved-region geometry, keyboard/safe-area and optional verified Meta compatibility adapters |
| `@nitro-forge/editor-ui` | Optional ready-to-use document/spreadsheet/slide/image editor UI built exclusively from these same primitives: command ribbon, canvas, layer tree, formula bar, slide list, timeline, inspector |
| `@nitro-forge/core`, `@nitro-forge/*forge` | Independent headless engines and runtime transports; no UI dependency; apps may build a fully custom UI against the same engine contracts |

Dependencies flow one way: **NitroForge headless engine → runtime adapter → optional editor UI → consuming app**. `@nitro-forge/editor-ui` uses `@nitro-forge/native-ui` and `@nitro-forge/adaptive-layout`; Moyo `@acme/ui` uses the same shared foundation with Moyo-owned styles and routes. The shared foundation must **not** import Moyo packages, themes, tenant state, or business APIs. Extract neutral code in small backwards-compatible PRs, with public API and behavioral regression tests. Avoid copying proprietary or license-incompatible code.

### Responsive and adaptive is required on every surface, including web

| Environment | Expected editor behavior |
| --- | --- |
| Native phone | Compact single work area; touch-first toolbar and contextual sheets, virtual keyboard avoidance, full editing functionality accessible without desktop hover |
| Native tablet / iPad | Multi-pane canvas + object list + inspector when usable space permits; Pencil and hardware keyboard; flexible split-screen and Stage Manager resizing |
| Native Android tablet / foldable (Surface Duo, book, tabletop, future multi-hinge) | Jetpack WindowManager + verified Meta layout-capability signals; pane boundaries never cross active hinges/occlusions; preserve stable document and input state on posture/rotation/resizing |
| Web, phone width | Responsive shared editor; accessible compact toolbar, one primary pane, touch input, header/bottom navigation per host; no native right rail on web |
| Web, tablet and desktop | Responsive Tailwind-based multi-pane work area, pointer/keyboard shortcuts, resizable inspector and toolbars; SSR-safe hydration and meaningful mouse/trackpad behavior |
| XR/spatial where supported | Shared editor operation contract inside the host's Viro/spatial panel adapter; runtime capability gates rather than assuming 2D window sizing or unsupported Expo controls |

Use the **actual measured container and usable region**, not device name or fixed initial screen dimensions. Keep stable selection, undo history, edit sessions and scroll position across compact ↔ wide, orientation, split-screen, viewport segments and fold changes. The host owns global navigation policy; the NitroForge editor owns only inner workspace pane composition. Preserve Moyo's existing physical-right native foldable navigation and web header/menu policy, without imposing Moyo's global navigation shell on third-party SDK users.

Apply **shared Tailwind class recipes, semantic design tokens, responsive variants, density/text scaling, dark/light mode and reduced-motion options** through an injectable theme adapter. No hardcoded color/spacing values or app-brand assets inside NitroForge. `@expo/ui` native components are not CSS DOM nodes; translate Tailwind-derived design tokens to supported native control properties/modifiers rather than promising web CSS classes style every SwiftUI/Compose property identically. Respect the platform-native presentation while keeping one semantic API and one token source. For editor document/canvas rendering, prefer Skia/Graphite and the reviewed engine adapter, not HTML `canvas` assumptions on native.

### Verification and release gates

- Storybook/visual fixtures for the *same components* at narrow/wide sizes; browser rendering at phone/tablet/desktop; HTML semantics, focus, screen reader, keyboard/IME and pointer behavior.
- iOS/Android build + simulator + physical device verification of Expo UI native `Host` nesting, Compose measurement constraints (do not put a lazy native list inside an unbounded scroll parent), events and accessibility.
- Surface Duo hinge/book/tabletop/RTL tests, multiple fold/occlusion fixtures, iPad split window and Pencil input, resize and navigation continuity. A simulated fold fixture is not evidence of real hardware performance.
- Verify Tailwind token parity between Uniwind/native and Next.js/react-native-css/web, SSR/hydration, touch targets, text scale, responsive layout and motion reduction.
- Release tested `@nitro-forge/native-ui` and `@nitro-forge/adaptive-layout` versions to all consuming apps; Moyo and other apps upgrade via dependency PRs/CI rather than copying changes.

**Status:** design requirement only; no components have been extracted, no standalone NitroForge packages published, and no native/tablet/web QA from this document alone.

## Cross-platform composition

| Layer | Native iOS / Android | Web |
| --- | --- | --- |
| Moyo shell and native-feeling UI | Shared packages/app/features/studio screens, @acme/ui, Zustand, responsive existing panes | Same shared React Native primitives via React Native Web; thin Next.js host |
| High-frequency input | Current Gesture Handler, Reanimated/Worklets, verified Pencil and pointer adapters | Shared input semantics with browser-safe pointer adapter |
| Engine execution | A reviewed Rust core behind a narrow versioned C ABI, wrapped in C++/Nitro HybridObjects | The same reviewed core compiled to WASM, called via a typed adapter/worker where supported |
| Presentation | Existing Skia/Graphite scene; controlled CPU reference tiles first, accelerated paths only after measured parity | Skia CanvasKit or a verified web renderer adapter; no divergent document semantics |
| GPU effects | React Native WebGPU + TypeGPU for independently adapted, tested passes | WebGPU where supported, plus verified fallback |
| Data | Engine owns editable document, history and revision | Same engine document semantics |
| UI state | Zustand owns selection, tools, panels and draft session metadata; refs own imperative handles | Same shared state contracts |

**Do not assume that Rust wgpu textures can be directly handed to JavaScript WebGPU or Skia.** The documented React Native Skia/React Native WebGPU shared-Dawn interop concerns their compatible JS/native device; a Rust interop path needs independent ownership, parity and lifetime proof. Start with bounded CPU-rendered dirty tiles, avoid whole-document copies on every pointer move, then profile and validate accelerated interop.

Follow the pinned foldable skill and existing SplitView/AdaptivePanes. A native foldable/tablet keeps its physical-right rail; pane visibility depends on usable space and hinge geometry. Web retains its header and responsive web navigation, not the native right rail. Preserve Moyo's authored keyboard, screen-reader, IME, RTL and reduced-motion semantics.

## Engine session contract

Each adapter exposes only an allowlisted, domain-specific operation surface, not an arbitrary upstream command registry, filesystem path, plug-in loader, JSON control server or MCP endpoint. Proposed concepts:

- openDocument(from authorized bytes) -> opaque session id, generation and revision
- execute(session, expectedRevision, reviewed domain operation) -> new revision or typed stale/invalid/closed error
- renderDirtyTiles(session, revision, viewport, scale, budget) -> bounded tiles; reject stale completions
- serializeEditable(session, revision) -> versioned engine-native source bytes
- export(session, revision, approved format and options) -> derived immutable file bytes
- cancel(jobId); close(session) -> deterministic resource cleanup

The actual ABI and Nitro HybridObject interface must be implemented inside the independent NitroForge repository and generated from verified current toolchain APIs. JS must never receive raw native pointers as numbers. Engine history owns undo/redo: one edit corresponds to one history unit. Do not keep a second editable document in Zustand. Preserve document identity, selection intent and edit sessions across fold/unfold and host resizing. Restore or fail explicitly after OS-driven activity recreation; no untested continuity claims.

## Storage, collaboration and Connected Apps

- Better Auth session plus business-scoped server authorization on every file operation. Never trust org/user identifiers from the client; use the existing protectedOperation and repository/service architecture.
- Store file metadata, owner, revision, permissions and audit history in the established data layer; keep canonical editable bytes and immutable exports in authorized object storage (compatible with existing asset infrastructure).
- Open/save/import/export go through a provider adapter; Google Drive and OneDrive APIs may supply file bytes when authorization allows. Native Google Docs conversion is explicit, loss-aware and never called a lossless edit. Synchronizing edited Office files back requires external revision/ETag conflict checks, provider permissions and user-visible merge/fork resolution.
- Local offline drafts are encrypted where supported, scoped to the right signed-in business and reconciled after reconnect. Never silently cross-link learner/guardian information into business documents.
- Real-time collaborative editing requires domain-appropriate operations and concurrency tests (not a blanket Yjs wrapper across all Rust formats). No collaboration or cloud autosave claims until proven.

## First vertical slice: Moyo Design

Consume a separately released NitroForge PixForge integration built from the admitted PhotoCraft engine, without introducing an alternative editor engine or copying it into Moyo. Success requires an actual linked source-pinned Rust adapter, not a mock renderer:

1. Create and open a native editable design document, add a raster layer, place an image, paint a stroke and transform one object using Moyo controls.
2. Undo, redo and reopen the serialized editable source without losing layer structure. Export a PNG to a business-owned asset; exported image is not the editable source of truth.
3. Render CPU-reference dirty tiles into the shared Skia canvas and pass image comparison tests; profile native memory, latency and thread scheduling on real iPad and Android hardware.
4. Keep toolbars, layers and Inspector as shared @acme/ui components, accessible by keyboard, touch and Pencil. Never redraw the entire React tree per stylus sample.
5. Test engine fault isolation, malformed imports, source/decompression caps, stale revision/cancel, resource release, screen-reader actions, business permission denial and real device fold/posture events.
6. Expose the feature route **only after** the native bridge and web WASM paths work, or clearly label a platform-specific unsupported state. No dead nav destination.

## Subsequent slices

- **Moyo Docs:** admit WordCraft with separate pin; validate input/edit/undo, export-to-DOCX, page layout and IME on each platform; no false parity claim.
- **Moyo Sheets:** admit GridCraft with separate pin; validate formula dependency/recalculation, range selection, CSV/XLSX round-trip and virtualized accessibility, including large workbooks.
- **Moyo Slides:** admit DeckCraft; validate layout, slide objects, PPTX, presenting and media ownership.
- Then PDF, video, audio and optional FigCraft/VectorCraft additions behind the same host contract.

Any first release may limit features to verified operations. It must not imply that all upstream editor features are callable through a new native bridge.

## Validation / ownership gates

- Source: immutable SHA, licenses, relevant crate dependency graph, upstream regression tests, fixed Rust toolchain, iOS/Android/WASM compile and execution evidence.
- Native: generated Nitro code, iOS and Android link, actual engine commands, device ABI and resource-lifetime tests.
- Graphics: CPU reference snapshots, pixel parity, GPU ownership checks, dirty tile budgets, gesture latency, tablet/foldable sizing and GPU device-loss behavior.
- Files: editable round-trip, bounded import, export version, storage authorization and third-party revision conflict tests.
- Product: shared semantic UI, screen reader/IME/Pencil input, right-rail foldable layout and web header rules, reduced motion and keyboard shortcuts.
- Release: per-platform measurements and real-device evidence, not source compilation or mock tests alone.

This document decides the Moyo consumption architecture and initial vertical slice. It creates **no independent NitroForge repository, engine source, editor UI, Rust binding, package, installed dependency, end-user route or deployed service**. Implementation should proceed as individually complete, reviewable feature PRs with working engine proof and the repository's established test gates.

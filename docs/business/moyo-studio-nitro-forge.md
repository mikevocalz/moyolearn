# Moyo Studio: native-first editor suite with Nitro-Forge

SOT: This decision records the editor architecture for Moyo Business, alongside docs/business/creative-studio.md and docs/business/photocraft-admission.md.
SOT-KEYWORDS: business studio photocraft artcraft nitro-forge wordcraft gridcraft deckcraft editor native wasm rust

**Status: architecture decision / proposed implementation, not a shipped editor.**
**Decision date:** 2026-11-02

## Outcome

Moyo Business will offer its own branded office and creative editors inside the EXISTING shared cross-platform app, rather than a third-party office editor UI. The React Native / Expo and Next.js hosts render shared feature screens from packages/app/features using the established semantic @acme/ui components. Preserve Expo Router/Solito route ownership, the existing business role shell and the foldable/tablet navigation contracts. Do not build independent web and native editors, duplicate routing, ship an egui WebView, or introduce raw HTML feature controls.

The first-party product is **Moyo Studio**, one consistent workspace containing multiple domain editors. It is not a single monolithic rendering or document engine. It can edit Moyo-owned documents and explicitly authorized imported third-party files. Google/Microsoft Connected Apps are file sources and synchronization targets; they do not grant a right to embed their proprietary editors.

## Reusable engine boundary

The previously discussed **Nitro-Forge** components are intended as reusable, Moyo-independent packages, with Moyo-specific UI, tenancy, storage and permissions outside those packages:

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

The actual ABI and Nitro HybridObject interface must be implemented and generated from verified current toolchain APIs. JS must never receive raw native pointers as numbers. Engine history owns undo/redo: one edit corresponds to one history unit. Do not keep a second editable document in Zustand. Preserve document identity, selection intent and edit sessions across fold/unfold and host resizing. Restore or fail explicitly after OS-driven activity recreation; no untested continuity claims.

## Storage, collaboration and Connected Apps

- Better Auth session plus business-scoped server authorization on every file operation. Never trust org/user identifiers from the client; use the existing protectedOperation and repository/service architecture.
- Store file metadata, owner, revision, permissions and audit history in the established data layer; keep canonical editable bytes and immutable exports in authorized object storage (compatible with existing asset infrastructure).
- Open/save/import/export go through a provider adapter; Google Drive and OneDrive APIs may supply file bytes when authorization allows. Native Google Docs conversion is explicit, loss-aware and never called a lossless edit. Synchronizing edited Office files back requires external revision/ETag conflict checks, provider permissions and user-visible merge/fork resolution.
- Local offline drafts are encrypted where supported, scoped to the right signed-in business and reconciled after reconnect. Never silently cross-link learner/guardian information into business documents.
- Real-time collaborative editing requires domain-appropriate operations and concurrency tests (not a blanket Yjs wrapper across all Rust formats). No collaboration or cloud autosave claims until proven.

## First vertical slice: Moyo Design

Build on the admitted PhotoCraft engine, without introducing an alternative editor engine. Success requires an actual linked source-pinned Rust adapter, not a mock renderer:

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

This document decides the architecture and initial vertical slice. It creates **no editor UI, Rust binding, package, installed dependency, end-user route or deployed service**. Implementation should proceed as individually complete, reviewable feature PRs with working engine proof and the repository's established test gates.

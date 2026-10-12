# PhotoCraft: native engine admission

Stack: #92 campaign baseline -> #93 registry-latest packages -> #94 semantic gestures -> this admission change.

## What this change executes

`tooling/photocraft/admission.py` reads the existing `docs/business/upstream-lock.json` rather than adding a second source pin. It verifies the exact PhotoCraft repository/commit, unchanged tracked engine files, package identities, declared Rust toolchain, code-license expression and presence of the lock/notices. The evidence includes SHA-256 hashes of Cargo.toml, Cargo.lock and licensing notices.

A read-only workflow compiles the selected document/operations/raster/paint/composition/I/O/PSD/engine crates with `--locked` on host Linux, iOS device, Apple Silicon iOS simulator, Android arm64 and WASM. Source lives only in the CI checkout; no upstream source, fonts, logos or binaries are vendored into Moyo. The Apple/Android jobs are **compile checks**, not a built Expo module, signed application, simulator session or physical-device result. Missing SDKs, failed dependencies and target incompatibilities fail the job; they are not marked supported.

The host job additionally inserts an original four-test fixture in a new test file and runs the actual public `photocraft_engine::Session` facade. It tests creation through `file.new`, document ownership isolation between two sessions, rejection of an unsupported command without replacing the current document, and presence of the required create/undo/redo command metadata. This does not yet prove an edit/undo/save round-trip, PSD fidelity, GPU pixels or a native JS bridge. Twenty-three local Python tests cover source identity, immutable pinning, license/toolchain checks, the selected command matrix and CLI evidence/cleanup behavior; they are not Rust execution results. A timed-out command is recorded with its arguments, log name, null exit code and `timedOut: true`, while the overall result remains failed and the owned host fixture is removed.

The WASM command deliberately uses the pinned engine's ordinary feature set. At `fa2fe1c90fa77235d648a2d21428491593e1c2d9`, the [engine manifest](https://github.com/storytold/photocraft/blob/fa2fe1c90fa77235d648a2d21428491593e1c2d9/crates/engine/Cargo.toml) defines only the opt-in `corpus` feature, with no `web` or `default` feature. The [upstream browser application](https://github.com/storytold/photocraft/blob/fa2fe1c90fa77235d648a2d21428491593e1c2d9/apps/photocraft-web/Cargo.toml) also depends on the engine without feature overrides. Do not invent `--features web` for this source pin. This matrix checks the selected engine crates, not the browser UI or its WebGPU renderer; absence of a GPU package in the command is not a dependency-graph audit or GPU runtime validation.

## Source admission is not runtime exposure

The inspected engine exposes `Session::execute` and a command registry; it also depends on the plug-in crate and includes filesystem/automation commands. Do not export its arbitrary command dispatcher, filesystem paths, plug-in loading, remote control or MCP server to a browser, model or mobile screen. A future Moyo bridge needs a small reviewed operation allowlist with explicit JSON validation, quotas and cancellation at its native boundary. Byte-level import/export is preferable to arbitrary paths. Existing tenant authorization and asset ownership remain service-side.

The code license is MIT OR Apache-2.0. ArtCraft branding and separately licensed fonts/assets are not admitted merely because compilation passes. Metadata hashes support provenance, not a blanket license certification. Review the complete Cargo dependency graph and redistributed asset notices before shipping.

## Remaining integration contract

The native iOS/Android adapter must expose opaque document handles with generation checks, schema/ABI version negotiation, revision-aware commands, cancellable jobs, explicit release and exactly one history unit per completed edit. No Rust pointer may cross as a JavaScript number. Reject stale results after undo, restore, organization switch or document close. Handle invalid documents and decompression/resource exhaustion without crashing the app. Keep the engine as the authoritative document/history owner; Zustand owns transient screen state, not a second pixel document.

Skia/Graphite owns the chosen Moyo canvas presentation and overlays. React Native WebGPU and TypeGPU may share a verified JavaScript GPUDevice for specifically adapted passes; Rust wgpu/Skia/JS textures are not automatically interchangeable. First prove CPU reference rendering and bounded dirty-tile transfer, then compare accelerated pixels and measure memory, latency, cancellation, device loss and resource release. Do not add a second full-frame compositor or claim zero-copy without evidence.

React Native WebGPU and TypeGPU are existing mobile dependencies; the original #93 receipt incorrectly classified their direct manifest pins as uninstalled because it checked only catalog entries. #93 owns their actual manifest/catalog/lock reconciliation with npm `latest`, alongside Reanimated, Worklets, Gesture Handler, Skia and Graphite. Retain exact registry integrity receipts and validate native compatibility whenever updating that graph. Installed JavaScript GPU packages do not establish a PhotoCraft Rust bridge, shared GPU ownership or pixel parity. No nightly fallback or imagined PhotoCraft npm package is introduced here.

All future native controls must compose `@acme/ui`, its semantic primitives, form controls and adaptive panes. Use Gesture Handler hooks (`usePanGesture`, `usePinchGesture`, `useRotationGesture` and current composition relations), Reanimated get/set shared values and Worklets scheduling; no DOM drag/drop or legacy builders. Kinetrell alone owns new high-level chrome transitions. Coordinate confirmed/predicted Pencil samples, finger navigation, pointer cancellation and transformed document coordinates without writing React or history every frame. Physical-right native rails, hinge-safe split panes and the distinct web navigation policy follow the tailored foldable skill in #91. A hidden egui WebView is not a native editor.

The final export pipeline must preserve an editable source revision separately from immutable PNG/JPEG assets, validate business ownership, strip unintended metadata, preserve accessibility descriptions and insert exports into real semantic email text/links. Never flatten the whole newsletter to an image. No new route is exposed by this admission PR.

## Merge evidence

- Twenty-three Python admission and CLI lifecycle contracts passed locally; see the focused CI job for repository-run evidence.
- On Moyo head `f60047a7241a79fa961038a37afb01f6c7f09df1`, [run 38148975623](https://github.com/mikevocalz/moyolearn/actions/runs/38148975623) passed all five compile targets. Its [host artifact](https://github.com/mikevocalz/moyolearn/actions/runs/38148975623/artifacts/11706087383) records `cargo test --locked -p photocraft-engine --test moyo_studio_admission`: four passed, zero failed, zero ignored. These results are tied to that head, not a substitute for checks on later integration commits.
- Rust host fixture and five-target compile jobs must report their actual result; a queued job is not a pass.
- Full Moyo framework/native regression checks on the stacked, updated npm graph remain required.
- Native module linkage, iPad/Pencil behavior, Android devices, WASM execution, PSD corpus, CPU/GPU parity and memory-pressure tests remain unimplemented or unverified; compilation cannot mark them complete.

Ownership: Rust/FFI, GPU/performance, native input/accessibility, tenant/asset security, QA/device testing and licensing. Apply repository CONTRIBUTING and the relevant installed skills. Project reference stack remains expo/skills, mattpocock/skills, Argent/agent-device, coreyhaines31/marketingskills, pbakaus/impeccable, petergyang/no-ai-slop, and mikevocalz-foldable-layouts. Listing a skill or test tool does not claim it ran.

Sources: PhotoCraft's pinned `crates/engine/src/lib.rs`, `crates/engine/src/commands.rs`, `crates/engine/src/file_cmds.rs`, `crates/engine/Cargo.toml`, root Cargo.toml and NOTICE, all at the reviewed commit in upstream-lock.json. The public facade and mandatory plug-in dependency were inspected directly, not inferred from the marketing README.

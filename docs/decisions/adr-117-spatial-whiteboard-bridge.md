# ADR-117 — The spatial whiteboard's bridge: one engine, two renderers

Status: **PROPOSED — unverified on hardware.** Date: 2026-09-13 · Decider: Mike ("A") · Author: spatial whiteboard pass

<!--
What it is: how a real, interactive whiteboard is rendered and driven inside a
ViroReact scene, given that ViroReact cannot host a React Native view — and what
that costs. Also records the local-checkout Viro dependency and everything this
change has NOT been able to measure.
SOT: packages/ui/whiteboard-board.native.tsx · packages/app/features/tutor/board-session.ts
     packages/app/features/tutor/tutor-xr-screen.native.tsx · packages/ui/xr/
SOT-KEYWORDS: adr spatial whiteboard xr viro quickdraw bridge polyline pointer injection board session camera local link unverified
-->

## Context

The tutor session's whiteboard is Quickdraw, running as one inlined HTML page
inside a `react-native-webview` (ADR-era reasoning in `whiteboard-board.native`'s
header: the same engine has to run on the laptop and the phone, or a board
started in one place does not open in the other).

ViroReact cannot host that. The installed package's flexbox documentation is
explicit that the only permitted children of a `ViroFlexView` are `ViroText`,
`ViroImage`, `ViroVideo`, `ViroButton`, `ViroSpinner` and nested
`ViroFlexView`s — never React Native views — and that `position`, `rotation` and
`scale` are respected on the outermost `ViroFlexView` only. There is no WebView
host and no native-view host anywhere in the component set.

So `<XrPanel><Whiteboard /></XrPanel>` compiles and renders nothing usable. The
board has to get onto the spatial paper some other way, and input has to get
back off it.

## Options weighed

**A — Native surface→texture bridge.** An offscreen WebView renders the board; a
native module publishes its frames into a Viro material (the `ViroCameraTexture`
precedent, where a native source is bound to a named material's diffuse
texture), and Viro hit positions are converted to page coordinates and injected
as pointer events. Highest fidelity: whatever the engine draws is what appears,
including text, images and any tool the engine grows later. Cost: a Nitro/JSI or
bridge module on both platforms, an Android `SurfaceTexture`/virtual-display
path, an iOS `WKWebView` frame path, and a ViroCore texture seam — none of which
exists in this workspace today.

**B — Engine-authoritative, Viro-rendered.** Quickdraw remains the only
authority for strokes, tools, eraser and highlighter semantics, undo composition
and export. The spatial paper renders the same document's stroke records as
`ViroPolyline`s, and a ray on the paper is injected into the engine as
synthesised `PointerEvent`s. One document, one engine, two presentations.

**C — Companion mode.** On handheld AR the app's React Native views composite
over the AR scene, so the real 2D board can sit on top of it. Not an answer on a
headset, where there is no 2D layer to composite into.

## Decision

**B.** A is the better rendering if it exists, and it does not exist; building it
means new native code on two platforms before a single stroke appears. B reaches
a working spatial board with no native code at all, and it does not fork the
document — which is the property that actually matters, because a second
drawing implementation would be a second definition of what a child's work is.

A remains the escalation path, and the trigger is specific: if `ViroPolyline`
cannot render legible handwriting at 1.5 m on device — joins, thickness,
vertex count — B is not shippable and the texture bridge is what replaces it.

C is not used. Handheld AR is not a target of this change.

## What B forced

**This repo hosts the Quickdraw WebView itself.** `packages/ui/whiteboard-board.native.tsx`
no longer renders the vendor's `<Quickdraw>` component; it builds the same page
from the vendor's exported `BOARD_HTML` + `createBridge`, with a WebView
reference this side owns. Two facts in the installed package force it, both
re-checkable:

1. `node_modules/@quickdrawjs/react-native/src/webview-entry.js` — the page's
   `handlers` map has no input verb at all (`init`, `loadSnapshot`, `applyDiff`,
   `setTheme`, `setReadonly`, `setGrid`, `setTool`, `setStyle`, `undo`, `redo`,
   `clear`, `fitContent`, `getSnapshot`, `exportPng`), and `window.__qdDispatch`
   silently drops any message type it does not know. The page also keeps its
   `board` in module scope, never on `window`, so injected script cannot reach
   `board.editor` either.
2. `src/index.js` sets `ref: webRef` **before** it spreads `...webviewProps`,
   and its `useImperativeHandle` exposes a fixed verb list with no `post` or
   `inject`. Passing a ref through `webviewProps` therefore does not add a second
   ref — it replaces the vendor's own and kills the entire bridge.

**Input goes in as real pointer events.** `src/board-html.generated.js` binds
`pointerdown` on its container, carries `pointerId`/`setPointerCapture`, and
never reads `isTrusted`. A synthesised gesture at `#board` is indistinguishable
to it from a finger, and the engine performs its own client→page mapping — which
keeps that mapping in exactly one place.

**The engine's camera is pinned.** The page's `init` handler calls
`fitContent()` whenever it is handed a snapshot, which leaves the camera at a
zoom and offset that depend on what the child had already drawn. The spatial
board renders the document's page coordinates while the injected pointer is in
client coordinates, so a fitted camera makes those two disagree by whatever
factor the fit chose — ink lands near the ray instead of under it. The board is
restored through `loadSnapshot(fit: false)` instead, which the session
controller already does the moment the engine reports `mounted`. Same bytes,
same order, camera untouched.

**Ownership of the document moved up.** `TutorWorkbench` created the `BoardDoc`,
which was correct while one component was the only thing that ever showed a
board. A second route breaks it. `packages/app/features/tutor/board-session.ts`
now owns the document, the restore, the server merge, the late-joiner order and
the two debounce windows, keyed by session — and deliberately survives reaching
zero holders, because the 2D tree unmounts before the XR tree mounts and a
document thrown away in that gap is a child arriving in the headset to blank
paper.

**The scene cannot close over state.** `ViroARSceneNavigator` captures
`initialScene` in its constructor (`state.sceneDictionary[tag].sceneClass`) and
renders it as a component type from then on; a scene function rebuilt by a later
render is never picked up, and neither is `passProps`. The scene therefore reads
everything it reacts to from `useXrSession` and `useTutorStore`. A scene closed
over the board's records would have drawn the first render of the session
forever.

## The dependency

`@reactvision/react-viro` is a **`link:` to a local checkout** at
`/Users/mikevocalz/viro` — version **3.0.0**, an unpublished fork carrying PICO
work. It is declared in `apps/mobile/package.json`, `packages/ui/package.json`
and `packages/app/package.json` as `link:../../../viro`, and **not** in the pnpm
catalog: pnpm resolves `link:` relative to the package that declares it, and a
catalog entry is shared by importers at different depths.

What that costs, stated plainly: the specifier is relative but the target is
outside the repo, so a fresh clone on another machine cannot install until that
checkout exists as a sibling of `MoyoLearn/`. CI does not have it. npm's
published `latest` is 2.58.1; 3.0.0 is not on the registry.

Every Viro component and prop used here was verified against that checkout's
`dist/components/*.d.ts`, not against documentation.

## Consequences

- One board, one document, one voice, two presentations. Entering the headset
  starts no lesson, replays no opening and opens no second audio stream.
- The 2D native board's host changed. It is the same engine, the same page and
  the same protocol, but it is no longer the vendor's component — so the
  existing 2D board needs device re-verification, not only the new screen.
- `packages/ui/xr/stroke-of.ts` reads `ShapeRecord.props`, which
  `@quickdrawjs/core` types as `Record<string, any>`. The freehand geometry key
  (`pts`, an array of `[dx, dy, pressure]` relative to the record's origin) was
  discovered by reading the generated engine and is documented nowhere. It is
  parsed defensively and pinned by `stroke-of.test.ts`, and a vendor bump must
  re-verify it.
- The spatial board draws `draw` and `highlight` records only. Text, notes,
  arrows and images — which the web app's fuller tray can produce — are skipped.
- There is no XR on web, enforced by platform forks (`packages/ui/xr/index.web.ts`,
  `tutor-xr-entry.tsx`) rather than by convention.

## Not verified

Nothing in this change has run on a headset. The following are reasoned from
source and are **unmeasured**:

- Whether `ViroPolyline` renders legible handwriting at 1.5 m.
- Input→ink latency.
- That the pinned camera makes injected pointer coordinates and rendered ink
  coincide.
- That `onHover` is a usable continuous move stream for a drawing gesture on a
  Quest controller ray.
- Frame pacing, memory across repeated entry and exit, and the 2D screen's TTI.

None of these should be reported as working until they have been recorded on
device. The acceptance test that closes them is in the feature brief's §7.

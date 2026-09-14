# ADR-117 — The spatial whiteboard's bridge: one engine, two renderers

Status: **PROPOSED — unverified on hardware.** Date: 2026-09-13 · Decider: Mike ("A") · Author: spatial whiteboard pass

<!--
What it is: how a real, interactive whiteboard is rendered and driven inside a
ViroReact scene, given that ViroReact cannot host a React Native view — and what
that costs. Also records the local-checkout Viro dependency and everything this
change has NOT been able to measure.
SOT: packages/ui/whiteboard-board.native.tsx · packages/app/features/tutor/board-session.ts
     packages/app/features/tutor/tutor-xr-screen.native.tsx · packages/ui/xr/
     packages/app/features/tutor/xr-session.store.ts · packages/app/features/tutor/xr-capability.ts
     packages/app/features/tutor/xr-eligibility.native.ts
SOT-KEYWORDS: adr spatial whiteboard xr viro quickdraw bridge polyline pointer injection board session camera local link unverified engine ownership router push permission primer lifecycle tracking onhover drag yaw sign direct entry opening phase eligibility fork
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
zero holders.

## Who owns the engine while both routes exist

An earlier draft of this ADR justified that survival with "the 2D tree unmounts
before the XR tree mounts". **That is false**, and correcting it is the point of
this section.

**The verb is `router.push`** (`tutor-screen.tsx`, `handleOpenXr`), chosen so the
2D workspace keeps its pane state, its composer draft and its session and coming
back is a pop rather than a restore. A pushed native-stack route detaches the
screen below from the view hierarchy; it does **not** unmount the React tree. So
`TutorWorkbench` keeps running, keeps its `session.attach` subscription, and
`releaseBoardSession` is never called on the way in — holders goes 1 → 2, not
1 → 0 → 1.

**So how many engines are live is a function of width, and at the width a
headset actually reports it is two.** `tutor-screen` mounts the workbench as
`board={workPane ? workbench : undefined}`, and `hasWorkPane` is true for
`expanded` and above (≥840 dp) and false for `compact`/`medium`. Below that the
workbench lives inside `WhiteboardSheet`, which is a React Native `Modal` —
`Modal.render` returns `null` when it is not visible, so the workbench and its
`Whiteboard` are genuinely unmounted while the sheet is closed, and pressing the
spatial door does not open the sheet. Two engines at pane widths, one below.

**Decision: both hosts stay attached.** Not because two WebViews are free, but
because the document is safe for N presentations by construction and the
alternatives cost more than the thing they avoid:

- `board-session.change()` ignores every diff whose source is not `'user'`, and
  the engine page tags an applied diff `'remote'`
  (`@quickdrawjs/react-native/src/webview-entry.js`:
  `applyDiff(m) { board.editor.store.applyDiff(m.diff, 'remote') }`). The
  fan-out in `change()` therefore terminates in exactly one hop; two live
  `onChange` sources cannot loop.
- Undo reaches both engines. `board-doc`'s observer runs
  `if (!isLocal) for (const listener of listeners) listener(diff)`, and a Yjs
  `UndoManager` step carries the manager as its transaction origin rather than
  the string `'local'` — so `onRemote`, which is what `attach` subscribes with,
  fires for an undo and every attached engine is corrected.
- Suspending the 2D engine needs a verb `board-session` does not have, and the
  cheap version of it — unmounting the workbench — costs a full page reload of
  the engine on return, which is a visibly blank board at the moment a child
  comes back from the headset. That is worse than an idle WebView.
- Hoisting a single session-scoped host above both routes remains the clean
  answer if the cost is ever measured to matter. The seam is exactly one thing:
  `board-session` would have to expose the attached presentation's handle so the
  spatial screen could drive the engine the 2D tree already mounted instead of
  mounting its own. That is a change to `board-session.ts` and is not in this
  change's ownership.

**The cost is unmeasured and is stated as unmeasured.** Statically: the second
engine is one `react-native-webview` laid out at `boardSurfacePixels`
(1400 × 1960), created fresh on every entry, running alongside the first one and
the XR renderer. Nothing in this workspace has run on a headset, so its memory,
its effect on frame pacing and the page-load time it adds to entry are all
unknown. They belong to the acceptance test in the feature brief's §7, not here.

**The restore rule, per presentation.** Both are handed the whole document when
their engine reports `mounted` and stream diffs after — `attach()` does
`loadSnapshot(doc.snapshot())` and then subscribes `onRemote`, which is the
vendor's late-joiner order and the reason a diff never reaches an engine with no
editor. They differ in one deliberate way before that point:

- **`tutor-workbench`** also passes `snapshot={session.initialSnapshot}` to
  `Whiteboard`, so the pane paints the child's working on its first frame rather
  than flashing blank paper. That routes through the page's `init`, which calls
  `fitContent()` — harmless here, because the child looks at the engine's own
  canvas and the camera is what they see.
- **`tutor-xr`** deliberately passes **no** `snapshot` prop. Its engine is parked
  off-screen at zero opacity, so a blank first frame is invisible, and skipping
  `init`-with-snapshot is what guarantees `fitContent()` never runs on it. The
  spatial paper renders document page coordinates while the injected pointer is
  in client coordinates; a fitted camera makes those two disagree, which is the
  bug the pinned-camera section above exists to prevent. Only `attach`'s
  `loadSnapshot(fit: false)` ever loads this engine.

Two further things this correction fixed in the spatial screen:

- It held `acquireBoardSession(key)` from its first render and never re-acquired.
  A child who presses Ask in the headset creates the server session, `sessionId`
  goes from `null` to an id, and `boardSessionKey` changes — the 2D workbench
  re-acquires on that, the spatial screen did not, and the two presentations
  would have been writing into two different documents. It now runs the same
  `heldKey` re-acquire the workbench does.
- The hold was released from an effect that listed `sessionId` as a dependency,
  so the holder count fell on a change that was not a departure, and reaching
  zero writes.

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
- **The lifecycle is driven, and the camera is asked for before it is taken.**
  `xr-session.store`'s phases were declared and only two of them were ever set.
  They now run as a table of legal transitions —
  checking → permission-required → preparing → ready → interrupted → exiting,
  plus unsupported — and every move is made by a fact: `spatialEligibility`
  reading this binary and this device, the runtime's own `checkPermissions` /
  `requestRequiredPermissions` result, the engine reporting it has an editor, and
  `ViroARScene.onTrackingUpdated`. Nothing advances on a timer or a render.
  Consequences worth stating:
  - The permission primer is a **flat 2D panel**, not an in-scene card. A
    consent question asked from inside the immersive scene it grants consent for
    is already answered. Its "Not now" raises no system dialog, records no
    refusal, and pops back to the 2D board; pressing the door again shows the
    primer again.
  - **The renderer is no longer withheld until the primer has been answered** —
    see "The door opens onto the board" below. It is mounted before the
    permission round trip lands, and an ungranted camera demotes the lifecycle
    back out to the primer.
  - `unsupported` therefore also renders in 2D, for all three reasons. The
    in-scene unsupported card in `XrPanel` is reachable only from a transition to
    `unsupported` *after* the scene is mounted, which nothing produces today —
    every way of reaching it is a way in which the scene must not be mounted.
  - `interrupted` keeps the board drawn and speaks through the companion panel's
    assurance line, which is the only slot in the composition that can carry it:
    the panel's own wait card belongs to `checking` and `preparing`, and a card
    over an interrupted board would cover the work it is reassuring the child
    about.
  - Tracking returning to normal promotes `interrupted` back to `ready` and
    nothing else. `preparing → ready` is the engine's move, because a board is
    drawable when there is an engine behind it, not when the room is in focus.
- **The route is guarded by being declared.** `Stack.Protected` collects the
  `Stack.Screen` *names* beneath a falsy guard and removes those from the
  navigator (`useSortedScreens`); it does not guard a directory. `tutor-xr.tsx`
  sat in `(learner)/` undeclared, so it was protected by nothing — a child's
  board reachable by deep link under any role and left in history when the role
  flipped. `(learner)/_layout.tsx` now declares it.

## Answered since this ADR was written

**`onHover` is not a move stream. Answered in the negative, from source.** This
was listed below as unverified; it is now closed, and closed the wrong way for
the design that depended on it. `onHover` is an enter/exit event carrying a
boolean, and the renderer emits it only when the hovered node *changes* — while a
ray rests on one node `VROInputControllerBase` returns without firing. A stroke
built on it got its `begin`, then silence, then an `end` at the same point: the
child drew and no line appeared. The belief could not be repaired either, because
the renderer freezes the hit result for the whole of a drag, which is the only
other thing a pointer-down does.

What replaced it (commit `6e5707b`) is a transparent quad over the paper with
`dragType="FixedToPlane"` and `dragPlane` set to the paper's own plane: the
renderer slides it under the ray and reports every step through `onDrag`. It is a
**sampled** stream, not a continuous one — the renderer drops a move shorter than
`ON_DRAG_DISTANCE_THRESHOLD`, one centimetre of world travel, roughly fifty
samples across a 0.55 m board — and that floor lives in the native renderer with
no prop to raise it. So a stroke arrives resampled rather than pixel-exact. It is
a separate quad because a drag moves what it drags; run on the paper, a child's
homework would slide across the room while they wrote on it.

**The door opens onto the board, not onto a screen about the board.** The
lifecycle used to start at `checking` on every device, run `spatialEligibility`
in an effect, and only then mount the navigator — so the first frame of the
spatial route was always flat, on hardware that had already qualified. Nothing
in that check is asynchronous: `hasOpenXRSupport`, `isQuest` and `isPico` are
module-level constants over `NativeModules` and `Platform.constants`. So the
opening phase is now COMPUTED (`openingPhase` in `xr-session.store`): eligible
opens at `preparing`, which is the phase that mounts `ViroXRSceneNavigator`, and
the scene is up on the first render.

The read lives in a platform fork (`xr-eligibility.ts` / `.native.ts`) rather
than in the store, because the store is imported by the 2D tutor screen on every
device — including web. The `.native` fork imports `ViroPlatform` by module path
rather than the package root for the same reason in the other direction: that
module pulls in `react-native` and nothing else, so a phone's bundle does not
gain the renderer at homework time.

What it costs is the one fact that cannot be had synchronously. `checkPermissions`
is a round trip, so it now resolves under a mounted scene: granted is a no-op
(`preparing → preparing` is not a move), and not-granted demotes
`preparing → permission-required`, the one backwards edge in the transition
table. An ineligible device still opens at `checking` — `unsupported` carries a
reason a child reads and leads nowhere but `exiting`, so it stays the screen's to
set rather than a module's at import time.

**A dormant sign error in `toSurfaceLocal` (`packages/ui/xr/XrPanel.native.tsx`).**
Recorded because it is invisible today and will not be invisible the moment the
composition is allowed to yaw. The function sets `yaw = -yawDeg` and then
computes `x = dx·cos(yaw) − dz·sin(yaw)`, which expands to
**`dx·cosθ + dz·sinθ`**. The inverse of ViroCore's yaw about Y is
**`dx·cosθ − dz·sinθ`**; the negation is applied twice. It is harmless only
because every placement this feature produces has `rotation: [0, 0, 0]`, so
`sinθ` is zero and both expressions agree — `recenter` restores that same
rotation and nothing else writes one. The failure it is waiting for is the worst
shape there is in a headset: ink that lands somewhere plausible and slightly
wrong, reading as a tracking fault. Anything that gives the board a yaw must fix
the sign and pin it with a test in the same change.

## Not verified

Nothing in this change has run on a headset. The following are reasoned from
source and are **unmeasured**:

- Whether `ViroPolyline` renders legible handwriting at 1.5 m.
- Input→ink latency, and whether the `onDrag` sampling floor above is coarse
  enough to be visible in a child's handwriting.
- That the pinned camera makes injected pointer coordinates and rendered ink
  coincide.
- Frame pacing, memory across repeated entry and exit, and the 2D screen's TTI.
- The cost of two live engines at pane widths — see the engine-ownership section.
- The permission sequence end to end. `requestRequiredPermissions` and
  `checkPermissions` are called against the installed fork's signatures rather
  than against documentation, and the lifecycle they drive is unit-reachable, but
  no headset has actually shown the primer or returned a result.
- That the `preparing → permission-required` demotion tears `ViroXRSceneNavigator`
  down cleanly. It is the only path that unmounts the navigator while the route
  stays on screen — `exiting` deliberately keeps it mounted for the pop — and it
  is reached only by a headset whose camera is not already granted.
- That `hasOpenXRSupport && (isQuest || isPico)` is the right eligibility pair.
  All three are read from `ViroPlatform` directly
  (`packages/app/features/tutor/xr-eligibility.native.ts`), because the package
  root re-exports only the first two — an `isQuest`-only gate read a PICO 4
  Ultra as `device-not-eligible`.

None of these should be reported as working until they have been recorded on
device. The acceptance test that closes them is in the feature brief's §7.

# Spatial whiteboard — the implementation handoff

<!--
What it is: the numbers an engineer builds against — the composition in metres
with every centre derived, `XrPanel`'s props and what each one actually does,
the four layered surfaces and their required Z order, every interaction state
with its trigger, what `layoutBoard`'s `fits: false` obliges the caller to draw,
the edge cases the code already answers, and the order a child's aim travels in
on a surface with no focus ring.
Why it exists: `02-design-plan.md` holds material and `03-design-system.md`
holds the pattern's reasoning. Neither is a build sheet. Every number below is
DERIVED from `packages/ui/xr/spatial-tokens.ts` and `board-layout.ts`, and the
derivation is shown beside it — so a token that moves moves this file by
arithmetic rather than by memory.
SOT: packages/ui/xr/spatial-tokens.ts · packages/ui/xr/board-layout.ts ·
     packages/ui/xr/XrPanel.types.ts · packages/ui/xr/XrPanel.native.tsx ·
     packages/app/features/tutor/tutor-xr-screen.native.tsx
SOT-KEYWORDS: xr handoff implementation metres geometry panel props states
              constrained layout fits false edge cases reach order spatial board
-->

Status: draft, unmeasured on device · Date: 2026-09-13 · Branch: `feat/spatial-whiteboard-xr`

**Derived from the working tree at 2026-09-13 14:25 EDT** — `6e5707b` plus the
uncommitted token and rail work then in progress. Every evaluated figure below
was produced by importing `spatial-tokens.ts` and running the arithmetic, not by
reading a literal. Where a value is now a function of the age band, the band is
named.

## §1 What ships, in one paragraph

One `ViroARScene` inside a `ViroXRSceneNavigator`, carrying one `XrPanel`. The
panel holds a 5:7 portrait paper at 1.5 m, a control rail on its left, the
question above it, Recenter and Leave below it, and the tutor conversation on a
yawed panel to its right. Off-screen, at `boardSurfacePixels`, the Quickdraw
engine keeps running in a WebView — still the only thing that decides what a
stroke is. A ray on the paper becomes a pointer in that engine; the engine's
document becomes `ViroPolyline`s on the paper. Mobile and headset only. There is
no Viro web experience for the tutor and there will not be one.

## §2 The composition, derived

Metres throughout. The child's head is `[0, 0, 0]` facing `−Z`
(`XrPanel.types.ts:15`).

### §2.1 The tokens the arithmetic starts from

`spatial-tokens.ts`:

```
spatialSpacing        xs 0.025 · sm 0.05 · md 0.1 · lg 0.2 · xl 0.35
spatialDistance.board 1.5
spatialType.body      0.04 – 0.055          → spatialFontSize.body  = 5 pt
                                            → spatialTextHeight.body = 0.05 m
spatialTarget         minAngleDeg 4 · handMultiplier 1.25
spatialTarget.bandMultiplier   young 1.636 · child 1.273 · teen 1.091 · adult 1
```

`bandMultiplier` is read off `targets` in `packages/theme/tokens.ts` as each
band's ratio to `adult` — `72/44`, `56/44`, `48/44`, `1` — so the spatial scale
and the dp scale cannot drift apart.

`spatialFontSize` converts a glyph height to a `ViroText` point size through the
renderer's own `kTextPointToWorldScale = 0.01`. Nothing in this feature may set
a bare `fontSize` any more; the step name is the API.

`boardComposition`, with `DESIGN_KEY_BOX = railWidthFor(1.5, false, 'young')`:

| Token | Expression | Evaluates to |
| --- | --- | --- |
| `anchor` | `[0, −0.1, −spatialDistance.board]` | `[0, −0.1, −1.5]` |
| `boardWidth` | picked — 5:7 paper is in no design system | 0.55 |
| `railWidth` | `DESIGN_KEY_BOX` | **0.22143** |
| `railGap` | `spatialSpacing.sm` | 0.05 |
| `chatWidth` | picked | 0.45 |
| `chatGap` | `spatialSpacing.md` | 0.1 |
| `chatYawDeg` | picked | −40 |
| `topOrnamentHeight` | `spatialTextHeight.body × 2 + spatialSpacing.xs × 2` | **0.15** |
| `bottomOrnamentHeight` | `DESIGN_KEY_BOX` | **0.22143** |
| `ornamentGap` | `spatialSpacing.sm` | 0.05 |

The design case is deliberately the K–2 band on controllers. A learner surface
inherits the floor the product already promises a six-year-old; hands are *not*
in the static case, because sizing every session for a pinch would push the
composition past the comfort cone for children who never use one.

### §2.2 Every centre and extent

| Thing | Derivation | Value |
| --- | --- | --- |
| Paper width | `boardWidth` | 0.55 |
| Paper height | `width × aspect.h / aspect.w` (`XrPanel.native.tsx:116`) | **0.77** |
| Frame width | `width + spatialSpacing.sm` (`:362`) | 0.60 |
| Frame height | `height + spatialSpacing.sm` (`:363`) | 0.82 |
| Frame overhang, per side | `(0.60 − 0.55) / 2` | **0.025** |
| Rail centre X | `−(width/2 + railGap + railWidth/2)` | **−0.43571** |
| Rail outer edge X | `railCenterX − railWidth/2` | −0.54643 |
| Question line centre Y | `+(height/2 + ornamentGap + topOrnamentHeight/2)` | **+0.51** |
| Placement row centre Y | `−(height/2 + ornamentGap + bottomOrnamentHeight/2)` | **−0.54571** |
| Chat centre X | `+(width/2 + chatGap + chatWidth/2)` | **+0.6** |
| Chat centre Z | `boardComposition.chatGap × 2` (`XrPanel.native.tsx:454`) | **+0.2** |
| Chat yaw | token | −40° |

`layoutBoard()` (`board-layout.ts`) is the shared arithmetic and is asserted in
`board-layout.test.ts` with no renderer attached. The caller supplies one unit —
metres in space, dp in a test — and gets centres and extents back in that unit.

### §2.3 The same numbers as angles at 1.5 m

`θ = 2·atan(extent / 2d)`. A metre is not a size in a headset; an angle is.

| Thing | Metres | Degrees at 1.5 m |
| --- | --- | --- |
| Paper width | 0.55 | 20.78° |
| Paper height | 0.77 | 28.79° |
| Rail width | 0.22143 | 8.44° |
| Rail outer edge, off centre | 0.54643 | 20.02° (half-angle) |
| Top ornament, upper edge | 0.585 | 21.34° (half-angle) |
| Bottom ornament, lower edge | 0.65643 | 23.62° (half-angle) |
| Frame overhang, per side | 0.025 | 0.95° |
| Hover ring width | 0.004 | 0.15° |

The board plus its ornaments now spans about **45° vertically** — inside the
±30° cone in each direction, but only just, and a child reading the question
line looks up 21° from centre while the placement row is 24° down.

The companion's far edge is the one that leaves the cone. Its right edge at
local `[0.225, 0, 0]`, yawed −40° about Y and offset to `[0.6, 0, +0.2]` on an
anchor at `z = −1.5`, lands at world `[0.772, 0, −1.155]` — **33.8° off centre**.
`03-design-system.md` §2 records 32.4° from a slightly different construction;
either figure is outside the cone the board was sized to stay inside.

### §2.4 Depth, and its required order

Five Z offsets, five literals, no `spatialDepth` token. The magnitudes are
tuneable; **the order is not**.

| Layer | Z | Where | Why it must stay here |
| --- | --- | --- | --- |
| Frame | −0.005 | `XrPanel.native.tsx:361` | behind the paper, so the grab edge never covers writing |
| Paper | 0 | `:313` | — |
| Ink | +0.001 | `XrBoardInk.native.tsx` `pageToSurface` | in front of the paper or it Z-fights |
| Pointer quad | +0.002 | `:80, 337` | in front of the ink, so a ray meets the input surface before a stroke |
| Wait / unsupported | +0.010 | `:385, 401` | in front of everything, and the state union keeps it off a drawable board |
| Companion | +0.200 | `:454` | off the board's plane; two coplanar panels at this distance read as one wide panel with a seam |

A `spatialDepth` block, if it is added, has to carry the order as well as the
values: `hairline 0.001 < pointer 0.002`, both in front of the paper, frame
behind it, overlay in front of all four, panel furthest forward.

### §2.5 Hit targets

```
minHitSize(d, hands, band) = 2·d·tan(4°/2) · (hands ? 1.25 : 1) · bandMultiplier[band]
railWidthFor(d, hands, band) = minHitSize(…) + spatialSpacing.xs × 2
```

**`minHitSize` is a floor.** A caller that takes `Math.min` of it and something
else has not enforced it — it has replaced it, which is the bug the whole feature
shipped with.

At the board's 1.5 m, controllers:

| Band | `minHitSize` | Degrees | Hands | `railWidthFor` |
| --- | --- | --- | --- | --- |
| `young` | 0.17143 | 6.54° | 0.21429 | 0.22143 |
| `child` | 0.13333 | 5.09° | 0.16667 | 0.18333 |
| `teen` | 0.11429 | 4.36° | 0.14286 | 0.16429 |
| `adult` | 0.10476 | 4.00° | 0.13095 | 0.15476 |

Every control sizes from this and nothing multiplies it down: a rail key, an ink
swatch, Clear, and a placement key are all one `minHitSize` on their short edge.
The placement key is `size × 1.6` wide because it carries a word — wider than the
floor is free, shorter than it is not, and a target is the smaller of its two
edges.

`handsPrimary` is hardcoded `false` (`tutor-xr-screen.native.tsx`), with the
reason written there: the smaller multiplier is the one that must not be assumed,
so hands get the larger target only once the runtime reports hands.

### §2.6 The rail does not fit its own keys, and the gap widened

Rail height is the board height, 0.77, less `spatialSpacing.xs` of padding on
each side — **0.72 m of content box**. At the `young` band its content is:

```
closed:  7 keys × 0.17143  +  separator 0.1 (md)  +  Clear 0.17143  =  1.4714
open:    1.4714  +  7 swatches × 0.17143                             =  2.6714
```

Seven keys closed because Pen, Mark, Erase, Ink, Undo, Redo and Ask all render
at `key`. That is **2.0× the box closed and 3.7× open**, and it got worse rather
than better when the targets were fixed — correctly, because the targets were
the thing that was wrong. Yoga's default `flexShrink` is 0, so the expected
behaviour is overflow past the rail slab rather than compression: Clear drawn
below the rail's own bottom edge, and the open ink column well past it.

That is arithmetic, not an observation. What Viro's flex implementation actually
does with an over-constrained column is item 9 on §9's list. Either way the
composition has no room for the control set it declares, and no target-size
change can create it — the rail needs a second column, a scroll, or fewer keys.

The placement row has the same shape of problem, smaller: two keys at
`0.17143 × 1.6 = 0.27429` each plus `spatialSpacing.xs × 2` of padding is
**0.59857** inside a `width` of 0.55.

## §3 `XrPanel`'s props

From `packages/ui/xr/XrPanel.types.ts:98-129`. What each one does *today* is the
column that matters — three of them read differently from how they behave.

| Prop | Type | Required | Behaviour today |
| --- | --- | --- | --- |
| `width` | `number` | yes | Paper width in metres. Height is derived, never passed. |
| `aspect` | `{ w, h }` | yes | `{ w: 5, h: 7 }` everywhere. The one line the feature's promise rests on. |
| `children` | `ReactNode` | no | Drawn on the surface inside an `ignoreEventHandling` node, which recurses — so no stroke can catch a ray. |
| `ornaments.leading` | `XrOrnament` | no | Placed at `−(width/2 + gap + extent/2)` on X. |
| `ornaments.top` | `XrOrnament` | no | Placed at `+(height/2 + gap + extent/2)` on Y. |
| `ornaments.bottom` | `XrOrnament` | no | Placed at `−(height/2 + gap + extent/2)` on Y. |
| `companion` | `XrCompanion` | no | Placed at `±(width/2 + gap + width/2)` on X and `chatGap × 2` on Z, yawed by `yawDeg`. |
| `placement` | `XrPlacement` | yes | `{ position, rotation, scale }`. `scale` is one number, so a gesture cannot put the paper off 5:7. |
| `moveHandle` | `'frame' \| 'bottomOrnament' \| 'none'` | no, defaults `'frame'` | **Only `'frame'` is implemented.** `'bottomOrnament'` silently behaves as `'none'` (`XrPanel.native.tsx:365-374`). Implement it or narrow the type. |
| `onPlacementChange` | `(next) => void` | no | Fires from the frame's `onDrag`. Position only; rotation and scale pass through unchanged. |
| `onSurfaceInput` | `(sample) => void` | no | The pointer stream. `u`/`v` in 0–1 from the surface's top-left, already transformed. |
| `state` | `XrPanelState` | yes | §4. |
| `materials` | `{ surface?, frame? }` | no | Falls back to `XR_MATERIAL.paper` / `.frame`. |
| `handsPrimary` | `boolean` | no | **Declared and never destructured.** The panel sizes nothing itself, so it has no effect. |
| `reducedMotion` | `boolean` | no | **Declared and never destructured.** Nothing in `packages/ui/xr` animates yet, so it has nothing to switch off — but `02-design-plan.md` §5's arrival is specified to read it, and this prop is the carrier. |

`XrOrnament` is `{ node, extent, gap }`. `extent` is metres across X for a
leading ornament and across Y for top and bottom: one field for three slots,
because the panel already knows which axis it is placing on.

There is no `trailing` slot, on purpose. The right-hand side belongs to the
companion, and controls on both sides of a surface a child writes on with a ray
is a composition where every overshoot lands on a control.

### §3.1 The pointer contract

`XrSurfaceInput` is `{ phase, u, v, source, pressure? }`. **The transform happens
exactly once.** The panel is the only thing that knows its own world transform,
so it is the only thing that converts a world hit into `(u, v)`. A caller
multiplies by a pixel size and stops:

```ts
active.engine?.injectPointer({
  phase: sample.phase,
  x: sample.u * boardSurfacePixels.width,
  y: sample.v * boardSurfacePixels.height,
  pressure: sample.pressure,
});
```

A caller that transforms again gets ink trailing the ray by a fraction of the
paper, which reads as a tracking fault and is two matrices.

`pressure` is typed and never set — `send()` (`XrPanel.native.tsx:172-177`) does
not pass one, and `stroke-of.ts` drops the third element of a vendor point on the
way back. `04-copy.md` §5.1 carries what a child sees because of it.

## §4 The four layered surfaces

Each answers exactly one question. This is what to preserve when anything about
input changes.

| Layer | Answers | How |
| --- | --- | --- |
| Frame | "move my paper" | `dragType="FixedDistance"` + `onDrag` → `onPlacementChange` |
| Paper | nothing | `ignoreEventHandling` |
| Ink | nothing | wrapped in an `ignoreEventHandling` node, which recurses |
| Pointer quad | "draw" | `dragType="FixedToPlane"` + `onClickState` + `onDrag` → `onSurfaceInput` |

**Drawing is a drag, and `onHover` cannot replace it.** `onHover` is an
enter/exit event the renderer emits only when the hovered node *changes*, so a
stroke got its `begin`, then silence, then an `end` at the same point. The move
stream is a transparent quad at `POINTER_STANDOFF` = 0.002 m with `dragPlane` set
to the paper's own plane by `surface-drag.ts`; the renderer slides it under the
ray and reports every step through `onDrag`.

Three consequences that belong to the pattern rather than to one component:

- **A drag moves what it drags.** The quad is rested with `setNativeProps` on
  every release (`:208-216`) or its displacement accumulates across a session. It
  goes straight at the native node because React still believes the quad is where
  it last rendered it.
- **The hit result is frozen for the duration of a drag.** A stroke's `end` is
  reported at the last *move* sample, never at the position `CLICK_UP` carries —
  which is still the `CLICK_DOWN` position (`:259-265`).
- **The move stream is sampled, not continuous.** The renderer drops a move under
  `ON_DRAG_DISTANCE_THRESHOLD`, one centimetre of world travel — about fifty
  samples across a 0.55 m board. No prop raises it.

## §5 Interaction states

### §5.1 `XrPanelState`

| State | Surface | Ornaments & companion | Set by (as committed at `6e5707b`) |
| --- | --- | --- | --- |
| `checking` | not drawn; spinner + "Getting your board ready" at `z = 0.01` | drawn | store initial value |
| `preparing` | not drawn; spinner + "Bringing your working over" | drawn | **nothing** |
| `ready` | drawn, with `children` | drawn | `TutorXrScreen` once the engine reports ready |
| `interrupted` | drawn, with `children` | drawn | **nothing** |
| `unsupported` | not drawn; one-sentence card at `z = 0.01` | drawn | **nothing calls `unsupported()`** |
| `exiting` | not drawn, and **no branch renders anything** | drawn | **nothing** |

`drawable = state === 'ready' || state === 'interrupted'` (`:292`) is the one
predicate that gates input.

`exiting` is the state to fix first if any of the four unreachable ones is wired:
no branch in `XrPanel.native.tsx` mentions it, so setting it leaves ornaments
floating around an absent paper. `interrupted` is the recoverable one — it keeps
the board on screen when tracking blinks — and the distinction between it and
`unsupported` is the reason the union has six members.

Re-entry resets to `checking`, not `ready`, so the capability and permission path
runs again. A permission revoked in system settings while the child was away is
the case that motivates it.

### §5.2 A rail key

Four redundant signals are specified (`02-design-plan.md` §4); three are wired.

| Signal | Wired | Value |
| --- | --- | --- |
| Fill | yes | `moyoKey` → `moyoKeySelected` → `moyoKeyPressed` → `moyoKeyDisabled` |
| Label colour | yes | `XR_COLOR.onKey` at rest, `XR_COLOR.onPanelMuted` when disabled |
| Hover ring | yes | `borderWidth: 0.004`, `borderColor: XR_COLOR.focus`, only while hovered and not disabled |
| Position | yes | tools keep the 2D tray's order |

Two of the three wired signals currently carry no visible difference, because
`XR_MATERIAL.key`, `XR_MATERIAL.keySelected` and `XR_COLOR.focus` all resolve to
`palette.ink[100]`. `06-a11y.md` §2 has the measured ratios and the fix.

### §5.3 A stroke

```
CLICK_DOWN with a non-finite position    → dropped (the renderer's empty payload)
CLICK_DOWN with a stroke already open    → cancel the open one, then begin
CLICK_DOWN                                → begin at sampleOf(position)
onDrag                                    → move, unless overshoot > 0.025 m
onDrag with overshoot > POINTER_SLACK     → cancel; the stroke is closed
CLICK_UP                                  → rest the quad, then end at the LAST MOVE
state leaves drawable mid-stroke          → cancel (:294-303)
```

`POINTER_SLACK` is one `spatialSpacing.xs`. A fast stroke that overshoots the
edge by a fingertip is a child still writing and is clamped back onto the paper;
past that the aim has left the board, and the stroke is cancelled rather than
committed — a stroke whose end the child never chose is worse than a missing one.

## §6 What `fits: false` obliges the caller to draw

`layoutBoard` has one throw and two answers, and they are different kinds of
thing.

**`RangeError`, thrown.** Non-finite input only. A non-finite length would
propagate into a transform and put ink somewhere unrelated to the input that drew
it, so it throws rather than returning a shape the caller would render.

**`{ fits: false, miss }`, returned.** Two reasons, and the caller has to be able
to say which:

| `miss` | Condition | What it means |
| --- | --- | --- |
| `'rail-below-target'` | `R < minRail` | This room cannot hold a rail wide enough for a reachable key at this distance and this band |
| `'no-room'` | `widthBudget <= 0 \|\| H <= 0` | There is no space left for the paper after the rail, the gaps and the chat |

`minRail` is `railWidthFor(distanceM, handsPrimary, band)` **and nothing else**.
It used to arrive as `Math.min(railWidth, minHitSize(…))`, which is `minRail ≤ R`
by construction — a floor that cannot be crossed is not a floor, and it is why
the guard had never run.

**What the caller draws.** Both misses are states, not errors:

- Render the board and the rail; drop the companion. The conversation is
  readable on the 2D screen the child came from; the paper is not.
- Never scale a control below `minHitSize(distanceM, handsPrimary, band)`.
  Shrinking is precisely the failure the miss exists to report.
- Keep Leave drawn. A constrained state a child cannot leave is a trap.
  `XrPlacementControls` renders on every state where ornaments render, and
  `onExitViro` on the navigator runs the same handler, so there are two ways out
  and neither depends on the board being healthy.
- Say which miss it was, in the child's terms. "Your headset needs a bit more
  room" and "the controls won't fit here" are different sentences with different
  next moves, which is the whole reason `BoardLayoutMiss` is a union.

## §7 Edge cases the code already answers

| Case | Answer | Where |
| --- | --- | --- |
| Press with no hit position | Dropped coordinate by coordinate — `[].every()` is true, so the check is written out | `XrPanel.native.tsx:229-235` |
| Second press with a stroke open | The open stroke is cancelled first, then the new one begins | `:237-240` |
| Ray runs off the paper mid-stroke | Clamped up to 0.025 m, cancelled past it | `:281-285` |
| `CLICK_UP` carries a stale position | End is reported at the last move, never at the event's own position | `:259-265` |
| Drag displacement accumulating | The quad is rested on every release, including a cancelled stroke's | `:208-216, 255-256` |
| Board leaves `drawable` mid-stroke | `cancel`, not `end` | `:294-303` |
| The engine's page not up yet | `injectPointer` drops rather than queues — a stroke replayed a second late lands under a hand that has moved on | `whiteboard-board.native.tsx:348-350` |
| The engine unmounting mid-stroke | The pending frame is cancelled, then flushed, so the page still gets the terminal sample | `whiteboard-board.native.tsx:243-249` |
| Pressure of exactly 0 | `?? null`, not `\|\| null` — a reported 0 is a reading | `whiteboard-board.native.tsx:354-356` |
| Zero-length restore | Skipped, so an empty board does not wake the observer | `board-doc.ts:204` |
| A vendor record that is not a stroke | `strokeOf` returns `null`; the record is skipped rather than guessed at | `stroke-of.ts:47-69` |
| The 2D tree unmounting before the XR tree mounts | The session registry survives zero holders; only `disposeBoardSession` destroys | `board-session.ts:239-244` |
| Two presses on the entry pill | `entering` gates the second — two scenes is two audio owners | `xr-session.store.ts`, `XrBoardButton.tsx:65` |
| A device with no XR runtime | `canOpenSpatialBoard()` fails closed and the pill is not rendered at all | `xr-capability.ts` |
| A web bundle reaching the renderer | `index.web.ts` + `unsupported.web.tsx` render nothing, and `web-condition.test.ts` walks the resolved graph | `packages/ui/xr/` |

## §8 Reach order

**There is no focus order, because there is no focus.** `ViroText` and
`ViroFlexView` expose no accessibility role or label in the installed package, so
nothing in the scene is announced and nothing can be tabbed to. Every affordance
is a ray landing on a quad. What follows is the order a child's aim travels in,
which is the only ordering this medium has — and it is why §2.5's target sizes
and `06-a11y.md`'s contrast carry more weight here than they do on glass.

**Down the rail, top to bottom:**

```
Pen · Mark · Erase · Ink · Undo · Redo · Ask · [0.1 m gap] · Clear
```

The gap before Clear is the affordance: a ray sliding down the rail stops at
Undo. There is no confirmation dialog, for the same reason the 2D tray has none —
the engine clears in one undoable step and Undo is on the rail above. The
separator is one `md` rather than one `sm` because harder-to-hit-by-accident is
*separation*, not a smaller target: Clear is a full-size key, since a control a
child misses twice is a control they hit on the third try anyway.

That argument holds only while Undo is actually on screen, which makes the gap
and §2.6's overflow the same problem.

**Around the paper:**

```
question (above, read-only) → paper (draw) → frame edge (move) → Recenter · Leave (below)
```

Recenter and Leave sit below the paper so a ray reaching for them never crosses
the writing surface.

**To the right:** the conversation. It is read, not operated — the only
pressable thing on it is the live turn's action row, and `tutor-xr-screen` never
passes `actions`, so nothing there answers a ray at all today.

## §9 What a device has to settle before this stops being a draft

`02-design-plan.md` §7 holds the material questions; `03-design-system.md` §9
holds the geometry ones. Three more come out of the numbers above.

9. **Does the rail overflow, compress, or clip?** §2.6 puts its content at 2.0×
   its box closed and 3.7× open. Which of the three Yoga does decides whether
   Clear is reachable at all, and no target change can fix it.
10. **Does `dragType="FixedToPlane"` report often enough for handwriting?** The
    renderer's one-centimetre threshold caps the stream at roughly fifty samples
    across the board's width. Whether that resamples a child's handwriting into
    something they recognise is the single assumption the drawing experience now
    rests on.
11. **Does `spatialFontSize.body` = 5 pt actually render at 0.05 m?** The
    conversion is the renderer's own `kTextPointToWorldScale`, read from the
    installed framework header rather than guessed — but a 5-pt `ViroText` is a
    small integer, and iOS truncates the size to an `int`. If the constant is
    wrong, every string in the feature is wrong by the same factor, and it is the
    first thing a device session should photograph.

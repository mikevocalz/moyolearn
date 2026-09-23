# Spatial whiteboard — the design system

<!--
What it is: `XrPanel` written down as a pattern rather than as a component — its
slots, its aspect lock, every value in `XrPanelState`, how placement works and
why moving the board and drawing on it are physically separate affordances —
plus the spatial token table in metres, with each number's source.
Why it exists: the panel is the only spatial layout primitive this product has,
and it will be the second one's reference whether or not anybody writes the
reference down. It also carries four contract holes that type-check cleanly and
would each ship as a silent behaviour: two states nothing ever sets, one
`moveHandle` value nothing implements, and two props the implementation never
destructures. Geometry here is a set of STARTING VALUES; `02-design-plan.md`
carries the material side of the same unmeasured list.
SOT: packages/ui/xr/XrPanel.types.ts · packages/ui/xr/XrPanel.native.tsx ·
     packages/ui/xr/spatial-tokens.ts · packages/ui/xr/board-layout.ts ·
     packages/ui/xr/xr-colors.ts · packages/theme/tokens.ts `targets`
SOT-KEYWORDS: xr design system panel pattern slot ornament companion aspect lock
              state machine placement move draw hit target angular metres token
-->

Status: draft, unmeasured on device · Date: 2026-09-13 · Branch: `feat/spatial-whiteboard-xr`

## §1 The pattern, in one shape

`XrPanel` is one anchor carrying a surface, up to three ornaments and one
companion. The surface is the only thing a child writes on; everything else hangs
beside it and travels with it. One `ViroNode` holds the whole composition, and
recentring moves that node — none of the children know it happened.

The arrangement is forced, not chosen. The installed ViroReact permits only
`ViroText`, `ViroImage`, `ViroVideo`, `ViroButton`, `ViroSpinner` and nested
`ViroFlexView`s inside a `ViroFlexView`, and respects `position`/`rotation`/
`scale` on the outermost one only. A rail nested in the board's flex tree could
not carry its own transform, so the rail is a sibling of the paper under one
anchor. Apple's ornaments are the design reference for the relationship —
controls related to a window, positioned outside its bounds, keeping their
relationship to it when it moves — and Viro has no ornament API, so the panel
enforces it as a layout rule.

Native only. `packages/ui/xr/index.web.ts` and `unsupported.web.tsx` render
nothing, and `web-condition.test.ts` walks the resolved module graph to make sure
no web bundle ever reaches `@reactvision/react-viro`. There is no Viro web
experience for the tutor and there will not be one.

## §2 The slots

| Slot | Type | Placed at | Currently holds |
| --- | --- | --- | --- |
| `children` | `ReactNode` | On the surface, drawn by the caller | `XrBoardInk` — one `ViroPolyline` per stroke record |
| `ornaments.leading` | `XrOrnament` | `−(width/2 + gap + extent/2)` on X | `XrRail` — pen, highlighter, eraser, ink, undo, redo, ask, clear |
| `ornaments.top` | `XrOrnament` | `+(height/2 + gap + extent/2)` on Y | `XrQuestionLine` — the problem, and nothing else |
| `ornaments.bottom` | `XrOrnament` | `−(height/2 + gap + extent/2)` on Y | `XrPlacementControls` — Recenter, Leave |
| `companion` | `XrCompanion` | `±(width/2 + gap + width/2)` on X, `z = chatGap × 2` | `XrChatPanel` — the same `useTutorStore` transcript |

An `XrOrnament` is `{ node, extent, gap }` and nothing else. `extent` is metres
across X for a leading ornament and across Y for top and bottom, which is why one
field serves all three: the panel already knows which axis it is placing on.

There is no `trailing` ornament slot. The right-hand side belongs to the
companion, and a second control group over there would put controls on both sides
of a surface a child is writing on with a ray.

**The companion is a panel, not a pane.** `XrCompanion` carries its own `width`,
`height`, `gap`, `yawDeg` and a `zone` of `peripheralLeft | peripheralRight`,
and the panel gives it a Z offset of `boardComposition.chatGap × 2` (0.2 m
toward the child) so it does not share the board's plane. Two user-facing panels
coplanar at this distance read as one wide panel with a seam.

That Z offset has a cost the token file's comment does not account for. At
`chatYawDeg: -40` and a centre of x = +0.6 m the companion's far edge is 32.4°
off centre once its own 0.2 m of forward offset is counted, against 28.8° if you
measure it in the board's plane. `00-research.md` §4 carries it; the fix is
either a smaller `chatWidth`, a smaller `chatGap`, or measuring the cone from the
panel's own distance rather than the board's.

`yawDeg: -40` turns a right-hand panel's normal toward the child, which is the
right direction. Facing the head squarely from that position would be about −72°.
Whether 40° is enough toe-in is a device question, not a bug.

## §3 The aspect lock

```ts
const height = (width * aspect.h) / aspect.w;
```

One line, and the feature's promise rests on it. `aspect` is `{ w: 5, h: 7 }`
everywhere, `BOARD_ASPECT` in `board-layout.ts` is the same constant, and
`boardSurfacePixels` is 1400 × 1960 — 5:7 exactly, so the page-pixel to
surface-metre mapping is a uniform scale and can never be a stretch. A child's
handwriting cannot lean.

`XrPlacement.scale` is a single number for the same reason. A three-component
scale is a scale that can put the paper off ratio, so the type does not offer
one.

`layoutBoard()` is the shared arithmetic, in a file with no renderer attached so
it can be asserted without a device. The caller supplies one unit — metres in
space, dp in a test — and gets centres and extents back in that unit. At the
current composition it returns `boardWidth: 0.55`, `boardHeight: 0.77`,
`railCenterX: -0.375`.

**Its rail-floor guard cannot fire at the only call site.** `layoutBoard` throws
`RangeError('layoutBoard: rail below usable width')` when `R < minRail`, and
`tutor-xr-screen.native.tsx` passes `minRail: Math.min(boardComposition.railWidth, minHitSize(…))`
with `R: boardComposition.railWidth`. `min(x, y) ≤ x`, so the condition is never
true. The guard is real and correct; the call site has clamped it out of
existence. Passing `minHitSize(distanceM, handsPrimary)` unclamped is what would
make it do its job — and it would then fire, because §6.

## §4 Every state in `XrPanelState`

A union rather than booleans, so "ready but also unsupported" cannot be written
down.

| State | Surface | Ornaments & companion | What the child can do | Set by |
| --- | --- | --- | --- | --- |
| `checking` | Not drawn. Spinner at `z = 0.01` plus a line of text | Drawn | Nothing on the paper | Store initial value |
| `preparing` | Not drawn. Same spinner, different line | Drawn | Nothing on the paper | Nothing — see below |
| `ready` | Drawn, with `children` | Drawn | Everything | `TutorXrScreen` once the engine reports ready |
| `interrupted` | Drawn, with `children` | Drawn | Everything. The board stays on screen | **Nothing sets it** |
| `unsupported` | Not drawn. A card at `z = 0.01` carrying one sentence | Drawn | Nothing | **Nothing calls `unsupported()`** |
| `exiting` | Not drawn, and no branch renders anything | Drawn | Nothing | **Nothing sets it** |

Four holes, and each one type-checks cleanly:

- **`preparing` is unreachable.** The store starts at `checking` and
  `TutorXrScreen` jumps straight to `ready`. The string "Bringing your working
  over" is written, reviewed and never shown.
- **`interrupted` is the recoverable state** — the one that keeps the board on
  screen when tracking blinks or a permission is pulled mid-session — and
  nothing raises it. The distinction between it and `unsupported` is the whole
  reason the union has six members.
- **`unsupported` never renders.** `xr-session.store.ts` exports
  `unsupported(reason)` and `XrUnsupportedReason` with three values, and nothing
  calls it. The actual gate is `canOpenSpatialBoard()` on `XrBoardButton`, which
  fails closed and hides the entry pill entirely. That is a reasonable gate. It
  means the three reasons have no copy and no surface (`04-copy.md` §4).
- **`exiting` renders nothing at all.** No branch in `XrPanel.native.tsx`
  mentions it, so if it were ever set the child would get ornaments floating
  around an absent paper.

**The wait states are unreadable as drawn.** During `checking` and `preparing`
the surface is not rendered, so the spinner and text sit in front of the frame
quad. The frame is `#0D0C0B` (ink[950]); the text is `XR_COLOR.onKey` = `#171614`
(ink[900]). That is **1.08:1**. `ViroSpinner type="dark"` puts a dark spinner on
the same near-black. The copy is correct and invisible. The fix is
`XR_COLOR.onPanel` (ink[50], 19.2:1 against ink[950]) and `type="light"`.

## §5 Placement, and the move-vs-draw separation

`XrPlacement` is `{ position, rotation, scale }` and lives in
`xr-session.store.ts`, not in the panel, because it has to survive the panel
remounting. A recenter forgotten when the scene reloads is a child re-placing
their homework every time tracking blinks.

**Grabbing the frame moves the composition. The surface never does.** This is the
pattern's sharpest rule and it is physical rather than modal: the frame quad sits
at `z = -0.005`, is larger than the paper on every side, and carries
`dragType="FixedDistance"` plus `onDrag`. The paper carries `ignoreEventHandling`
and answers nothing at all. A child drawing a long division and a child
repositioning their paper are doing different things, and a surface that did both
would risk dragging the homework across the room on every downstroke.

`moveHandle` is typed `'frame' | 'bottomOrnament' | 'none'` and only `'frame'` is
implemented — the `dragType` and `onDrag` wiring is inside a
`moveHandle === 'frame'` branch, so `'bottomOrnament'` silently behaves as
`'none'`. Either implement it or narrow the type.

**The frame's overhang is half what the comments claim.** `XrPanel.native.tsx`
draws the frame at `width + spatialSpacing.sm` and `height + spatialSpacing.sm`,
which is 0.05 m of total growth and therefore **0.025 m per side**. Both the
panel's own comment and `02-design-plan.md` §6 describe it as one
`spatialSpacing.sm` "wider on every side". A 0.025 m grab border at 1.5 m is
0.96° — well under anything a ray can be aimed at reliably. If the intent is one
`sm` per side, the arithmetic is `width + spatialSpacing.sm * 2`.

**The pointer transform happens exactly once.** The panel is the only thing that
knows its own world transform, so it is the only thing that converts a world hit
into `(u, v)` in 0–1 from the surface's top-left. Callers multiply by a pixel
size and stop. A caller that transforms again gets ink trailing the ray by a
fraction of the paper, which reads as a tracking fault and is two matrices.

`toSurfaceLocal` inverts yaw only, deliberately and with the reason written into
the file: ViroCore's Euler composition order is not stated in the installed
package's types, and a wrong order does not fail — it puts ink somewhere
plausible and slightly wrong. Pitch and roll are refused rather than guessed.

**A third affordance was added while this file was being written, and it changes
the input rule.** Drawing is now a drag on a fourth quad that nobody can see.
`XrPanel.native.tsx` records why: `onHover` is not a stream. It is an enter/exit
event the renderer emits only when the hovered node changes, so a stroke got its
`begin`, then silence, then an `end` at the same point, and the child drew
nothing. The move stream is a `dragType="FixedToPlane"` quad at
`POINTER_STANDOFF` = 0.002 m in front of the paper, with `dragPlane` set to the
paper's own plane by `surface-drag.ts`; the renderer slides it under the ray and
reports every step through `onDrag`.

So the board now has four layered surfaces and each answers a different question:

| Layer | Z | Answers | How |
| --- | --- | --- | --- |
| Frame | −0.005 | "move my paper" | `dragType="FixedDistance"`, `onDrag` → `onPlacementChange` |
| Paper | 0 | nothing | `ignoreEventHandling` |
| Ink | +0.001 | nothing | wrapped in an `ignoreEventHandling` node, which recurses |
| Pointer quad | +0.002 | "draw" | `dragType="FixedToPlane"`, `onClickState` + `onDrag` → `onSurfaceInput` |

Three consequences worth carrying into the pattern rather than leaving in one
component. A drag moves what it drags, so the quad is rested with
`setNativeProps` on every release or its displacement accumulates across a
session. The renderer freezes the hit result for the duration of a drag, so a
stroke's `end` is reported at the last *move* sample and never at the position
`CLICK_UP` carries. And a stroke whose aim runs more than one `spatialSpacing.xs`
(0.025 m) past the paper's edge is `cancel`led rather than ended, because a child
whose ray has reached the wall is not choosing to finish a line there.

ADR-117 lists "that `onHover` is a usable continuous move stream for a drawing
gesture on a Quest controller ray" under *Not verified*. That line is now
answered in the negative from the renderer's source, and the ADR should be
updated to say so. What replaced it is unverified in its own right: whether
`FixedToPlane` reports at a rate that makes handwriting smooth is a device
question, and it joins §9.

## §6 Hit targets: the derivation, and where it breaks

The rule the tokens state: the smallest thing that can be pointed at is an
**angle**, not a size, because a linear size is correct at exactly one distance.

```
minHitSize(d, hands) = 2 · d · tan(4° / 2) · (hands ? 1.25 : 1)
```

At the board's 1.5 m that is **0.1048 m** for a controller ray and **0.1310 m**
for hands. The hand multiplier exists because a pinch is aimed with a whole arm
and lands with more spread than a ray.

The spatial counterpart of `targets` in `packages/theme/tokens.ts` is meant to be
used the same way — the age band picks the multiplier, nothing hardcodes a size.
Neither half of that is currently true.

**The band never arrives.** `TutorXrScreen` receives `ageBand` and spends it on
`buttonSizeForBand(ageBand)` for the off-screen 2D engine. `XrRail`,
`XrPlacementControls` and `XrChatPanel` take `handsPrimary` and `distanceM` and
no band, so a six-year-old and a seventeen-year-old get identical spatial
controls. The scene cannot even read it: `BoardScene` is a stable component type
(the `ViroARSceneNavigator` constructor-capture rule) and reads everything from
`useXrSession`, which has no `ageBand` field.

**Every control lands under the floor.** `XrRail` computes
`key = Math.min(width, minHitSize(distanceM, handsPrimary))`, and `width` is
`railWidth` = 0.1 m. Since 0.1 < 0.1048, the key is always clamped to the rail's
width, and every derived control multiplies down from there.

| Control | Metres | Degrees at 1.5 m | Against the 4° floor |
| --- | --- | --- | --- |
| `minHitSize` ray, 1.5 m | 0.1048 | 4.00° | the floor itself |
| `minHitSize` hands, 1.5 m | 0.1310 | 5.00° | the floor × 1.25 |
| Rail key (`min(railWidth, …)`) | 0.1000 | 3.82° | **under** |
| Clear (`key × 0.8`) | 0.0800 | 3.06° | **under** |
| Ink swatch (`key × 0.7`) | 0.0700 | 2.67° | **under** |
| Placement key height (`size × 0.6`) | 0.0629 | 2.40° | **under** |
| Chat action height (`action × 0.6`) | 0.0629 | 2.40° | **under** |

Three separate mechanisms produce this and each needs a different answer. The
rail's clamp wants `railWidth` raised to at least 0.105 m (0.131 m if hands are
ever primary) so the `min()` stops binding. The `× 0.8` and `× 0.7` multipliers
want to go — a key that is deliberately smaller than the floor is a key
deliberately harder to hit, and for Clear that is arguably the point, but it
should be spelled as extra separation rather than a smaller target. The `× 0.6`
height on the placement and chat keys is the same mistake in one axis: the keys
are 1.6× wide and 0.6× tall, so they clear the floor horizontally and miss it
vertically by 40%.

**The entry pill declares no target at all.** `XrBoardButton.tsx` carries only
padding classes (`px-element py-element` through `px-group py-group`) and no
`min-h-target-*`, while its own header says "the target comes from the age band,
never from a number here … (`tooling/check-targets.mjs`)". That gate scopes
`COMPONENTS` to `packages/ui/Button.tsx` alone, so nothing checked the claim. A
K–2 learner's 72dp floor applies to a door into a headset exactly as it does to
everything else on a learner surface; the class that would enforce it is
`BAND_SCALE[band].target`.

## §7 Accessibility notes

**Selection must never be carried by colour alone.** The rail's stated rule is
four redundant signals: fill (`moyoKey` → `moyoKeySelected` → `moyoKeyPressed` →
`moyoKeyDisabled`), label colour inverting with the fill, a 0.004 m ring drawn
only while a ray rests on the key, and stable position so the selected tool is
always in the same place. The rule holds everywhere except the ink picker, whose
swatch keys render `label=""` — choosing a pen colour is currently a colour-only
decision, which is exactly the failure the rule exists to prevent.

**The rail key is invisible as a shape.** `XR_MATERIAL.key` is registered with
`chrome.frame` rather than `chrome.key`. `chrome.key` (ink[100], `#F6F3E8`) is
declared and used by nothing. So a key is ink[950] `#0D0C0B` on a rail of ink[800]
`#262420` — **1.26:1**. The label on it is 19.2:1 and perfectly readable, so what
a child sees is floating words with no key under them, and a hover ring that
appears around nothing. Registering `chrome.key` is a one-word fix.

**Contrast, as computed from the tokens** (WCAG 2.x ratios, stated for the
tokens rather than for anything measured through a headset display):

| Pair | Ratio | Verdict |
| --- | --- | --- |
| Paper `#FFFFFF` on rail `#262420` | 15.49:1 | the composition's anchor pair, and the only one a child must read |
| Rest label ink[50] on key ink[950] | 19.21:1 | pass |
| Selected label ink[900] on `keySelected` ink[100] | 16.28:1 | pass |
| Focus ring ink[100] on key ink[950] | 17.59:1 | pass as a colour; 0.004 m at 1.5 m is 0.15° and may be invisible regardless |
| Disabled label ink[300] on key ink[950] | 10.72:1 | pass |
| Key ink[950] on rail ink[800] | **1.26:1** | fail — the key has no visible edge |
| Wait text ink[900] on frame ink[950] | **1.08:1** | fail — the text is not readable |

A headset display's perceived contrast is not a token computation. These numbers
are a floor: whatever passes here still has to survive passthrough in a lit room,
which is `02-design-plan.md` §7's list.

**Reduced Motion is declared and dropped.** `XrPanelProps.reducedMotion` exists
and `XrPanel.native.tsx` does not destructure it. Neither does `handsPrimary`,
which is the prop the panel would need to size anything itself. `useReducedMotion()`
already resolves Natalie down to `audio-only` on the 2D screen, so the signal is
available; it just does not reach here.

**There is no spatial screen-reader path.** `ViroText` and `ViroFlexView` expose
no accessibility role or label in the installed package, so nothing in the scene
is announced. Every affordance is visual. That is a platform limit rather than a
choice, and it is why §6's target sizes and §7's contrast carry more weight in
this surface than they do in the 2D product — they are the only accessibility
mechanisms the medium gives back.

**The way out is always reachable.** `XrPlacementControls` draws Leave below the
paper on every state where ornaments render, and `onExitViro` on the navigator
runs the same `onExit`. The session keeps running; only the route pops.

## §8 The spatial tokens, in metres

Every number a spatial surface may use, and where it came from. **These are
starting values chosen against the token set, not measurements.** None has been
checked on a headset. §9 is the list that would change that.

### Spacing — `spatialSpacing`

| Token | Metres | Source | Used by |
| --- | --- | --- | --- |
| `xs` | 0.025 | ViroReact spatial layout token set | Rail padding, chat padding, placement-row padding |
| `sm` | 0.05 | same | `railGap`, `ornamentGap`, the Clear separator, the frame overhang |
| `md` | 0.1 | same | `chatGap`, the off-screen engine's parking offset |
| `lg` | 0.2 | same | unused by this feature |
| `xl` | 0.35 | same | unused by this feature |

### Distance — `spatialDistance`

| Token | Metres | Source |
| --- | --- | --- |
| `nearInteraction` | 0.45 – 0.80 | Meta comfort guidance for the near field, as this repo expresses it. Nothing may sit inside `min`: a panel closer than that is inside the space a child moves their hands through |
| `comfortableUI` | 1.25 – 2.00 | same guidance for reading distance. The board sits at 1.5 m, mid-range |

### Type — `spatialType`

| Token | Metres (rendered glyph height) | Source |
| --- | --- | --- |
| `caption` | 0.025 – 0.035 | ViroReact spatial layout token set |
| `body` | 0.040 – 0.055 | same. The floor for anything a child has to READ rather than glance at |
| `title` | 0.070 – 0.110 | same |

`spatialType` is exported and **no component in this feature uses it.** Every
`ViroText` in `packages/ui/xr` sets `style.fontSize` in points instead —
`XrChatPanel` 20 / 18 / 14 / 13, `XrQuestionLine` 20, `XrRail` 16, the placement
keys 15, the wait line 22, the unsupported card 24. Whether a Viro font size in
points maps to a rendered glyph height in metres that clears `spatialType.body`
is unknown and cannot be reasoned out from the package's types. This is the
largest unmeasured gap in the token set and the first thing a device session
should photograph.

### Targets — `spatialTarget`

| Token | Value | Source |
| --- | --- | --- |
| `minAngleDeg` | 4 | The floor the ViroReact spatial layout system sets. **Not** Apple's, Meta's or the W3C's — see `00-research.md` §7 |
| `handMultiplier` | 1.25 | Same token set. A pinch is aimed with a whole arm and lands with more spread than a ray |
| WCAG 2.2 SC 2.5.8, for comparison | 24 CSS px = **0.51°** | `targets.floor` in `packages/theme/tokens.ts`; the angle from the W3C document's own gloss of a CSS pixel as "visual angle of about 0.0213 degrees" |

### Composition — `boardComposition`

| Token | Metres | Degrees at 1.5 m | Source |
| --- | --- | --- | --- |
| `anchor` | `[0, -0.1, -1.5]` | — | Chosen here. Mid `comfortableUI`, dropped below the eye line for a seated learner |
| `boardWidth` | 0.55 | 20.78° | Chosen here. 5:7 portrait paper is in no design system; it is the shape of the homework |
| *derived* board height | 0.77 | 28.79° | `boardWidth × 7 / 5` |
| `railWidth` | 0.1 | 3.82° | Chosen here, and **0.005 m under the 4° floor** — §6 |
| `railGap` | 0.05 | — | `spatialSpacing.sm` |
| `chatWidth` | 0.45 | 17.06° | Chosen here |
| `chatGap` | 0.1 | — | `spatialSpacing.md` |
| `chatYawDeg` | −40 | — | Chosen here. Face-on from that position would be ≈ −72° |
| `topOrnamentHeight` | 0.06 | 2.29° | Chosen here. Matches `XrQuestionLine`'s hardcoded `height={0.06}` |
| `bottomOrnamentHeight` | 0.08 | 3.06° | Chosen here. Matches `XrPlacementControls`' hardcoded `height={0.08}` |
| `ornamentGap` | 0.05 | — | `spatialSpacing.sm` |

Both ornament heights are declared in the token file *and* written again as
literals inside `XrOrnaments.native.tsx`. Two copies of one number, currently
equal, and only one of them is the token.

### Depth offsets, none of which is a token

| Thing | Metres on Z | Where |
| --- | --- | --- |
| Frame, behind the paper | −0.005 | `XrPanel.native.tsx` |
| Ink, in front of the paper | +0.001 | `XrBoardInk.native.tsx` `pageToSurface` |
| Pointer quad, in front of the ink | +0.002 | `XrPanel.native.tsx` `POINTER_STANDOFF` |
| Wait / unsupported layer | +0.010 | `XrPanel.native.tsx` |
| Companion, toward the child | +0.200 | `boardComposition.chatGap × 2` |

Five Z offsets, five literals, no `spatialDepth` token. Depth is the one axis a
spatial design system exists to govern and it is the one axis with no tokens.
A `spatialDepth = { hairline: 0.001, pointer: 0.002, behind: 0.005, overlay: 0.01, panel: 0.2 }`
block beside `spatialSpacing` is the shape that already has precedent — and the
four values between −0.005 and +0.010 now have a required ORDER as well as a
magnitude (frame behind paper behind ink behind pointer, all behind the overlay),
which is exactly the kind of constraint a token block exists to hold in one
place.

The ink's +0.001 m lift may not survive the renderer. `ViroPolyline`'s installed
type documents `points` as "2D points in world space in the xy plane specified as
`[x,y]`" while typing them `Viro3DPoint[]`, so whether the Z component is honoured
at all is a device question. If it is ignored, the ink is coplanar with the paper
and will Z-fight.

### The board's client space — `boardSurfacePixels`

`1400 × 1960`. A resolution, not a layout: the engine draws at this size and the
result maps onto the 5:7 surface, so it decides whether a fraction bar reads at
1.5 m and nothing else. Exactly 5:7, so the mapping is a scale and never a
stretch.

The one thing it does decide, in metres:

| Quickdraw `SIZES` | Page px | Spatial thickness | At 1.5 m |
| --- | --- | --- | --- |
| `s` | 2.5 | 0.98 mm | 2.3 arcmin |
| `m` (default) | 4 | 1.57 mm | 3.6 arcmin |
| `l` | 6.5 | 2.55 mm | 5.9 arcmin |
| `xl` | 10 | 3.93 mm | 9.0 arcmin |

Whether a 3.6-arcmin line reads as a seven-year-old's handwriting at 1.5 m is
ADR-117's escalation trigger. If it does not, option B is not shippable and the
native surface→texture bridge is what replaces it.

## §9 What a device has to settle

`02-design-plan.md` §7 holds the material questions — paper glare, rail alpha
against a bright wall, arrival duration, hover-ring visibility. These are the
geometry ones.

1. **Does a Viro `fontSize` of 16 clear `spatialType.body` at 1.5 m?** Nothing in
   the feature uses the type tokens, so the answer decides whether they are a
   token set or a fiction.
2. **Is a 3.82° rail key pressable with a controller ray?** If yes, the floor is
   wrong. If no, `railWidth` moves and the composition re-lays out.
3. **Is a 2.40° placement key pressable?** Recenter and Leave are the two
   controls a stuck child needs most.
4. **Does `ViroPolyline` honour the Z component of its points?** Decides whether
   the ink's 0.001 m lift exists or whether the paper needs its own offset — and
   whether the pointer quad at 0.002 m clears the strokes it has to sit in front
   of.
5. **Does `dragType="FixedToPlane"` report often enough for handwriting?** The
   drag replaced `onHover` on the strength of reading the renderer's source. Its
   sample rate has not been observed, and it is now the single assumption the
   whole drawing experience rests on.
6. **Is a 1.57 mm polyline legible handwriting at 1.5 m?** ADR-117's trigger.
7. **Where does the companion's far edge actually sit?** 32.4° by arithmetic. A
   seated learner turning to read it for thirty minutes is the thing to watch.
8. **Does the 0.025 m frame overhang give a grabbable edge,** or does the
   arithmetic need the `× 2` that both comments already assume?

Until these are recorded on hardware, every metre in §8 is a starting value and
this file stays a draft.

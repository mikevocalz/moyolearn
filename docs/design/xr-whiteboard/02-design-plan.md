# Spatial whiteboard — design plan

<!--
What it is: the visual direction for the headset whiteboard — which materials
the spatial surfaces are made of, why the paper breaks the rule the rest of them
follow, how the rail is dressed, the one moment the feature is allowed to spend
motion on, and the list of borrowed defaults that have to come out before this
reads as Moyo.
Why it exists: every colour this feature draws with is a hex literal inside
`packages/ui/xr/spatial-materials.native.ts`, outside the token file that
`CLAUDE.md` §UI says holds all of them. Some of those literals are Tailwind's
stock palette. A spatial surface that nobody ever compares against the 2D
product drifts into looking like a generic headset demo, and the drift is
already measurable — this file is where it gets named and answered.
SOT: packages/ui/xr/spatial-materials.native.ts · packages/ui/xr/spatial-tokens.ts ·
     packages/ui/whiteboard.types.ts · packages/theme/tokens.ts ·
     docs/design/art-direction.md
SOT-KEYWORDS: xr design plan spatial material paper opaque light rail chrome arrival
              motion de-templating tailwind default token drift headset whiteboard
-->

Status: draft, unapproved · Date: 2026-09-13 · Branch: `feat/spatial-whiteboard-xr`

## §1 What this plans

The learner tutor session, presented in a headset: a 5:7 portrait board, a
detached vertical rail on its left, the question above it, recenter and leave
below it, and the tutor conversation on a panel to the right. One session, one
board document, two presentations — which is the constraint that governs every
choice below. A stroke drawn in the headset and the same stroke drawn on a
laptop are the same record in the same document, so any place where the two
presentations *look* like different products is a defect rather than a style.

This file covers material, chrome and motion. Geometry and the panel's contract
are `03-design-system.md`; every string is `04-copy.md`.

## §2 The material set

Nine named materials plus one generated family, registered once at module load
in `spatial-materials.native.ts`. ViroCore resolves `materials={['name']}`
against a global registry, so the registration cannot live in a render.

| Name | Value | Lighting | Draws |
| --- | --- | --- | --- |
| `moyoPaper` | `#fdfdfb` | Constant | the writable surface |
| `moyoFrame` | `#d7dae1` | PBR, roughness 0.7, metalness 0 | the grab edge around the paper |
| `moyoRail` | `#1a1d24e6` | PBR, roughness 0.6, alpha | the rail's own slab |
| `moyoCard` | `#22262f` | PBR, roughness 0.75 | chat panel, question line, the unsupported card |
| `moyoKey` | `#2f3441` | PBR, roughness 0.55 | a rail or control key at rest |
| `moyoKeyPressed` | `#ffffff33` | Constant, alpha | a key under a press |
| `moyoKeySelected` | `#7dd3fc` | Constant | the active tool |
| `moyoKeyDisabled` | `#4b525e80` | Constant, alpha | undo with nothing to undo |
| `moyoFocusRing` | `#7dd3fc` | Constant | registered, and currently drawn by nobody |
| `moyoInk_<colourId>` | vendor `THEMES.light.colors[id].stroke` | Constant | one per colour the board draws in |

Two lighting models, and the split is the whole visual argument. Everything a
child *reads* is `Constant`: paper and ink, so a lamp behind them cannot shade
one corner of a long division darker than the other. Everything a child *holds
or aims at* is `PBR`: frame, rail, card, key, so the room's light lands on them
and they sit in the space rather than floating in front of it.

The ink family is generated from the vendor's `COLOR_IDS` and its own light
theme rather than a table copied into this repo, which is what keeps a red
correction the same red in both presentations when either moves. The same seven
hexes are already in `packages/theme/tokens.ts` as `board-black` … `board-violet`
with a note saying they were copied from `@quickdrawjs/core/src/palette.js`, so
there are now two derivations of one palette — the token file's copy and the
spatial file's import. Both are currently correct. Only one of them stays
correct through a vendor bump, and it is the import.

## §3 Why the paper is opaque and light, and everything else is restrained

The restraint is the default. A headset UI that fills the room with opaque
panels takes the room away, so the rail is `#1a1d24` at 90% alpha, the cards are
a single dark value, and the frame is a light grey that reads as the edge of a
sheet rather than as window chrome.

The paper is the one surface that refuses this, on measured grounds already
recorded in `packages/ui/whiteboard.types.ts`. In dark mode the 2D board came
back white-on-near-black: the recogniser is trained on the other polarity, the
tutor answered "your whiteboard's hard to read, but the answer tells me…", and
the same export is the 224px thumbnail in the thread, where pale strokes on a
dark field read as an empty rectangle. In a headset that failure gets a second
half. A translucent panel puts whatever is behind it — a bookshelf, a window, a
sibling walking past — underneath a child's pencil working, and a child reading
their own arithmetic through a bookshelf is reading two things at once.

So `moyoPaper` is `#fdfdfb`, opaque, `Constant`, in both colour schemes and both
presentations. Freeform, Zoom and Apple's own markup all hold a light canvas
under a dark UI for the same reason.

The dark chrome around it is not a mood. It is the contrast frame that makes an
opaque white rectangle at 1.5 m legible as an object instead of a light source:
paper at `#fdfdfb` against rail and card in the `#1a1d24`–`#2f3441` range is the
highest-contrast pair in the composition, and the only one a child has to read.

## §4 The rail chrome

The rail is a slab, not a set of floating buttons. `moyoRail` fills a
0.1 m × board-height `ViroFlexView` at 90% alpha, padded by `spatialSpacing.xs`
(0.025 m), with keys stacked from the top.

Four things carry a key's state, and the redundancy is deliberate:

- **Fill.** `moyoKey` at rest, `moyoKeySelected` when the tool is active,
  `moyoKeyPressed` (white at 20%) under a press, `moyoKeyDisabled` when there is
  nothing to undo.
- **Label colour.** `#f8fafc` at rest, `#0b1220` on the selected key — the fill
  inverts, so the label has to as well.
- **A ring.** 0.004 m border drawn only while a ray rests on the key. In a
  headset a hover highlight is often the only feedback a ray gives before a
  press lands, and there is no cursor to fall back on.
- **Position.** The tool keys keep the 2D tray's order, so the selected one is
  always in the same place on the rail.

A tool identified by colour alone is a tool a colour-blind child cannot find,
which is why selection never rests on the fill by itself. That rule holds
everywhere on the rail except one control, and the exception is a bug:
the ink picker's swatch keys render with an empty label, so choosing a pen
colour is currently a colour-only decision. `04-copy.md` §4 carries it as a copy
flag with a proposed fix.

Clear sits last, below a `spatialSpacing.sm` (0.05 m) gap and drawn at 80% of a
key. The gap is the affordance: a ray sliding down the rail stops at Undo. There
is no confirmation dialog, for the same reason the 2D tray has none — the engine
clears in one undoable step and Undo is directly above.

## §5 The one moment: the board arriving

One memorable moment, and it is the board arriving into place. Everything else
in this feature is static, because a headset is the one medium where decorative
motion has a physical cost.

**What exists now.** `XrPanelState` runs `checking` → `preparing` → `ready`.
While checking or preparing, the panel draws a spinner and a line of text at
`z = 0.01`; on `ready` the paper, its ink and its ornaments appear. The
transition is a pop — nothing is animated anywhere in `packages/ui/xr`, and
`XrPanelProps.reducedMotion` is declared but never destructured by
`XrPanel.native.tsx`.

**What it should be.** The paper arrives at the anchor once, on the
`preparing → ready` edge, and never again:

- **The paper settles, the child does not move.** The board scales from about
  0.94 to 1.0 and fades in over `motion.duration.slow` (300ms) on
  `motion.easing.emphasized`. The camera is not touched, the anchor does not
  travel across the room, and nothing pushes past the child's face. The comfort
  rule this feature is built on is already written into
  `XrOrnaments.native.tsx`: the only thing that moves the view is the person
  wearing the headset.
- **The ornaments follow the paper.** Rail, question line and placement row fade
  in one `motion.duration.fast` (120ms) behind it, so the composition reads as
  a sheet of paper that brought its tools rather than four panels appearing at
  once.
- **The strokes are already there.** A child entering the headset mid-session has
  working on the board, and it has to be on the paper in the first frame the
  paper is opaque. Ink that draws itself in would be a lie about who wrote it.
- **Recenter reuses it at half.** `recenter()` resets placement to
  `INITIAL_PLACEMENT`; the board should travel there over
  `motion.duration.base` (200ms) rather than teleport, because a jump gives a
  child no evidence that the thing that moved was their paper.
- **Reduced Motion gets the last frame.** `useReducedMotion()` already resolves
  Natalie down to `audio-only` on the 2D screen. Here it resolves the arrival to
  its final frame: the board is simply present. `reducedMotion` is the prop that
  carries it and it has to be read.

Nothing else in the feature animates. No idle float on the panels, no pulse on
the Ask key, no parallax on the chat.

## §6 The pass that removes the templated defaults

Five things currently make this surface read as a stock headset demo rather than
as Moyo. Each has a specific replacement.

**1 · The palette is Tailwind's, not the product's.** `#f8fafc` is slate-50,
`#94a3b8` is slate-400, `#7dd3fc` is sky-300. Three of the spatial surface's
most-used colours are framework defaults, and the product's own language is
plum / lagoon / flame / sun over cream-to-black `ink` neutrals. The dark chrome
values should come from the `ink` and `plum` ramps that already carry chrome
everywhere else, and the hexes should live in `packages/theme/tokens.ts` like
every other colour in this repo — `CLAUDE.md` §UI says no raw values, and the
token file's own header says no hex exists outside it. A spatial token block
next to `board-*` is the shape that already has precedent.

**2 · Selection and focus are sky blue.** `moyoKeySelected` and `moyoFocusRing`
are both `#7dd3fc`. The product has answers for both jobs and they are not the
same colour: selection is `highlighter` (lagoon teal — "the 'you are here'
marker and the primary action read as the same object" is the exact mistake that
token was created to fix), and focus is `focus` (`#3B6DF6`). Using one stock
blue for both re-creates the collision in space that the 2D palette already
resolved.

**3 · Elevation is implied by nothing.** The 2D language is RETRO: hard offset
slabs in the border colour, no blur, ever. The spatial composition separates its
panels with Z offsets and alpha alone, which is the generic answer. The frame
already sits 0.005 m behind the paper and is one `spatialSpacing.sm` wider on
every side — that overhang is a hard offset slab, and drawing it in the product's
border ink rather than in `#d7dae1` grey would make the spatial board
recognisably the same object as the 2D one.

**4 · The keys are grey rectangles with grey words on them.** Every rail key is
`moyoKey` with a text label, so Pen, Undo and Clear are visually identical
objects distinguished only by a word. The 2D tray uses icons — Brush,
Highlighter, Eraser, Undo2, Trash2, Sparkles — and a seven-year-old reads the
brush faster than the word. The spatial rail needs the same marks, which on Viro
means `ViroImage` glyphs rather than `ViroText`.

**5 · Nothing on the surface is brand.** There is no wordmark, no accent, no
single highlighter moment — the composition could belong to any app. The house
rule is one display moment and one highlighter accent per screen. The candidate
here is the Ask key: it is the only control that reaches Natalie, and it is the
one thing on the rail that deserves the accent the rest of the product gives to
a primary action.

## §7 What a device has to settle

Every number in §4 and §5 is a starting value chosen against the spatial token
set, not a measurement. Four of them need a headset before this document can
lose its draft status:

- Whether `moyoPaper` at `#fdfdfb` is comfortable at 1.5 m in a lit room, or
  whether an opaque near-white rectangle at 21° × 29° is a glare source in
  passthrough.
- Whether the rail's `#1a1d24` at 90% alpha still reads as a slab against a
  bright wall, which is the condition alpha chrome fails in.
- Whether the 300ms arrival is the right length for a board this size at this
  distance, or reads as sluggish.
- Whether the 0.004 m hover ring is visible at 1.5 m at all.

Until then this is a plan, and `03-design-system.md` §9 carries the geometry
side of the same list.

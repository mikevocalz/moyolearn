# Spatial whiteboard — the critique

<!--
What it is: a heuristic critique of the composition as the code and the geometry
determine it — first impression, usability against the ten heuristics,
hierarchy, consistency with the 2D product, and accessibility — with a file and
line behind every claim.
Why it exists: the other four documents describe what this feature IS. This one
says whether it is any good, and it is written before a device session rather
than after, because most of what is wrong with it is decidable from arithmetic
and does not need a headset to see.
SOT: packages/ui/xr/XrPanel.native.tsx · packages/ui/xr/XrRail.native.tsx ·
     packages/ui/xr/XrChatPanel.native.tsx · packages/ui/xr/spatial-tokens.ts ·
     packages/ui/XrBoardButton.tsx · packages/app/features/tutor/tutor-xr-screen.native.tsx
SOT-KEYWORDS: xr critique heuristics usability hierarchy consistency first
              impression spatial whiteboard review nielsen
-->

Status: draft · Date: 2026-09-13 · Branch: `feat/spatial-whiteboard-xr`

## §0 What this is based on

**There are no device recordings.** Nothing in this feature has been seen on a
headset — not by me, not by anyone, and ADR-117's own *Not verified* section says
so. No screenshot exists, no video exists, and the renderer has never been run.

So this critiques what the code and the geometry *determine*: where things sit,
how large they are in degrees, which states can be reached, what a control does
when pressed, and what a child is told. Everything that depends on how a
passthrough display actually looks is out of scope and is collected in
`06-a11y.md` §8 and `05-handoff.md` §9 rather than guessed at here.

Read against the working tree at **2026-09-13 14:23 EDT** — `6e5707b` plus
uncommitted work in flight. Several defects an earlier read would have raised
were fixed while this was being written; where that matters it is said.

**Verdict: several issues to address.** The architecture is the strongest thing
here and it is genuinely well made. The composition it produces is not yet one a
child can use, and the single largest problem is that the rail does not fit.

## §1 First impression

Imagine the first five seconds, from the geometry alone. A child presses a small
pill beside Natalie, the screen goes, and they are in a room with a sheet of
white paper hanging 1.5 m away, slightly below eye level, about the angular size
of a large monitor. To its left, a dark slab of labelled keys. Above it, one line
of dark card with the question on it. Below it, two keys. To the right, turned
toward them, a dark panel with Natalie's name and the last four things either of
them said.

**What reads well immediately.** The paper is the brightest thing in the
composition by a factor of fifteen (`06-a11y.md` §2.1: 15.49:1 against the rail),
it is opaque, and it is the only light surface. A child's eye has exactly one
place to go, and it is the place their homework is. That is the right answer and
it was argued for rather than stumbled into — the reasoning is in
`packages/ui/whiteboard.types.ts` and it is *measured*, from a real failure in
2D dark mode.

**What reads wrong immediately.** The board's strokes are already on the paper in
the first frame and that is correct
(`tutor-xr-screen.native.tsx` hands the panel the session's existing document),
but the paper *pops* into existence: `XrPanelState` goes `checking` → `ready` with
no transition, because nothing in `packages/ui/xr` animates. A sheet of paper
that appears instantly at 1.5 m with a child's handwriting already on it does not
read as "your board came with you" — it reads as a cut. `02-design-plan.md` §5
specifies the fix in detail and it is unbuilt.

**The wait state is the weak first five seconds.** During `checking` the panel
draws a spinner and "Getting your board ready" in front of the frame quad while
the paper is not rendered. The text contrast was corrected; the spinner is still
`type="dark"` on `ink[950]` (`XrPanel.native.tsx:391`). A child's first frame of
this feature may be a near-black rectangle with a near-black spinner on it.

## §2 Usability

### H1 · Visibility of system status — ⚠️

The pill says "Opening…" and goes inert while `entering` is true
(`XrBoardButton.tsx:71-76`), and `TutorXrEntry`'s Suspense fallback says
"Opening your board in space…" with "Your working is saved. Nothing is lost if
you go back." underneath. That chain is genuinely good: it covers a renderer
being fetched, which is the one moment a child is looking at nothing.

Inside the scene it falls apart. **Four of six lifecycle states cannot be
reached** (`05-handoff.md` §5.1): `preparing` is written and never set,
`interrupted` — the state that keeps the board on screen when tracking blinks —
is never raised by anything, `unsupported` has a store action nobody calls, and
`exiting` has no render branch at all. So a child whose headset loses tracking
mid-session gets whatever the renderer does by default, and the six-member union
that exists precisely to tell them which kind of trouble they are in tells them
nothing.

The Ask key does have honest status: its label changes to "Sending" and it
disables itself while `asking` (`XrRail.native.tsx:242-249`). That is the pattern
the rest of the scene needs.

### H2 · Match between system and the real world — ✅ mostly

"Pen", "Erase", "Undo", "Redo", "Clear", "Recenter", "Leave" are all things
rather than jargon, and "Ask" is what a child does to a tutor. The one miss is
the door: the pill's visible word is **"XR"** (`XrBoardButton.tsx:76`), which is
a name for a technology. Its own `aria-label` already knows better — "Open
spatial whiteboard" — and the comment above it argues the exact right principle
while applying it to the wrong string.

"Mark" for the highlighter is a coinage. The 2D tray calls it a highlighter and
draws a highlighter icon; `04-copy.md` §3.1 already flags that three rail labels
are words the 2D board does not use.

### H3 · User control and freedom — ✅

The strongest heuristic in the feature.

- **Leave is drawn on every state where ornaments render**, and `onExitViro` on
  the navigator runs the same handler. Two ways out, neither dependent on the
  board being healthy.
- **Undo and Redo are both on the rail**, and redo is there *because* of this
  medium — "a ray is far easier to overshoot than a tap"
  (`XrRail.native.tsx:8-9`). That is a real adaptation rather than a port.
- **Clear has no confirmation dialog, deliberately**, because the engine clears
  in one undoable step and Undo is directly above. Correct reasoning, and it is
  the reasoning §5 shows is currently unsafe.
- **A stroke that leaves the paper is cancelled, not ended**
  (`XrPanel.native.tsx:281-285`). A child whose ray has reached the wall is not
  choosing to finish a line there. This is a small decision and it is exactly
  right.
- **Leaving is a `router.back()`**, so the 2D screen is still underneath with its
  pane state, its composer draft and its session. Coming back is a pop.

### H4 · Consistency and standards — ⚠️

Consistency with the 2D product is the thing this feature was built to protect
and it mostly holds: one engine, one document, one transcript, the same seven
inks generated from the vendor's own theme rather than a table copied here
(`spatial-materials.native.ts:160-167`).

Two breaks:

- **The rail is words where the tray is icons.** The 2D tray uses Brush,
  Highlighter, Eraser, Undo2, Trash2, Sparkles. The rail is seven grey rectangles
  distinguished only by a word, so Pen, Undo and Clear are visually identical
  objects. A seven-year-old reads the brush faster than the word, and in a
  headset they read it faster still.
- **Selection does not look like selection anywhere else in the product.**
  `XR_MATERIAL.keySelected` resolves to the same colour as `XR_MATERIAL.key`, so
  the active tool is pixel-identical to the inactive ones (`06-a11y.md` F2).

### H5 · Error prevention — ⚠️

The input path is defended thoroughly and at the right level of detail: a press
with no hit position is dropped coordinate by coordinate because `[].every()` is
true; a second press with a stroke open cancels the first; a stroke's end is
reported at the last move because the renderer freezes the hit result; the
pointer quad is rested on every release so its displacement cannot accumulate.
Each of those is a bug that was found and closed, and the comments say which.

Against that, **the destructive control is the one that is not defended in
practice**. The safety argument for Clear is spatial — "a ray sliding down the
rail stops at Undo" — and §5 shows Undo is drawn 0.8 m outside a 0.72 m box.

**Move and draw are physically separate affordances** and that is the sharpest
decision in the whole feature. The frame carries the drag, the paper carries
`ignoreEventHandling`, the pointer quad carries the stroke. A child drawing a
long division and a child repositioning their paper are doing different things,
and a surface that did both would drag the homework across the room on every
downstroke.

### H6 · Recognition rather than recall — ⚠️

The question is above the paper, the tool keys are always in the same place, and
the conversation is visible rather than remembered. But **the current ink colour
is recognisable only by colour**: the Ink key's material is the selected ink and
the swatches render `label=""` (`XrRail.native.tsx:212`). A child has to remember
which of seven fills they picked, and a colour-blind child cannot recognise it at
all.

The chat window is four turns with "N earlier messages on the normal screen"
above them (`XrChatPanel.native.tsx`). Honest, and the right trade — a spatial
transcript a child scrolls with a ray while holding a pencil is a transcript they
will not read — but it means the tutor's explanation from six turns ago is
genuinely gone, and the copy points at a screen the child cannot see from inside
the headset.

### H7 · Flexibility and efficiency — ➖

There is one path through everything and no shortcuts, which is correct for a
learner surface. Nothing to flag.

### H8 · Aesthetic and minimalist design — ⚠️

The restraint is right: one light surface, dark chrome, no decoration, no idle
motion. `02-design-plan.md` §3's argument — that a headset UI which fills the
room with opaque panels takes the room away — is carried through.

Two things dilute it:

- **The rail is nine elements tall** (three tools, Ink, Undo, Redo, Ask, a
  separator, Clear) before the ink picker opens and sixteen after. That is a
  desktop toolbar stood on end. `05-handoff.md` §2.6 is the arithmetic; the
  design question underneath it is whether a child doing long division needs Redo
  and a seven-colour picker on screen permanently.
- **Nothing on the surface is brand.** No wordmark, no accent, no highlighter
  moment. The house rule is one display moment and one highlighter accent per
  screen. `02-design-plan.md` §6.5 nominates the Ask key and the nomination is
  right — it is the only control that reaches Natalie.

### H9 · Error recovery — ⚠️

There is one error surface, `unsupported`, and it draws one sentence for all
three reasons in `XrUnsupportedReason`. Nothing calls `unsupported()`, so the
sentence has never rendered. The reason this matters: **one of the three reasons
is actionable and two are not.** A declined permission is something a child can
fix; a device with no XR runtime is not. Collapsing them means the one child who
could act is not told how.

The actual gate is `canOpenSpatialBoard()`, which fails closed and hides the pill
entirely. That is a good gate — an offer a child cannot take is worse than no
offer — and it is why the unsupported card has no surface. But it also means the
*permission* case has nowhere to go.

### H10 · Help and documentation — ✅

Correctly absent. The composition is a sheet of paper with pens beside it, which
is a mental model a six-year-old already has.

## §3 Hierarchy

**What the composition says is most important.** The paper: brightest by 15×,
largest at 20.78° × 28.79°, centred, and the only element that is light. Nothing
competes with it. This is the clearest thing about the design.

**What the composition says is second.** By area, the rail (8.44° wide × the full
board height) and the chat panel (17.06° wide × the full board height). Between
them they flank the paper with two tall dark slabs of equal visual weight — and
they are not of equal importance. The rail is how a child works; the chat is
context they can also get on the screen they came from.

**Where the hierarchy breaks.** Three things.

1. **The question is the smallest element and it is the reason the board exists.**
   `topOrnamentHeight` is 0.15 m against a board of 0.77 — under 20% of the
   paper's height, in body type, at the top edge of the composition. A child
   working through a problem looks *down* at their paper and the problem is
   21.34° above centre.
2. **Recenter and Leave are as prominent as any tool key.** Both are full-size
   keys at the band floor, on the composition's lower edge, 23.62° below centre
   — further from the paper than the question is. Leave is the most consequential
   control in the scene and Recenter is a rescue; neither is a thing a child
   should be doing often, and they are sized like Pen.
3. **Nothing is the primary action.** Ask is the only control that reaches
   Natalie and it is the seventh identical grey key down a column of eight.

**The composition has grown beyond its own comfort argument.** `boardWidth` 0.55
was chosen so the board plus its neighbours sits inside a ±30° cone. With the
corrected ornament heights the vertical span is now about 45° (21.34° up, 23.62°
down) and the companion's far edge is 33.8° to the right. Both are consequences
of fixing real defects — the ornaments could not hold their own content, the
targets were under the floor — but the result is a composition a seated child
turns their head inside, for an hour, while doing arithmetic. That is the exact
outcome the token file's comment says the sizing exists to prevent.

## §4 Consistency with the rest of Moyo

**Kept.** One `BoardDoc` across both routes. One transcript. One ask path — the
spatial rail exports a PNG and leaves it in `pendingAsk`; `tutor-screen`'s
`handleAskBoard` stages it, so the four-image cap and the attachment id are not
reimplemented. Ink generated from the vendor's own light theme. Targets derived
from the same `targets` token the 2D app uses, as a ratio, so the two scales
cannot drift.

**Broken.** The 2D language is RETRO — hard offset slabs in the border colour, no
blur, borders as structure. The spatial composition separates its panels with Z
offsets and alpha alone, which is the generic spatial answer and belongs to no
product. The frame already *is* a hard offset slab — it sits 0.005 m behind the
paper and overhangs it by 0.025 m on every side — and drawing it in the product's
border ink rather than `ink[950]` would make the spatial board recognisably the
same object as the 2D one. `02-design-plan.md` §6.3 makes this argument; it is
the cheapest de-templating change available.

**A scale mismatch worth naming.** `XrBoardButton` uses the *unsuffixed* spacing
and type utilities, which `packages/theme/build-css.mjs:120-125` emits as the
**cool** (ops) values. It is a learner control rendering at educator density, and
it is why two of four bands land under their target (`06-a11y.md` §3.3). Nothing
about the spatial feature caused that; the pill just inherited the default.

## §5 The problem that outranks the others

**The rail does not fit its own keys, by 2× closed and 3.7× open.**

At the `young` band the rail's content box is 0.72 m and its content is 1.4714 m
closed (seven keys at 0.17143, a 0.1 m separator, Clear) or 2.6714 m with the ink
picker open. The arithmetic is in `05-handoff.md` §2.6. Yoga's default
`flexShrink` is 0, so the expected behaviour is overflow past the slab rather than
compression.

It matters more than anything else here because it invalidates two decisions that
are otherwise correct:

- **Clear's safety argument.** "No confirmation dialog, because the engine clears
  in one undoable step and Undo is on the rail directly above"
  (`XrRail.native.tsx:251-262`) is sound reasoning that depends on Undo being on
  screen. At 1.4714 m of content in a 0.72 m box, Undo is the fifth key down and
  Clear is the ninth element — both outside the slab.
- **The ink picker's placement argument.** "A column beside the rail rather than
  over the paper — a control that covers the work makes a child choose between
  seeing what they are doing and changing how they do it"
  (`:192-197`). Seven more full-size keys in a column that is already double its
  box does not open *beside* anything; it opens into the room.

This got worse rather than better when the target sizes were fixed, and the
target fix was right. The composition has to give somewhere else: fewer keys on
screen at once, a second column, a scrolling rail, or a smaller board. The
acceptance condition is simple and checkable without a device — **Undo and Clear
both inside the slab at the `young` band with the picker open**.

## §6 Accessibility, in one paragraph

Covered properly in `06-a11y.md`. The headline for a design reader: the reading
pair is excellent (15.49:1), every spatial target now derives from the age band,
and three of the four remaining defects are one root cause — `XR_MATERIAL.key`,
`XR_MATERIAL.keySelected` and `XR_COLOR.focus` all resolve to `palette.ink[100]`,
so a key's resting fill, its selected fill and its hover ring are the same colour.
The fourth is the ink swatches, which carry no label and are therefore a
colour-only decision.

The structural fact a designer should carry out of that document: **the scene has
no accessibility tree at all.** `ViroText` and `ViroFlexView` expose no role and
no label in the installed package. That is not a thing to fix; it is a thing that
makes the 2D board the accessible version, permanently, and it is the strongest
possible argument for `XrBoardButton`'s own claim that a learner who ignores this
control loses nothing.

## §7 Priority

1. **Make the rail fit.** §5. It decides whether Undo and Clear are on screen,
   and everything else about the rail is downstream of it.
2. **Fix the three-way colour collision.** One token change restores selection,
   hover and press feedback across every key in the scene (`06-a11y.md` F1, F2,
   F4).
3. **Label the ink swatches.** A Level A failure in the one place the code wrote
   down the rule that prevents it.

Behind those: give the wait state a spinner a child can see, wire `interrupted`
so a tracking blink says something, build the arrival `02-design-plan.md` §5
specifies, and change the pill's visible word from "XR" to something a
seven-year-old would say out loud.

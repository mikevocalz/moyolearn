# Spatial whiteboard — research

<!--
What it is: the questions a homework board in a headset has to answer before it
is worth building, band by band, and the two assumptions the whole composition
rests on — that the learner is seated, and that the work is the same work in
both places. Also the honest ledger of which of those answers are EVIDENCED in
this repo and which are ASSUMED.
Why it exists: the feature is fully built and nothing about it has been tried on
a person. `docs/decisions/adr-117-spatial-whiteboard-bridge.md` already records
what has not been measured on HARDWARE; this file records what has not been
measured on a CHILD, which is a different list and a longer one. Writing the
assumptions down is what makes the first device session a test rather than a
demo.
SOT: packages/app/features/capture/age-band.ts · packages/theme/tokens.ts `targets` ·
     packages/ui/xr/spatial-tokens.ts · packages/app/features/tutor/xr-session.store.ts ·
     docs/decisions/adr-117-spatial-whiteboard-bridge.md · docs/design/tutor-session-research.md
SOT-KEYWORDS: xr research age band k-2 seated learner comfort hit target angular
              assumption evidence no user testing spatial whiteboard headset
-->

Status: draft, no user testing run · Date: 2026-09-13 · Branch: `feat/spatial-whiteboard-xr`

## §1 What this is, and the sentence that governs it

**No user testing has been run on this feature.** No child has worn the headset,
no session has been observed, no task has been timed, and no participant has
been recruited. Every claim below is either read out of this repository, cited to
a published source, or labelled ASSUMED in §6. There are no study results here
because none were produced, and anything in a later pass that reports a
participant count or a completion rate should be treated as new evidence, not as
a restatement of this file.

The feature is a second presentation of the tutor session: a 5:7 portrait board,
a control rail on its left, the question above, recenter and leave below, and
Natalie's conversation on a panel to the right. It is mobile and headset only —
`packages/ui/xr/index.web.ts` and `tutor-xr-entry.tsx` make that a platform fork
rather than a convention, and there will be no Viro web experience for the tutor.

## §2 Method, and what it could not reach

Repository inspection, the published sources in §7, and arithmetic on the tokens
the code already exports. Nothing else was available.

| Wanted | Available | Substituted with |
| --- | --- | --- |
| A learner in a headset | No | The band model in `age-band.ts` and the targets in `tokens.ts` |
| A Quest or PICO device | No | ADR-117's "Not verified" list, carried forward here |
| Moderated usability testing | No | Nothing. The questions in §3 are written as questions, not answers |
| NN/g children's UX article | Fetch returned HTTP 404 in this pass | The repo's own attribution in `tokens.ts`, cited as such |
| WCAG 2.2 SC 2.5.8 normative text | Page truncated before §2.5.8 | The level (AA) and the CSS-pixel angular gloss, which the fetch did return |

The two failed retrievals matter and are not glossed: §7 says exactly which
numbers rest on a source this pass read and which rest on a source it did not.

## §3 The questions, band by band

The code has four bands (`AgeBand` in `packages/app/features/capture/age-band.ts`)
and only three of them are learners. Grades map like this, and the mapping has a
consequence:

| Grades | Band | 2D target (`targets`) | `buttonSizeForBand` |
| --- | --- | --- | --- |
| K–2 | `young` | 72px | `xl` |
| 3–5 | `child` | 56px | `xl` |
| 6–8 | `teen` | 48px | `lg` |
| 9–12 | `teen` | 48px | `lg` |
| educator / guardian | `adult` | 44px | `md` |

**Grades 6–8 and 9–12 are the same band.** A thirteen-year-old and a
seventeen-year-old get an identical spatial board, and nothing in the type system
can tell them apart. That is inherited from doc 08 §2.4 rather than invented
here, and it is fine for target size. It is not fine for the question a
ninth-grader asks in §3.4, which is about portability rather than reach, and the
band model has no vocabulary for it.

And the band reaches none of this anyway. `TutorXrScreen` receives `ageBand` and
spends it in exactly one place — `size={buttonSizeForBand(ageBand)}` on the
off-screen `Whiteboard` engine. `XrRail`, `XrPlacementControls` and `XrChatPanel`
each take `handsPrimary` and `distanceM` and no band at all, so every spatial hit
target is the same size for a six-year-old and a seventeen-year-old. §6 carries
this as the first EVIDENCED gap.

### §3.1 K–2 (`young`)

A child in this band may not read the words on the controls. `Whiteboard.tsx`'s
2D tray answers that with icons — Brush, Highlighter, Eraser, Undo2, Trash2,
Sparkles — beside its labels. `XrRail.native.tsx` draws `ViroText` and nothing
else, so in the headset the word is the whole control.

1. **Where is my paper, and can I get it back?** A board in a room can be behind
   you. `XrPlacementControls` answers with a Recenter key, and §4 explains why
   that answer is weaker than it looks.
2. **Which one is the pen?** Currently answerable only by reading `Pen`, `Mark`
   and `Erase` — and `Mark` is not a word this band maps to a highlighter.
   `04-copy.md` §3 flags it with a replacement.
3. **Which colour am I holding?** The ink swatch keys render `label=""`
   (`XrRail.native.tsx`), so the answer is a fill colour and nothing else. A
   colour-blind child cannot answer it at all.
4. **Did my press do anything?** The rail gives a hover ring (0.004 m), a
   pressed fill and a selected fill. Whether a 0.004 m ring is visible at 1.5 m
   is unmeasured — `02-design-plan.md` §7 carries it.
5. **Is Natalie still here?** The companion panel draws her name and a status
   word. Her body is not in the scene; ADR-111's avatar is a WebGPU surface and
   is not ported into Viro.
6. **Did I break something?** Nothing on this surface may shame, and nothing
   does. `CLAUDE.md` §Children's surfaces is the rule; `04-copy.md` §1 is the
   audit against it.

### §3.2 Grades 3–5 (`child`)

7. **Can I change tools without losing my place?** The ink picker opens a column
   of swatches *beside* the rail rather than over the paper, which is the right
   answer and is already implemented.
8. **Can I send this to her?** The Ask key exports a PNG and hands it to
   `tutor-screen`'s existing `handleAskBoard` through `pendingAsk`. One send
   path, one four-image cap, no second rule about what a child may send.
9. **What happens to my work if I take the headset off?** One `BoardDoc`, held
   by `board-session.ts`, which deliberately survives reaching zero holders.
   This is the strongest answer in the feature and §5 is about it.

### §3.3 Grades 6–8 (`teen`)

10. **Is this faster than the laptop, or is it a toy?** Unanswerable without a
    device. ADR-117 names input→ink latency as unmeasured, and the escalation
    trigger is explicit: if `ViroPolyline` cannot render legible handwriting at
    1.5 m, option B is not shippable.
11. **Can I work for thirty minutes in this?** Also unanswerable. The
    composition is sized to stay inside the comfort cone (§4), which is a
    precondition for a long session rather than evidence of one.

### §3.4 Grades 9–12 (`teen`, same tokens)

12. **Will my teacher get the same thing I see?** The board exports as a PNG
    through the same path as a photographed worksheet, so yes for the export.
    Not for the document — see §5 and the three fidelity limits in `04-copy.md`
    §5.
13. **Can I do the parts this board cannot do?** The spatial renderer draws
    `draw` and `highlight` records only (`stroke-of.ts`). Text, notes, arrows
    and images made in the web app's fuller tray are skipped, and an older
    learner is the most likely person to have made them.

## §4 The seated learner, and why the assumption is load-bearing

**Assume seated.** Three things in the code assume it, and one of them breaks
outright if the assumption is wrong.

`boardComposition.anchor` is `[0, -0.1, -1.5]` — 1.5 m out, dropped 0.1 m below
the eye line. At that distance the paper spans 20.8° × 28.8° and the rail's outer
edge sits 15.8° to the left, which is what keeps the working surface inside a
comfortable head-and-eye range. Meta's seated-VR comfort guidance and Apple's
WWDC23 *Principles of spatial design* both ask for primary content inside a
comfortable field of view and for content placed at a distance that does not
force near-field vergence; `spatialDistance.nearInteraction.min = 0.45` and
`comfortableUI = 1.25–2.0` are this repo's expression of that, and the board sits
at 1.5 m inside the second range.

**The composition already leaves the cone on its right-hand side.** The chat
companion's centre is at x = +0.6 m and its own Z offset is
`boardComposition.chatGap * 2` = 0.2 m toward the child, putting it at z = −1.3 m.
Its far edge is therefore 32.4° off centre, not the 28.8° you get if you measure
it in the board's plane. The comment in `spatial-tokens.ts` that says the
composition is "inside the ±30° comfort cone in both axes" computes the cone at
the board's distance and does not account for the companion's forward offset. A
seated learner meets that edge with a head turn; a standing one meets it with a
step, and the panel does not follow.

**Recenter is weaker than its name.** `recenter()` sets `placement` back to
`INITIAL_PLACEMENT`, whose position is the fixed vector `[0, -0.1, -1.5]`. In a
`ViroARScene` that is a pose in the tracking origin's frame, not in the child's
current head frame — so a child who has swivelled ninety degrees and presses
Recenter gets the board returned to where the tracking origin faces, which is
behind them. The store's own comment says "relative to where the child is now",
and `XrPanel.types.ts` says `[0,0,0]` is "the child's head". Both are true only
at the moment tracking is established. Seated, facing one way, those two frames
stay aligned and nobody notices. That is the whole reason the assumption has to
be written down instead of left implicit.

The comfort rule the feature does honour without exception: nothing moves the
view except the person wearing the headset. `XrOrnaments.native.tsx` states it
and no code anywhere in `packages/ui/xr` touches the camera.

## §5 "The same work in both places"

The expectation is that a stroke drawn in the headset and the same stroke drawn
on a laptop are one record in one document. The architecture delivers it:
`board-session.ts` owns a single `BoardDoc` keyed by session, the spatial screen
acquires the existing one rather than restoring a copy, `PRESENTATION_ID` keeps a
presentation from being echoed its own strokes, and Quickdraw stays the only
authority on what a stroke is.

Four measured gaps sit between that architecture and what a child would see.

1. **Stroke width diverges.** `stroke-of.ts` resolves `props.size` through the
   vendor's `SIZES` map (`s: 2.5, m: 4, l: 6.5, xl: 10` page px). The engine's
   own freehand path does not: `@quickdrawjs/core/src/shapes.js:305` builds the
   outline from `INK_SIZES` (`s: 3.4, m: 5.2, l: 6.5, xl: 10`). At the default
   `m` the spatial stroke is 4 px where the 2D stroke is nominally 5.2 px —
   about 23% thinner, and 26% at `s`. The comment claiming the spatial stroke is
   "the weight its 2D twin is by construction" is true only at `l` and `xl`.
2. **The highlighter is 4.5× too narrow.** `shapes.js:356` draws a highlight at
   `SIZES[size] * HIGHLIGHT_SCALE`, and `HIGHLIGHT_SCALE` is 4.5. `XrBoardInk`
   draws it at `SIZES[size]` with `opacity 0.4`. An 18-page-px band becomes a
   4-page-px line — 7.07 mm of paper rendered as 1.57 mm. The vendor's own alpha
   is `HIGHLIGHT_ALPHA = 0.55`, not 0.4.
3. **Pressure does not survive in either direction.** The engine writes
   `pts: [[dx, dy, pressure], …]`; `strokeOf` drops the third element, and
   `ViroPolyline` takes a single scalar `thickness` in metres for the whole line
   (verified in `/Users/mikevocalz/viro/dist/components/ViroPolyline.d.ts`).
   On the way in, `XrSurfaceInput.pressure` is declared optional and `XrPanel`'s
   `send()` never sets it.
4. **Skipped records are counted by nobody.** `stroke-of.ts` says "the caller
   counts what it skipped" and the store has `skippedRecords` and `setSkipped`.
   Neither is called anywhere in the repo. A learner who typed a note on the web
   app and then entered the headset sees it vanish with no count and no line of
   copy.

## §6 ASSUMED vs EVIDENCED

**EVIDENCED — read out of this repository in this pass.**

| Claim | Where |
| --- | --- |
| No spatial hit target derives from the age band | `tutor-xr-screen.native.tsx:400` is the only use of `ageBand`; `XrRail`/`XrOrnaments`/`XrChatPanel` take `handsPrimary` only |
| Every rail key is under the 4° angular floor | `key = Math.min(width, minHitSize(…))` clamps to `railWidth` 0.1 m = 3.82°; Clear 0.08 m = 3.06°; ink swatch 0.07 m = 2.67°; placement keys 0.0629 m tall = 2.40° |
| Rail keys are near-invisible against the rail | `XR_MATERIAL.key` is registered with `chrome.frame` (ink[950] `#0D0C0B`), not `chrome.key`; against the rail's ink[800] `#262420` that is **1.26:1** |
| The wait text cannot be read | `checking`/`preparing` draws `XR_COLOR.onKey` (ink[900] `#171614`) over the frame quad (ink[950]) with no paper behind it — **1.08:1** — and `ViroSpinner type="dark"` on the same near-black |
| The `unsupported` card never renders | `unsupported(reason)` is exported and called nowhere; the gate is `canOpenSpatialBoard()` on the entry pill |
| `exiting` is never set and `interrupted` is never set | Only read, at `XrPanel.native.tsx:150` |
| `moveHandle: 'bottomOrnament'` behaves as `'none'` | Only the `'frame'` branch wires `dragType` and `onDrag` |
| `layoutBoard`'s rail-floor guard cannot fire at this call site | `minRail` is passed as `Math.min(railWidth, minHitSize(…))`, so `R < minRail` is never true |
| The XR entry pill declares no target token | `XrBoardButton.tsx` carries padding classes only, and `tooling/check-targets.mjs` scopes `COMPONENTS` to `packages/ui/Button.tsx` |
| The spatial rail uses three words the 2D tray does not | 2D: `Pen` / `Highlighter` / `Eraser`. XR: `Pen` / `Mark` / `Erase` |
| Recenter returns the board to the tracking origin, not to the child | `recenter: () => set({ placement: INITIAL_PLACEMENT })` with a fixed position vector |

**ASSUMED — no evidence in this repo or this pass.**

- That a seated learner is the right model for a homework session in a headset.
- That a child can find and press a 3.82° key with a controller ray, and that
  the same key is reachable with hand tracking (which would want 0.131 m, and
  the rail is 0.1 m wide).
- That 1.5 m is the distance a child wants their homework at, as opposed to the
  distance the comfort literature says is safe.
- That `ViroPolyline` at 1.57 mm (3.6 arcmin at 1.5 m) renders legible
  handwriting. ADR-117 makes this the trigger that would replace the whole
  rendering approach.
- That the small chat window (`CHAT_WINDOW = 4`) is enough conversation for a
  child who has just entered the headset mid-session.
- That a child understands the board they are drawing on and the board Natalie
  can see are the same thing. The assurance line currently claims she can see it
  continuously; she cannot (`04-copy.md` §3).
- That any of the age-band differences in §3 exist. They are reasoned from the
  2D product's band model and from the sources in §7, and not one of them has
  been observed in a headset.

## §7 Sources

- **NN/g, children's UX** — <https://www.nngroup.com/articles/children-ux/>.
  The fetch returned HTTP 404 in this pass, so nothing numeric is quoted from it
  here. The repo's own attribution stands on its own and is what the tokens
  rest on: `packages/theme/tokens.ts` sets `targets.young = '72px'` with the
  note "~2cm, NN/g's 4× finding — Hot, K–2 primary actions". Treat the 4×
  finding as the repo's existing citation, re-verifiable against the article,
  not as something this pass confirmed.
- **Apple, WWDC23 spatial design sessions** — *Principles of spatial design*,
  *Design for spatial user interfaces*, and *Design considerations for vision
  and motion*. Used for three principles and no numbers: place primary content
  inside a comfortable field of view; size targets by visual angle rather than
  by a linear size, because a linear size is correct at exactly one distance;
  and do not move content relative to the person. The first and third are what
  §4 is built on; the second is what `spatialTarget.minAngleDeg` exists for.
- **Meta, comfort guidance for VR** — used for the seated-learner model and for
  the near-field floor: keep the camera under the user's control, keep primary
  content within a comfortable head-and-eye range, and keep interactive content
  out of the near-field zone where vergence and accommodation disagree.
  `spatialDistance.nearInteraction.min = 0.45` and `comfortableUI 1.25–2.0` are
  this repo's expression of it. Specific Meta thresholds are not quoted because
  the page was not fetched in this pass.
- **WCAG 2.2 SC 2.5.8 Target Size (Minimum)** —
  <https://www.w3.org/TR/WCAG22/>. Level **AA**, confirmed from the fetched
  document's "New Features in WCAG 2.2" list. The 24×24 CSS-pixel threshold and
  the five exceptions (spacing, equivalent, inline, user agent control,
  essential) are named from the repo's own citation
  (`targets.floor: '24px' // WCAG 2.2 SC 2.5.8 AA floor`) because the fetched
  page truncated before §2.5.8; the normative wording was not retrieved.

  The bridge to a headset is worth stating precisely, because it is the one
  place a 2D standard and a spatial token can be compared. The W3C document's
  own gloss defines a CSS pixel as "visual angle of about 0.0213 degrees", so
  24 CSS px is **0.51°** of visual angle at the reference viewing distance. The
  spatial floor this feature uses is 4°, roughly 7.8× that — and WCAG 2.2 sets
  no angular requirement for head-mounted displays, so 2.5.8 is a floor the
  spatial board clears by construction and not a target it can be designed
  against. The 4° figure comes from the ViroReact spatial layout token set, as
  `spatial-tokens.ts` records; it is not Apple's, Meta's or the W3C's.

## §8 What only a headset can answer

ADR-117 §"Not verified" holds the rendering and performance list. These are the
human ones, and the first device session should be built to answer them in this
order:

1. Can a child find the pen without reading? (Blocks K–2 entirely.)
2. Is a 3.82° key pressable with a controller ray, and what does a miss do?
3. Is a 1.57 mm polyline legible as handwriting at 1.5 m? (ADR-117's trigger.)
4. Does Recenter put the board where the child expects, including after a swivel?
5. Does a child believe the board in the headset is the same board as on the
   laptop — and does anything they see contradict that belief?

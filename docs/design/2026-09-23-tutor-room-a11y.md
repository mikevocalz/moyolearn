# The tutor-room plate hid its own controls

Branch `fix/tutor-room-plate-a11y`, off `upgrade/expo-sdk-58-beta` at `719e2be`.
Surface: chapter 05 of the marketing site — `apps/web-vite/src/components/chapters/natalie-surface.tsx`,
rendered inside `tutor-room.tsx`, visible at `/` and in isolation at `/chapters-lab`.

## The defect

`NatalieSurface` returned its whole live plate under one attribute:

```tsx
<View className="moyo-tutor-room-plate-body" aria-hidden>
```

Inside that container sit the three action buttons — "Give me a hint", "Explain
it another way", "I think I got it" — the mute toggle, and the caption Natalie's
line is written into. `aria-hidden` is inherited by the whole subtree and a
descendant cannot opt out of it, so all four controls were absent from the
accessibility tree while remaining in the tab order. A keyboard screen-reader
user could reach four controls the reader could not name. That is WCAG 4.1.2
(Name, Role, Value, Level A), and it takes 1.3.1 and 4.1.3 with it — the caption
was hidden too, so the output of pressing a button was unannounced as well.

The symptom that surfaced it was the Playwright harness at
`apps/web-vite/e2e/natalie-cold-resolve.mjs`, which had to locate the button by
text because `getByRole` returned nothing. Its comment named the cause
correctly and routed around it:

> A text locator, not `getByRole`. The whole tutor-room plate is marked
> `aria-hidden`, so its controls are absent from the accessibility tree — a
> real accessibility defect on that surface, and one this harness only has to
> route around rather than rely on.

## What the `aria-hidden` was protecting

It was deliberate, it was correct when it was written, and it was inherited onto
the wrong object.

`tutor-room.tsx` states the intent in its own header, about the STATIC plate:

> It carries `aria-hidden` because it makes no claim, and the claim it will
> eventually illustrate — `site.room.embodiment.*`, in the roadmap tense the law
> requires — is docked to its bottom edge as real text.

That plate is a flat token composition: three coloured blocks and an empty
outlined aperture reserving space for a Phase 2 render that does not exist. It
announces as a run of unlabelled boxes and says nothing the dock below it does
not say better in prose. Hiding it was right.

What changed is that `cd30d4a` ("Add baked voice alignment and lip-sync for
Natalie") introduced `moyo-tutor-room-plate-body` — a live plate with a WebGL
canvas AND a control bar — and carried the attribute across from the thing it
replaced. The intent behind it, "stop a screen reader reading geometry", still
holds for the canvas. It never held for the buttons that arrived underneath.

So the fix is not deleting the attribute. It is hiding what is decorative at the
decoration, and leaving everything interactive outside the hidden subtree —
because `aria-hidden` is inherited and `aria-hidden="false"` on a descendant
does not re-expose anything.

## Does `PlaceholderPlate` keep its own?

Yes. Its `aria-hidden` stays, and the reasoning is the opposite of the live
plate's.

`PlaceholderPlate` is pure decoration: four nested `View`s carrying colour and
border tokens, no text, no control, no state. It renders in three situations —
tier C, the pre-mount state, and as the `Suspense` fallback while the WebGL
chunk loads — and in none of them does it hold anything a reader could act on.
Its meaning is carried by `site.room.embodiment.*` in the dock beside it, which
is real text in the reading order already. A decorative container legitimately
carries `aria-hidden`; a control container does not. That distinction is now
written into the component so the next person does not have to re-derive it.

## The fix

Four files, all under `apps/web-vite/`.

**`natalie-scene.tsx`** — `aria-hidden` moves onto the R3F `<Canvas>` itself.
The render is the decorative half and it is decorative wherever it is mounted,
so it hides itself rather than making every caller remember to. R3F spreads
unrecognised props onto its container `<div>`, so this costs no wrapper element
and no layout change.

**`natalie-surface.tsx`**
- `aria-hidden` off `moyo-tutor-room-plate-body`; `role="group"` with
  `aria-label="Natalie preview"` in its place, so the four controls and the
  caption announce as one named instrument rather than as loose buttons in the
  middle of a marketing chapter.
- The caption gets `role="status"` + explicit `aria-live="polite"` — the pairing
  `apps/web/components/auth/LoginContent.tsx` already uses for the sign-in
  notice, chosen there because react-native-web does not always map the role to
  a live region on its own. Following the existing pattern rather than inventing
  a second one.
- The caption region is now mounted whether or not there is a caption. A live
  region that arrives in the DOM at the same instant as its text announces
  inconsistently, and this caption cycles: the scene clears it to `''` on
  completion, so every line after the first would have been a fresh insertion.
- The `voice unavailable` notice gets the same `role="status"` treatment.
- `PlaceholderPlate` keeps its `aria-hidden`, now with the reason written down.

**`chapters.css`**
- `.moyo-tutor-room-caption` keeps placement, stacking and pointer behaviour —
  all true of an empty region — and its paper/rule/padding chrome moves to a
  `--spoken` modifier. Same declarations, same values, applied only when there
  is a line to put on them, so a permanently-mounted empty region draws nothing.
- `.moyo-tutor-room-plate-art > :only-child` becomes
  `.moyo-tutor-room-plate-art--live > :first-child`. The old selector silently
  stopped matching whenever the caption appeared beside the canvas, so the stage
  changed sizing rules depending on whether Natalie was mid-line; a permanently
  mounted caption would have made it dead rather than intermittent.

**`tutor-room.tsx`** — the header sentence that documents the static plate's
`aria-hidden` now says plainly that it applies to the static plate only. That
sentence is the reason the wrong half got hidden once.

## WCAG 2.1 AA findings

Standard: WCAG 2.1 AA. Surface: the live tutor-room plate at 1280×900.

| # | Criterion | Level | Severity | Before | After |
|---|---|---|---|---|---|
| 1 | 4.1.2 Name, Role, Value | A | Blocker | Four controls inside an `aria-hidden` subtree — present to the keyboard, absent from the accessibility tree | All four expose `button` + name; `getByRole` resolves each to exactly 1 node |
| 2 | 4.1.3 Status Messages | AA | High | The caption — the entire output of pressing a button — was inside the hidden subtree and never announced | `role="status"` + `aria-live="polite"`, region mounted before it has content |
| 3 | 1.3.1 Info and Relationships | A | High | No programmatic relationship between the controls and what they drive | `role="group"` named "Natalie preview" wraps caption + controls |
| 4 | 2.4.7 Focus Visible | AA | — | Ring present and painting | Unchanged behaviour, stronger colour (below) |
| 5 | 1.4.11 Non-text Contrast | AA | Medium | Focus ring `ring-focus/50` over near-white ≈ **2.97:1**, under the 3:1 a focus indicator needs | `ring-focus` at full alpha ≈ **13.0:1** |
| 6 | 2.5.3 Label in Name | A | — | Mute toggle's visible label is its accessible name, but nothing reached the tree | Name flips "Mute Natalie" ⇄ "Unmute Natalie" and is queryable |
| 7 | 2.5.5 Target Size | AAA | — | `min-h-target-adult` | Unchanged — measured 44px min-height, 47px rendered |
| 8 | 1.1.1 Non-text Content | A | — | Canvas hidden as part of a blanket hide | Canvas hidden deliberately, at the canvas |

Contrast arithmetic for #5, both sides computed from the values the built
stylesheet actually resolves — `--color-focus` is remapped to
`--color-moyo-primary` `#3C2357` inside the site scope, and the controls bar is
`--color-moyo-paper-raised` `#FFFCF2` behind a `#fff` 2px ring offset:

- `color-mix(in oklab, #3C2357 50%, transparent)` composited over `#fff` →
  `#9E91AB`, relative luminance 0.304, contrast **2.97:1** against white. Fails.
- `#3C2357` at full alpha, luminance 0.0285, contrast **13.4:1** against the
  white offset and **13.0:1** against the paper-raised bar. Passes.

The right home for #5 is `packages/ui/Button.tsx`, where one class would fix
every surface in the product at once. This branch is scoped to
`apps/web-vite/`, so the site pays for it locally via a `FOCUS_RING_CLASS`
constant and the kit-wide fix is listed under "Left undone" below.

## The plate as an interactive region (heuristics)

⚠️ Works, with two rough edges that are not this branch's to fix.

**H1: Visibility of System Status**
- The caption is the only feedback that a press did anything, and before this
  change it reached sighted users only. It is now announced as well as drawn.
- `voice unavailable` appears bottom-left of the control bar in danger tone. It
  is honest, but it is also the only signal that the voice path degraded, and it
  carries no recovery. That matches the chapter's one-voice guard — silence is
  the sanctioned fallback — so it stays as-is.
- The active button flips to `primary` while its line plays, which is the
  clearest status cue on the surface. Colour is not the only carrier: the other
  three go `aria-disabled` at the same moment.

**H3: User Control and Freedom**
- There is no stop. Pressing an action disables all three until the line
  finishes, so the only exit from a 4.5-second clip is the mute toggle, which
  pauses the audio but not the performance. Muting mid-line is the closest thing
  to a cancel and it is not labelled as one.

**H4: Consistency and Standards**
- The mute toggle is a plain button whose label flips. That is a legitimate
  pattern and the accessible name follows it correctly, but the kit has a
  `Switch`; a reader gets "button, Mute Natalie" rather than a pressed state.
  Correct and slightly less informative than it could be. Left alone — swapping
  the control is a design change, not an accessibility fix.

**H6: Recognition Rather Than Recall**
- The three labels are written from the child's side of the screen — "Give me a
  hint", not "Trigger hint response". They read as the thing a learner would
  say, which is what makes them work with no instructions above them.

### Priority Actions
1. Expose the controls and announce the caption. (Done.)
2. Give the running line a stop, or label the mute toggle as the way out.
3. Reconsider the mute toggle as a `Switch` so its state is announced.

## Keyboard and focus

Measured in Chromium at 1280×900 on the built output, tabbing from the first
control:

| Tab | Accessible name | x | y | min-height | rendered |
|---|---|---|---|---|---|
| 1 | Give me a hint | 281 | 480 | 44px | 47px |
| 2 | Explain it another way | 281 | 551 | 44px | 47px |
| 3 | I think I got it | 281 | 621 | 44px | 47px |
| 4 | Mute Natalie | 281 | 691 | 44px | 47px |

Tab order matches visual order — same x, strictly increasing y, in the order
`PRESENCE_ACTIONS` declares them. Nothing else in the plate is focusable: the
canvas is `aria-hidden` with no `tabIndex`, and the caption region is a `div`.

The buttons stay focusable while a line plays. `Button` sets `aria-disabled`
rather than the `disabled` attribute and drops its press handler, so a busy
control keeps its place in the tab order and still announces its name and state
— which is the behaviour to want, not a bug.

Focus indicator, computed after the button's `transition-all` settles:

```
box-shadow: rgba(0,0,0,0) 0 0 0 0, rgba(0,0,0,0) 0 0 0 0,
            rgb(255,255,255) 0 0 0 2px,   /* ring offset */
            rgb(60,35,87)   0 0 0 4px,    /* --color-focus */
            rgb(23,19,16)   4px 4px 0 0   /* the resting card shadow */
```

One correction worth recording, because it nearly became a wrong finding: read
immediately after `Tab`, the same computed `box-shadow` reported all four ring
layers as transparent, which looks exactly like "the focus ring does not paint."
It was the first frame of the button's own `transition-all duration-fast`. An
800ms settle produced the values above. Any focus-ring check on a kit control
has to wait out that transition.

## Visual check

The requirement was that the fix not change how the surface looks. Two
independent pieces of evidence:

**Geometry.** The same script ran against a build of `719e2be` and a build of
this branch, measuring bounding boxes on `/chapters-lab`:

| Element | Before | After |
|---|---|---|
| `.moyo-tutor-room-plate` | x 265.3695983886719, y 2178.675048828125, 749.2607727050781 × 1074.80615234375 | identical |
| `.moyo-tutor-room-caption` (with a line) | x 268, y 782.34375, 744 × 46.890625 | identical |
| `.moyo-tutor-room-controls` | x 260, y 837.234375, 760 × 331.890625 | identical |

Identical to the fraction of a pixel, including the caption card — which is the
element whose CSS was split in two.

**Pixels.** Element screenshots of the plate mid-caption, before vs after,
768×1143. Differing rows are confined to the WebGL render: rows 168–516, inside
the canvas, where the idle-breath frame differs between two runs and always
will. Below row 560 — the caption's bottom rule, the whole control bar, the four
buttons and the dock — **6 differing pixels out of ~448,000**, all
anti-aliasing on one rule line.

The permanently-mounted empty caption region measures 744 × **0** px at rest and
carries none of the paper/border/padding chrome, which is what keeps it from
drawing an empty box over the render.

## Verified by running something / reasoned from the DOM

The split matters, so it is stated rather than implied.

### Ran it, against the built site

Playwright's Chromium was already on the machine — build 1234 in
`~/Library/Caches/ms-playwright`, driven through the workspace's own Playwright
via an explicit `executablePath` because the installed driver wants build 1243.
No browser was downloaded. The site was built with `pnpm exec turbo build` and
`.output/public` served from a local static server; `app.moyolearn.com` was
routed to abort, so every run below is the voice-unavailable path.

- **`getByRole` reachability.** All four controls resolve to exactly 1 node
  each by role + exact accessible name. This is the harness's blocker, gone.
- **No `aria-hidden` ancestor over the buttons.** Walked the parent chain from
  the hint button to the document root looking for the attribute in any form:
  `null`.
- **The canvas is hidden.** `aria-hidden="true"` on the R3F container div.
- **The live region.** `role="status"`, `aria-live="polite"`, empty text and 0px
  height at rest; `--spoken` class, 3px border, `rgb(247,241,227)` background,
  12px padding and the caption text while a line plays.
- **Accessible-name flip.** With the toggle at rest, `Mute Natalie` → 1 node and
  `Unmute Natalie` → 0. After clicking it: 0 and 1. The name follows state.
- **Tab order and target size.** The table above; four `Tab` presses, reading
  `document.activeElement` each time.
- **Focus ring.** Computed `box-shadow` after a real keyboard focus, with
  `:focus-visible` confirmed matching.
- **Geometry and pixels.** Two builds, same script, numbers above.
- **The resulting tree**, printed from `ariaSnapshot()` on the plate:

```
- group "Natalie preview":
  - status: Try looking for the part that matches what the question is asking.
  - button "Give me a hint" [disabled]
  - button "Explain it another way" [disabled]
  - button "I think I got it" [disabled]
  - button "Mute Natalie"
  - status: voice unavailable
```

### Reasoned from the DOM and the CSS, not executed

- **No screen reader was run.** Nothing here is a VoiceOver, NVDA or JAWS pass.
  What is verified is the accessibility tree Chromium computes and the ARIA
  semantics it exposes; what a given reader chooses to speak, and when, is not.
- **Live-region announcement is inferred, not heard.** That `role="status"` +
  `aria-live="polite"` exists, is mounted ahead of its content, and receives a
  text change is measured. That a screen reader speaks it is the expected
  behaviour of that pattern, not something this pass observed.
- **Chromium only.** The harness supports WebKit; this check did not run it.
  Safari + VoiceOver is the combination most likely to differ on live regions.
- **Contrast numbers are computed, not sampled.** The colour values come from
  the built stylesheet and the browser's computed styles; the luminance and
  ratio arithmetic is mine, not a contrast tool's screen reading.
- **`aria-hidden` inheritance** is applied as specification behaviour — a
  descendant cannot re-expose itself — rather than tested with a counter-case.
- **Native React Native is untouched and unchecked.** This surface is web-only
  (`apps/web-vite`), and `View`/`Button` map to real `<div>`/`<button>` there.
  Nothing was verified about the native fork.

## Left undone

- **`packages/ui/Button.tsx` still ships `focus-visible:ring-focus/50`**, which
  is the ~2.97:1 indicator on any near-white surface in the product. Fixed
  locally on this surface only, because the branch is scoped to the site. One
  class in the kit closes it everywhere and should.
- **`apps/web-vite/e2e/natalie-cold-resolve.mjs` was not rewritten**, as
  instructed. Its `getByRole` workaround is now unnecessary — the locator
  `page.getByRole('button', { name: 'Give me a hint', exact: true })` resolves,
  verified above. Its `page.mouse.click()` should stay regardless: that is about
  user activation for `play()`, not about the accessibility tree.
- **No stop control for a running line**, and the mute toggle is a button rather
  than a `Switch`. Both are design calls, listed under Priority Actions.

# Tutor session, thread-first — and where the pane docs now stand
**Date:** 2026-09-03 · **Status:** built; one delta open for Mike
**Surfaces:** S9 `TutorStage` (`packages/ui/TutorStage.tsx`) · `packages/ui/adaptive-panes`

<!--
What it is: the record of what changed on the tutor session on demo eve, the
restoration of the split-view collapse controls, and the honest accounting of
where the result agrees and disagrees with the pack.
Why it exists: one of the changes touches a doc-23 layout rule and the pane work
touches ADR-107's territory. Silently shipping a shape a doc forbids is how a
pack stops being true; this file is the disagreement, written down.
SOT: docs/pack/23-tutorstage-handoff.md §5 · docs/pack/37-onboarding-dual-pane.md §3.2 §3.3 ·
     docs/pack/02-adaptive-screens-design-spec.md §2.1 §4.1 ·
     docs/decisions/adr-107-learner-pane-ban-reaffirmed.md
SOT-KEYWORDS: tutorstage thread first work in turn live turn legendlist
              pane toggle collapse controls learner pane ban spec delta
-->

## Part 1 · Header titles read from the leading edge

`ShellHeader` (apps/mobile) already reads brand-or-chevron leading, title left,
avatar trailing. `SessionToolbar` was the one bar in the product that centred its
title between the back chevron and the CC button, so walking from a tab into the
tutor session moved the screen's name. It now uses the same grammar: chevron
leading, `flex-1` left-aligned title, actions trailing. `Toolbar` and
`DetailNavbar` already left-aligned and were not touched.

Left-alignment is also the only arrangement that survives a long session title —
a centred title is squeezed from both sides by whatever the two edges happen to
hold, while a left title truncates predictably at the actions.

## Part 2 · The split-view collapse controls, restored

**What the prior art was.** `PaneToggle` (`packages/ui/adaptive-panes/PaneToggle.tsx`)
plus its whole precedence policy (`pane-overrides.ts`, `pane-overrides.store.*`,
`pane-overrides.test.ts`, `use-pane-visibility.ts`) came across in the promotion
commit `11123ed` — *"PR-146: the split-view leaves the phone — AdaptivePanes is
kit, cross-platform, and finally mounted"* — reimplementing the working local
Android layout that doc 37 §3.2 describes as having "explicit expand/collapse
controls", with `craftzdog/inkdrop-ui-mockup-react-native` cited as the collapse
choreography's prior art in the module README.

**What was actually wrong.** The controls were never removed and were never
broken. They were **built, exported, unit-tested and rendered by nothing** — a
`grep` for `PaneToggle` outside the module returns zero call sites. The panes
could be collapsed by resizing the window and by no other means, which is
exactly why they read as missing.

**What I did: restored, not redesigned.** `PaneToggle` is now mounted by the
`AdaptivePanes` host itself, in a control row at the head of the detail pane.
The host, not a screen: the first attempt put them in `DetailNavbar` (which
every pane host already draws) and that bar only exists once a row is selected —
so the controls vanished exactly when a user most wants to widen an empty detail
pane. No new component, no new state, no new policy: `resolvePaneVisibility` and
the size-class-scoped override store were already there and are unchanged. Each
toggle renders `null` in any size class that cannot show its pane, so `medium`
gets one button and `compact` gets none.

**Verified** in Storybook (`Interaction/AdaptivePanes → HostTwoPaneWithSelection`,
1440×900): controls present with nothing selected; "Hide sidebar" collapses the
primary pane and the control flips to "Show sidebar"; clicking again restores it.
Round trip, both directions.

**Three columns already exist** and were not the missing piece:
`VISIBILITY_THREE_COLUMN` in `constants.ts` gives primary + supplementary +
detail at `columnCount: 2`, with the inspector as a fourth, drawer-presented
surface. Doc 02 §2.1 budgets 2–3 panes at `expanded` and 3 at `large`, so this is
within the doc. The Expo Router SplitView constraint doc 02 §2.2 names ("up to
two columns before content + trailing inspector") does **not** bind us: doc 37
§3.2 defers that alpha renderer, and `AdaptivePanes` is the local layout on every
platform. No screen mounts the three-column shape today; the capability is real
and available to the adult surfaces the pane docs address.

## Part 3 · The tutor session became one thread

### What changed
1. **The work is content of a turn.** The problem and the learner's photo
   (`TutorWorkCanvas`) were the contents of a second pane. They are now the
   `media` of a `MessageBubble` — the work rides inside the turn that raised it.
   `TutorWorkCanvas` itself was reused, not rebuilt; its root went `flex-1` →
   `w-full`, because it was written to fill a pane and there is no pane.
2. **The live turn is the last row of the list.** It rendered outside the scroll
   view, in a fixed band between the thread and the composer — permanent height,
   and the newest words on screen were the one thing a child could not scroll to.
   It is now a real ROW of the same `VirtualList` (LegendList on native,
   `@tanstack/react-virtual` on web): `TutorThread`'s data is a small union,
   `{ kind: 'message' } | { kind: 'live' }`, so the live turn keeps its own shape
   (a hint with its ladder, a diagnosis with its badge) without being forced into
   `TutorMessage` and without an invented id. `showsVerticalScrollIndicator` is
   off. The thread's `px-inset py-1` is untouched.

   Three things were tried on the way and taken back out, each because the DEVICE
   disagreed with the reasoning, and each is written into the file so nobody
   re-adds it: `ListFooterComponent` (LegendList clamps the scroll range to the
   rows it knows about, so a tall footer made the history unreachable);
   `alignItemsAtEnd` (left the list unscrollable outright); and
   `maintainScrollAtEnd` (its layout triggers fire on every streamed token, so
   the list yanked back to the bottom the instant a child scrolled up — being
   able to re-read her mid-utterance beats landing at the end).
3. **`TutorThread` clips.** An Android `View` does not clip by default, so the
   list drew past the box flex gave it and the turn beneath rendered over the
   spill. `overflow-hidden` on the thread root fixes that AND is what gives the
   list a viewport at all on this screen — removing it to test whether the clip
   was still needed rendered the whole conversation at content height with
   nothing to scroll within.
4. **Natalie did not move.** `TutorPresence` stays at the head of the spine. The
   only change to it is **alignment**: the card used to be an identity row with
   the assurance sentence full-width beneath, so the "Show Natalie" control
   centred against the identity row while the card grew taller underneath it. The
   sentence is now nested inside the identity column, so mark, words and control
   sit in one `items-center` row and the control is level with the name beside
   it — whether or not the sentence is there.

**No colour changed anywhere.** No pane, bubble or bar was re-tinted; the only
theme addition is a width container token, and it is currently unused (see
below). Depth on this surface still comes from the existing `surface` /
`surface-sunken` / `surface-ai` steps.

### What width buys now
One thing: a centred, measure-capped conversation. Doc 23 §5's second column
existed to hold the work; the work is in the thread, so the column has nothing to
hold and is gone rather than left standing empty — the same reasoning that had
already made it opt-in (an empty bordered box beside a 380pt thread reads as the
box being the subject of the screen).

**And that is the answer to the three-column question on this surface.** The
columns were going to be conversation · work · Natalie. With the work inside the
conversation there is no second thing, so a third column could only be filled by
inventing content to fit a shape. Two would have been a stretch; three would have
been a fiction. If a rendered Natalie ever earns a column of her own, that is a
decision to make with the ADR below in hand, not a layout to pre-build.

### The delta, stated plainly

| Doc | What it says | What is built | Status |
|---|---|---|---|
| doc 23 §5 | medium+ is **two columns**, `380px` + `1fr`, right = `LearningCanvas` | Single spine at every width; the work is a turn. | **Delta — needs Mike.** The doc's intent (the work gets real estate at width) is met differently: the work gets the full measure of the thread instead of half the window. Recommendation: amend §5. |
| doc 37 §3.3 / ADR-107 | "Learner: never" — no `AdaptivePanes`, no split view, no two-pane composition on a learner surface | The tutor session is now single-column at every width. | **Newly compliant.** It was in breach while doc 23 §5's split shipped; this closes it rather than widening it. |
| doc 02 §4.1 | "a child never gets the Triptych" | Honoured, and then some. | Consistent. |
| doc 02 §2.1 | pane budget by width class | Untouched for the tutor; `AdaptivePanes` unchanged and still within budget. | Consistent. |

### Loose end, named rather than left
`packages/theme/tokens.ts` gained `'pane-tutor-stage': '20rem'` while a trailing
presence column was being explored. That column is not shipped, so the token is
currently unused. It is left in place deliberately as the sized slot the avatar
ADR's option B would need — if that ADR is rejected, delete the token.

## Verified
- Web (Chrome via Playwright, `apps/web` at :3000) at 1440 / 1080 / 390: header
  title left; presence card at the head of the spine with the control centred;
  work inside the last turn; live turn **inside** the scroll container (asserted
  in the DOM: one scroller, `liveInsideScroller: true`, `scrollbarWidth: none`);
  single spine at every width; no console errors.
- Storybook at 1440: pane collapse controls present, collapsing and restoring.
- Surface Duo `913949703467` (2700×1800 @ density 400 = **1080dp × 720dp**
  spanned): header title left; presence card with its control level with the
  name; work inside the last turn; the live turn present in the accessibility
  tree **as a child of the thread's `ScrollView [scrollable]`**, which is the
  device-side proof that it is a row and not a band; composer pinned; no
  overlap. Open item, stated rather than glossed: I could not get a long-thread
  scroll-back to reproduce on device at the end of the pass, because every JS
  reload rehydrated the session with only its last few turns, so the content fit
  the viewport and there was correctly nothing to scroll. The list reports
  `[scrollable]` and scrolled earlier in the same pass; a long-session scroll is
  worth one more look with a seeded thread.

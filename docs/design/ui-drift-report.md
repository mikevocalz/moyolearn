# UI drift: how far call sites have wandered from the kit

**Date:** 2026-08-26 · **Status:** measurement, not a plan
**Measured by:** `pnpm ui:sweep` (`tooling/ui-sweep.mjs`) · re-run it before trusting any figure below
**Scope:** `packages/app`, `packages/ui`, `apps` — `.ts` and `.tsx`, excluding `node_modules`, `.next`, `dist`, `.expo`

This report measures the "UI" and "Patterns are law" sections of `CLAUDE.md` against
what the code actually does. It proposes nothing; the migration plan is a separate
document and is gated on approval.

**Conclusion up front: `Heading` and `Text` are two different problems wearing the
same symptom.** Both show the same drift — a call site takes a kit component and
then re-specifies its own type scale in `className`. But `Heading`'s 50 overrides
collapse into **10 distinct strings, six of which cover 92%**, while `Text`'s 287
classifiable overrides spread across **113 distinct strings whose top six cover only
31%**. Heading is a small, closed set that a sweep can retype. Text is a genuine long
tail, and some fraction of that tail is probably legitimate per-site styling rather
than drift. Any remedy that treats them as one category will over-fit the first and
mangle the second.

## Methodology, and a correction to the earlier numbers

An earlier run of these probes omitted the `node_modules` exclusions. Grepping
`packages/app` recursively descends into `packages/app/node_modules`, so React
Native's own `.d.ts` typings were counted as application code. That run reported
**30 `FlatList` violations. The true count is 0.** The same fault inflated
`KeyboardAvoidingView` and `<div>`.

That is the reason this analysis is a checked-in script rather than a grep someone
retypes: the exclusions are load-bearing, and a missing one turns a clean result into
a fabricated crisis. **Every figure in this document excludes `node_modules`,
`.next`, `dist`, and `.expo`**, and every one of them was reproduced by running
`pnpm ui:sweep` while writing this.

Three limits on the numbers are worth stating rather than burying:

The drift probes count `.ts` and `.tsx`; the repetition pass reads `.tsx` only, and
only single-line double-quoted `className` attributes. That is most of the 357-vs-287
gap for `Text` — template literals, `cn(...)` composition, and multi-line attributes
are counted as drift but not classified.

The `<Text[^>]*className=` regex also matches `<TextField`, `<Textarea`, and
`<TextInput`. Exactly **one** such site exists, so the contamination is 1 in 357 and
does not move any conclusion.

The `moti` result below is not one of the nine probes in `ui-sweep.mjs`; it was
checked separately with the same exclusion set. If it matters going forward it should
be added to the script, because a rule nobody measures is a rule that quietly lapses.

## What the type-scale overrides actually are

Of `Heading`'s 50 overrides, **48 touch the type scale** — `text-*`, `font-*`,
`leading-`, or `tracking-`. Against 60 total `<Heading>` call sites, that is **80% of
every heading in the product restating its own size instead of naming a variant**.
For `Text`, 279 of 287 classifiable overrides touch the type scale. This is not
incidental spacing or a one-off color; it is the type system being re-entered by hand
at the call site.

The two distributions are what separate them:

| | overrides | distinct strings | touch type scale | top 6 cover |
|---|---|---|---|---|
| `Heading` | 50 | 10 | 48 | **92%** |
| `Text` | 287 | 113 | 279 | **31%** |

Heading's ten strings, in full:

| count | string |
|---|---|
| 16 | `text-2xl font-semibold text-text md:text-3xl` |
| 15 | `text-2xl font-semibold text-text` |
| 8 | `text-xl font-semibold text-text` |
| 4 | `font-display text-3xl font-bold text-text` |
| 2 | `font-sans text-lg font-bold text-text` |
| 1 | `text-text` |

Reading those against `packages/ui/Heading.tsx` sharpens the picture. The component's
`size="title"` variant is defined as `text-2xl font-semibold md:text-3xl`, and its
`base` already carries `text-text`. **The top string is that variant, retyped
character for character with a redundant tone.** The second is the same thing with
the responsive step dropped — which, if unintentional, means those 15 headings stop
growing at `md` while the 16 next to them do not. Together those two strings are 31 of
50 overrides. The remaining three shapes (`text-xl`, `font-display text-3xl
font-bold`, `font-sans text-lg font-bold`) have no exact variant today; the last of
them overrides `font-display` back to sans, which is a deliberate-looking choice
someone made twice.

Text's top six, by contrast, are six different points on the ramp
(`text-caption text-text-muted` ×41, `text-label text-text` ×13, `font-sans text-body
text-text` ×9, `text-xs text-text-muted` ×9, `font-mono text-caption text-text-muted`
×9, `text-body text-text` ×9), and they account for under a third of the total. Worth
noting for whoever writes the plan: those strings reach for the **UI ramp tokens**
(`text-caption`, `text-body`, `text-label`) while `Text.tsx`'s `variant` prop maps to
raw Tailwind steps (`caption` → `text-sm md:text-base`). Two type systems are in play
in the same component, and the call sites have been choosing the token one. Whether
that is drift or a signal about which system won is not something this measurement can
settle.

## Categories, ranked by impact × how mechanical a fix would be

Ranked highest-leverage first. "Product" excludes `.stories.` and `.test.` files.

**1 · `Heading` type-scale overrides — 50 hits / 23 files / 44 product.** Highest
ratio in the report. Impact is product-wide type consistency; the fix surface is ten
strings, six of which are 92% of it, and the largest two map onto a variant that
already exists. This is the one category where a mechanical sweep plausibly clears
nearly all of it.

**2 · Numeric `gap-N` instead of a named tier — 394 hits / 116 files / 309 product.**
Largest count in the report, and the tiers it bypasses are not cosmetic:
`packages/theme/tokens.ts` defines `element`/`stack`/`group`/`section` with distinct
*cool* and *hot* values, so a hardcoded `gap-4` is spacing that cannot respond to the
age-band dial. The same token block records that the `gap-` prefix must not be part
of the token name, because `--spacing-gap-stack` would yield `gap-gap-stack` and every
`gap-stack` in the codebase would silently do nothing — evidence this exact area has
already produced one silent failure. **Unverified: the 309 product hits were not
spot-checked.** Some will be inside `packages/ui` where a component's internal
composition may legitimately not want a semantic tier, and some may be web-only
surfaces outside the dial. Treat 309 as an upper bound on drift, not a defect count.

**3 · `Text` type-scale overrides — 357 hits / 119 files / 225 product.** Largest
type-scale surface, but 113 distinct strings with a 31% top-six share means there is
no small set of missing variants to add. The Heading remedy does not transfer. Expect
a real fraction of this tail to survive review as intentional.

**4 · Arbitrary Tailwind values — 11 hits / 9 files / 8 product.** Tiny and almost
entirely mechanical, but it contains the report's only violation of a stated
invariant. `tokens.ts` calls caption "the floor: never below 12," and four sites set
type below it: `text-[10px]` in `explore-content.tsx`, `TextField.tsx`, and
`Textarea.tsx`, and `text-[11px]` in `notifications-content.tsx` — the last of these
on a `<Text variant="caption">`, so a call site is explicitly undercutting the floor
the variant enforces. The rest are shape, not type: `rounded-[6px]`, `rounded-[1px]`,
`h-[3px]`, `w-[95%]`.

**5 · Hardcoded `text-white` / `text-black` — 5 hits / 1 file / 5 product.** All five
are `selectedTitle: 'text-white'` in
`packages/app/features/schedule/accent-classes.ts`. Named explicitly in `CLAUDE.md`,
confined to one file, and an inverse tone token (`text-text-inverse`, exposed as
`tone="inverse"` on both `Heading` and `Text`) already exists. Smallest, most
contained item in the report.

**6 · React `useState` — 22 hits / 16 files / 15 product.** Splits about two to one:
five in `packages/ui` (`StreamedText.tsx` ×2, `TutorStage.tsx`,
`InspectorSection.tsx`, `use-autogrow.native.ts`) and ten in `packages/app/features`,
concentrated in `capture` (four files) and `onboarding/consent` (three in one file).
The kit five are component-local instance state, which is a different question from
the feature ten. Not mechanical — each site needs a judgment about what the state
actually is.

**7 · Raw `<div>` — 10 hits / 6 files / 10 product.** Eight of the ten are inside
`packages/ui`, where the web abstraction has to bottom out in a real element:
`tw.tsx` ×3 (the primitive factory itself), `VirtualList.web.tsx` ×2,
`TrendLine.web.tsx`, `paste-wrapper.web.tsx`, and `DataTable.tsx`. Only two sit
outside the kit, both in `apps/web/app/(ops)/layout.tsx`. `DataTable.tsx` is the one
that stands out — it is not a `.web` fork, so a raw `div` there is worth a look. The
headline 10 substantially overstates the drift.

**8 · RN `KeyboardAvoidingView` — 6 hits / 3 files / 6 product. Not drift.** All six
sites were read. `packages/app/features/editor/UrlSheet.native.tsx` imports
`KeyboardAvoidingView` from **`react-native-keyboard-controller`** — the required
library — and uses it at two more lines; the remaining hits in
`packages/ui/keyboard-aware.native.tsx` and `apps/mobile/app/_layout.tsx` are comments
explaining why RN's built-in version is *not* used. The probe matches the identifier
without regard to which package it came from, so this category reads as six violations
and is in fact six confirmations. The count was correct; the label was wrong.

**The probe has since been corrected** to match the import source rather than the
identifier, so `pnpm ui:sweep` now reports 0 for this category. If you regenerate and
see 0 where this section says 6, that is the fix, not a discrepancy. The category is
kept here because a probe that flags the correct choice as a violation is the kind of
finding worth recording — it is how a report loses a reader's trust, and it very nearly
put six false accusations in front of you.

## Rules that are being followed

A rule holding is a finding, and two hold cleanly.

**`FlatList`: 0 hits.** `@legendapp/list` is the only list primitive in the codebase.
This is the number the un-excluded run got wrong by 30, and it is the cleanest result
in the report.

**`moti`: 0 imports.** No `moti` import exists anywhere in scope; motion goes through
`@legendapp/motion` and `packages/ui/motion.tsx`. Verified with the sweep's exclusion
set but *not* by the sweep itself — see the methodology note above.

The scale of the two type-scale categories should be read against that. This is not a
codebase that ignores its rules; it is one where two specific rules have no enforcement
and the rest do fine.

## What this report does not cover

`pnpm ui:sweep` also prints the kit's export inventory — 169 exports (91 value, 78
type), 33 with no consumer outside `packages/ui`, 16 with exactly one. That is a
barrel-surface question, not a drift question, and belongs in `ui-inventory.md`. Note
in particular that a zero-external-consumer export does **not** mean dead code; those
components are used inside `packages/ui` and the finding is about what the barrel
should expose.

<!--
What this is: the measured state of UI drift against the CLAUDE.md UI rules.
Why it exists: the type-scale override numbers are large enough to be misread as one
problem; the Heading/Text repetition split is the whole point of the document.
Source of truth: `pnpm ui:sweep` (tooling/ui-sweep.mjs). If a figure here disagrees
with that command, this doc is stale — the script is not.
SOT-KEYWORDS: ui drift report overrides type scale tokens heading text gap tiers audit design system
-->

## Addendum — a real contrast failure the probe found by accident

The `text-white` category was investigated during Phase 3 and turned out to be
two findings, one of which is not a styling question at all.

**It is not drift.** All five hits are `selectedTitle` in
`packages/app/features/schedule/accent-classes.ts`, and each sits on
`selectedSurface: 'bg-{accent}-500'` — a solid saturated fill that does *not*
change between light and dark. A theme-invariant background wants a
theme-invariant foreground, so `text-white` is the correct choice and
`text-text-inverse` would be the wrong one: that token flips with the theme
while the accent under it does not.

**But white does not pass on three of the five.** `EventBlock.tsx` renders the
selected title at `text-sm font-semibold` (14px) and the time line at `text-xs`
(12px). Both are body text under WCAG — the 3.0 large-text allowance needs
≥18.66px bold or ≥24px — so the bar is 4.5:

| accent | 500 | white contrast | verdict at 4.5 |
|---|---|---|---|
| ember | `#F7418F` | 3.44 | **fails** |
| sky | `#3B7EB8` | 4.32 | **fails** |
| gold | `#3B6DF6` | 4.46 | **fails**, marginally |
| rose | `#C04444` | 5.06 | passes |
| forest | `#357A49` | 5.21 | passes |

So a selected event in the schedule is below AA for three of the five resource
accents, on a product used by children.

`tooling/check-contrast.mjs` did not catch this because its `PAIRS` list is
declared rather than derived, and this pair is not in it. That design is
defensible for the reason its own comment gives — a checker that reports
impossible combinations gets muted — but it means a new colour pairing is only
enforced once somebody adds it.

**No fix is applied here.** The remedies are a design call, not a refactor:
darken the three accents, use a darker step (`600`) for `selectedSurface` while
keeping `500` for the bar and dot, or raise the selected title's size and weight
past the large-text threshold. Each changes how the schedule looks. The pairs
should be added to `check-contrast.mjs` at the same time, since adding them
first turns `pnpm lint` red until the colours move.

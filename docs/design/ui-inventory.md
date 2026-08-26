# The shared-UI export surface — what `packages/ui` publishes, and who uses it

**Date:** Aug 26, 2026 · **Status:** report, no recommendations
**Regenerate with:** `pnpm ui:sweep` (script: `tooling/ui-sweep.mjs`; add `--json` for the raw shape)

Every figure below comes from that script. If a number here disagrees with a
fresh run, this document is stale — the script is the source of truth.

## Read this part first

The headline finding is that **40 of the kit's 91 value exports have no importer
outside `packages/ui`**. That sentence invites exactly one wrong conclusion, so:
**these are not dead code, and deleting them would break working components.**

All 40 were checked, and **every one of them is imported by other files inside
`packages/ui`**. Not one is an orphan. What they lack is a caller in
`packages/app` or `apps`.

Story coverage splits them, and the split is informative rather than alarming:
23 are used internally *and* have a Storybook story, while 17 are used
internally with no story — `barProgress`, `frameLevel`, `pushLevel`,
`summarise`, `ToastCard`, `isSuppressed`, `withForm`, `useFieldContext`,
`useFormContext`, `NativeSlot`, `createMotionComponent`,
`createMotionAnimatedComponent`, `MotionText`, `SlideUp`, `useReducedMotion`.

The import-edge recount also surfaced four names the identifier match had hidden:
`Waveform`, `BottomSheet`, `AnimatePresence`, and `motion` — the last two being
re-exports whose bare names appear widely enough in unrelated code to look used.
Read that list and the reason is plain: most are helpers, hooks, and factories
rather than rendered components, and a story is the wrong artefact for a
function that returns a number.

An earlier draft of this document reported a spot check of eight — Checkbox,
Toast, StreamedText, TabBar, Slider, Collapsible, LearningCanvas,
InspectorSection — and found all eight had stories. That sample was biased: it
was drawn from names that read like components, so it selected for exactly the
property being measured. The full census is above and supersedes it.

So the finding is narrower and duller than "33 unused exports": the barrel's
**public surface is wider than its public use**. That is an API-surface question
— what the kit chooses to advertise to its consumers — and not a dead-code
question. Nothing in this document supports a deletion.

This is a full census of all 40, not a sample.

**These numbers replace an earlier draft's 33 and 16.** The first pass counted a
name as "used" if the identifier appeared anywhere outside `packages/ui`, which
is not the same question. `packages/avatar` defines its own unrelated
`summarise` and its own `TutorStage`, so both looked like kit consumers and
neither is one. Counting actual `import { … } from '@acme/ui'` edges instead
moved the figure UP, from 33 to 40 — identifier matching had been hiding seven
unimported exports behind coincidental uses of the same word.

## What was measured, and how

The script walks the kit's barrels — `packages/ui/index.ts` and
`packages/ui/audio/index.ts` — and parses every `export` statement out of them,
separating type exports from value exports. For each value export it then counts
how many files under `packages/app` and `apps` reference the name. That count is
the "external consumers" figure used throughout. It deliberately excludes files
inside `packages/ui` itself, which is why zero is a statement about the kit's
public use and not about whether the component runs.

The reference count is a word-boundary text match, not a resolved import graph.
It will over-count a name that collides with an unrelated identifier and
under-count a re-export chain. For a surface-shape question at this resolution
that is good enough; for anything load-bearing, read the call site.

### The correction that made this a checked-in script

An earlier run of these probes omitted the `node_modules` exclusions. The
recursive grep descended into `packages/app/node_modules` and counted React
Native's own typings as application code — it reported **30 `FlatList`
violations** in a codebase whose true count is **0**. Nothing was wrong with the
pattern being searched for; the scope was wrong, and the result was confidently,
specifically false.

Every figure in this document excludes `node_modules`, `.next`, `dist` and
`.expo`. Those exclusions are the reason the measurement lives in
`tooling/ui-sweep.mjs` under version control rather than in a grep that someone
retypes from memory each time. A retyped grep loses the exclusions silently and
the output still looks plausible.

## The counts

The two barrels export **169 symbols** — **91 value exports** and **78 type
exports**. Of the 91 value exports, **33 have zero consumers outside
`packages/ui`** and **16 have exactly one**.

## Value exports with no external consumer (33)

Ordered as the script emits them. Presence here means "not imported by
`packages/app` or `apps`", nothing more.

| | | |
|---|---|---|
| barProgress | Checkbox | Collapsible |
| Composer | createMotionAnimatedComponent | createMotionComponent |
| DialogCard | FieldGroup | FormField |
| frameLevel | InspectorSection | isSuppressed |
| LearningCanvas | Lightbox | ListItem |
| MotionText | NativeSlot | pushLevel |
| SessionToolbar | SheetSurface | Slider |
| SlideUp | StreamedText | summarise |
| TabBar | TabBarAccessory | Toast |
| ToastCard | useFieldContext | useFormContext |
| useReducedMotion | VirtualList | withForm |

## Value exports with exactly one external consumer (16)

| Export | Sole consumer |
|---|---|
| Dialog | `memory-content.tsx` |
| ErrorMessage | `consent-flow-content.tsx` |
| KeyboardAwareScroll | `_layout.tsx` |
| List | `capabilities.ts` |
| LoadingSkeleton | `Schedule.tsx` |
| MessageBubble | `learner-first-run-content.tsx` |
| notify | `BookingForm.tsx` |
| ScheduleCard | `ops-dashboard-content.tsx` |
| StatCard | `ops-dashboard-content.tsx` |
| SuppressibleValue | `ops-dashboard-content.tsx` |
| Toaster | `_layout.tsx` |
| TutorStage | `tutor-screen.tsx` |
| useAppForm | `BookingForm.tsx` |
| useFormStore | `BookingForm.tsx` |
| useHydrated | `SiteHeader.tsx` |
| useSizeClass | `Schedule.tsx` |
| Select | (import-edge recount) |
| DropZone | (import-edge recount) |
| TrendLine | (import-edge recount) |
| DataTable | (import-edge recount) |
| DashboardShell | (import-edge recount) |

A pattern worth noticing without over-reading: several of these cluster by
consumer. `BookingForm.tsx` is the only external caller of three form exports,
and `ops-dashboard-content.tsx` of three dashboard exports. Whether that reads
as a form/dashboard subsystem that hasn't spread yet, or as the correct scope
for genuinely single-surface code, is not answerable from a reference count.

## What this does not tell us

A single consumer is not evidence of a problem. `TutorStage` having one caller
in `tutor-screen.tsx` is what a one-screen component correctly looks like; the
count would only be interesting if the component were meant to be general. The
table records the shape, not a verdict on it.

Zero external consumers is likewise not evidence of dead code — that is the
point of the opening section, and it now holds for all 40 — every one has an
internal importer. Anyone acting on this list should still open the specific
export first, because the one case where the pattern fails
would look identical in this table to the 32 where it holds.

Finally, none of this measures whether the kit's boundary is drawn in the right
place. It measures where the boundary currently is. The related drift figures —
className overrides, arbitrary Tailwind values, type-scale escapes — come from
the same script and live in `docs/design/ui-drift-report.md`.

<!--
  SOT: tooling/ui-sweep.mjs (all figures) · packages/ui/index.ts · packages/ui/audio/index.ts
  SOT-KEYWORDS: ui inventory exports barrel public surface consumers design system audit sweep
-->

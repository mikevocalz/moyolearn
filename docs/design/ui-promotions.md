# Kit Promotions, Narrowings, and Deliberate Non-Actions

**Design note · Moyo platform pack · Date:** Aug 26, 2026

> **Status: PROPOSAL. Nothing in this document has been executed.** No component was
> changed, no export was removed, no call site was migrated. Every count below was
> measured against the working tree as it stands today, and the tree is unchanged by
> the writing of this file. Read it as an argument, not a changelog.

**Scope:** what belongs in `packages/ui` that isn't there yet, what is in its public
barrel that shouldn't be, and — the part that usually gets skipped — what looks
promotable but should be left exactly where it is.

**Ground truth:** `packages/ui/index.ts`, `packages/ui/Heading.tsx`,
`packages/ui/Text.tsx`, `packages/ui/tv.ts`, `packages/theme/tokens.ts` (`uiRamp`,
`typeScale`), `tooling/check-barrels.mjs`. Call-site counts are over `packages/**` and
`apps/**` with `node_modules` excluded.

**Governing rule (CLAUDE.md, "Patterns are law"):** *new shared logic gets globalized
into the registry or a service — never copied into a second feature.* Everything here
is an application of that one sentence. Promotion is not a reward for a component being
good; it is the remedy for a pattern that has already been copied.

---

## 0. How to read the evidence

Every proposal below is anchored to a count, not a feeling. But counts have a scope,
and the scope moves the digit, so here is the honest caveat up front.

The headline figures are the verified measurements from this session. When I re-ran the
sweep with Storybook files excluded, the Heading numbers barely moved (51 → 45 total
overrides; the top string held at 17) while the Text numbers collapsed (312 → 199 total;
the top string fell from 41 to 19). That asymmetry is not noise to be apologised for —
it is itself a finding, and section 2 leans on it. Roughly half the weight behind the
most-repeated Text string comes from stories demonstrating the ramp, which is stories
doing their job, not product code crying out for a variant.

So: treat the *shape* of each distribution as the argument and the exact digit as
approximate to about ten percent. Where a proposal survives only at one particular
scope, I say so.

For blast radius: **138 files outside `packages/ui` import `@acme/ui`** — 112 in
`packages/app`, 19 in `apps/mobile`, 5 in `apps/web`, 1 each in `packages/avatar` and
`apps/storybook`. That is the population any barrel change is measured against.

---

## 1. PROMOTE — Heading

### 1.1 The evidence, and what it actually shows

Six strings cover 92% of all 50 `Heading` `className` overrides. Four of them carry
essentially all the weight:

| Count | Override string |
|---|---|
| ×16 | `text-2xl font-semibold text-text md:text-3xl` |
| ×15 | `text-2xl font-semibold text-text` |
| ×8 | `text-xl font-semibold text-text` |
| ×4 | `font-display text-3xl font-bold text-text` |

The obvious reading is "a variant is missing." That reading is wrong, and the correct
one is worse.

`Heading.tsx` already defines `size: { title: 'text-2xl font-semibold md:text-3xl' }`
over a base of `font-display text-text`. The ×16 string is that variant, character for
character, with a redundant `text-text` re-stating the base. The variant is not missing.
It exists, it is correct, and it is being hand-copied instead of used.

`size="title"` appears **twice in the entire repository**, and one of those two is
`Heading.stories.tsx`. So the kit ships a variant with one real caller and sixteen
transcriptions of its class list.

### 1.2 The part that makes this urgent

The call sites are not merely bypassing the variant. They are paying for a different one
and throwing it away:

```
packages/app/features/home/home-content.tsx:60
<Heading level={1} size="display-sm" className="text-2xl font-semibold text-text md:text-3xl">
```

That exact construction — `size="display-sm"` plus a `className` that overrides it —
appears in at least eighteen files across `home`, `onboarding`, `paywall`, `plan`,
`practice`, `trial`, `ai-activity`, `family-calendar`, and `session-prep`. The `size`
prop is inert. `packages/ui/tv.ts` registers the ramp names in tailwind-merge's
`font-size` class group precisely so they conflict correctly, and `className` is merged
last, so `text-display-sm` is dropped every time in favour of `text-2xl`.

This is a copy-paste lineage. One screen was written this way and eighteen inherited it,
which is the exact failure mode CLAUDE.md's "never copied into a second feature" clause
exists to prevent. The `display-sm` prop is a fossil of whatever the first screen
originally looked like.

### 1.3 What I propose

Two things, and they are different in kind.

**A migration, not a promotion:** replace the ×16 sites with `size="title"` and drop the
`className` and the inert `size="display-sm"` entirely. No kit change is required. This
is the largest single item in this document and it adds nothing to the public API.

**Three genuinely absent rungs**, which do warrant new `size` values on `Heading`:

- `title-static` (or equivalent naming) — the ×15 `text-2xl font-semibold text-text`,
  which is `title` without the `md:` step-up. Fifteen call sites deliberately want a
  heading that does *not* grow on wide windows, and today the only way to say that is to
  bypass the component. Worth confirming with design that these fifteen are an intent
  and not a second copy-paste lineage that simply forgot the `md:` half.
- A rung below `title` — the ×8 `text-xl font-semibold text-text`. Section headings
  inside a screen. Nothing in the current `size` union sits there.
- A bold display rung — the ×4 `font-display text-3xl font-bold text-text`. The scale
  tops out at `font-semibold` implicitly; `font-bold` is unreachable through the API.
  Four is a thin count and I flag it as such, but it is concentrated in
  `learner-first-run`, `paywall`, and `practice`, which are the three loudest moments in
  the product. That it is the "one display moment per screen" the UI rules describe is
  what earns it a look, not the number 4.

### 1.4 Who is affected

`Heading` consumers only, concentrated in `packages/app/features/**`. The migration is
mechanical and greppable. Adding `size` values is additive and breaks nothing.

### 1.5 What would make this a mistake

If the ×16 sites are *not* actually meant to look like `title` — if some of them were
tuned by eye against a specific screen and merely converged on the same string — then
collapsing them to a shared variant silently changes those screens. The correct
precaution is a per-persona screenshot pass before and after, which doc 09 §5 already
requires. If it turns out that even two of the eighteen wanted something different, the
right answer is to fix those two, not to abandon the variant.

And on `title-static`: if the fifteen non-responsive sites are just an older copy of the
same string that predates the `md:` step, then adding a variant would enshrine a bug as
API. That question has to be answered by design before the variant is written, and I do
not have the answer.

---

## 2. PROMOTE — Text, but far less of it

### 2.1 The evidence, read honestly

| Count | Override string |
|---|---|
| ×41 | `text-caption text-text-muted` |
| ×13 | `text-label text-text` |
| ×9 | `font-sans text-body text-text` |
| ×9 | `text-xs text-text-muted` |
| ×9 | `font-mono text-caption text-text-muted` |
| ×9 | `text-body text-text` |

Six strings, 90 occurrences — and that is **31% of 287 overrides**. The remaining tail
is **113 distinct strings**. That number is the most important one in this document, and
it points the opposite way from the Heading section.

A distribution where six strings cover 92% is a variant that was forgotten. A
distribution with a 113-string tail is not a missing variant at all. It is a component
being used as intended: `Text` is the general-purpose typographic primitive, and a long
tail of one-off compositions — a `text-center` here, a `flex-1` there, a `line-clamp-2`
somewhere else — is what a general-purpose primitive is *for*. Promoting into that tail
would mean minting variants with two or three callers each, which trades a short
`className` for a long `variant` union that nobody can hold in their head. That is not
consolidation; it is bureaucracy with a build step.

Concretely, the tail contains entries like `font-sans text-body text-text text-center`
(×8) — identical to the ×9 string plus alignment. Alignment is layout, not typography.
If that became a variant the union would immediately need a centred twin of every rung,
and the same argument would then be made for `flex-1`. **The tail is the evidence
against blanket promotion, and it should be cited whenever someone proposes finishing
the job.**

The scope caveat from section 0 bites hardest here. Excluding Storybook, the ×41 becomes
×19. Stories legitimately repeat ramp classes because demonstrating the ramp is their
purpose. So the real product-code pressure behind the top string is roughly half what the
headline suggests.

### 2.2 The one thing here that is a real gap

Strip away the count and look at what these strings reach for. `text-caption`,
`text-label`, `text-body`, `text-data` are `uiRamp` tokens in
`packages/theme/tokens.ts`. Every one of them is defined as a `{ cool, hot }` pair —
they resize with the **age band dial**. `Text`'s own variants are written against the
raw Tailwind scale (`text-sm md:text-base`, `text-xs`, `text-base md:text-lg`), which is
window-responsive but age-band-blind.

So `variant="caption"` and `className="text-caption"` are *not* two ways of saying the
same thing. One tracks the learner's age band and one does not. Every call site reaching
for a ramp token is reaching past the component to get behaviour the component cannot
express. On a children's product where the age band is the whole point, that is not a
styling preference — it is the component being wired to the wrong scale.

**Proposal:** re-point `Text`'s `variant` values at the `uiRamp` tokens rather than the
raw Tailwind scale, so `variant="caption"` means `text-caption`. This is a change to the
existing API, not an addition to it, and it is the single highest-value item in this
section. It also explains, without any appeal to counts, why 72 call sites hand-write
ramp classes.

### 2.3 The second real gap: the mono ramp has no way to be requested

`uiRamp`'s own comment says: *"`data` is the mono ramp: every time, price, %, and count,
so columns align."* The token knows it is mono. The component has no font axis at all,
so every caller writes the font by hand — `font-mono text-caption text-text-muted` ×9,
`font-mono text-data text-text` ×7. Sixteen call sites re-deriving a fact the design
system already asserts.

**Proposal:** either add a `font` axis to `Text` (`sans | display | mono`), or — cleaner,
and my preference — bake `font-mono` into a `data` variant so that the ramp's stated
intent is unreachable by accident. The second option makes `data` mean what tokens.ts
says it means, and removes the possibility of `text-data` without `font-mono`.

I am **not** proposing variants for `text-xs text-text-muted` (×9), `font-sans text-body
text-text` (×9), or `text-body text-text` (×9). The first is the raw scale being used
where the ramp exists — it should migrate to `variant="caption" tone="muted"` once 2.2
lands, not become its own variant. The other two are the component's *base* being
restated verbatim; `font-sans` and `text-text` are already the defaults. Those eighteen
sites need deleting, not promoting.

### 2.4 Who is affected

2.2 is the risky one: it changes rendered sizes for every existing `variant` user across
138 consumer files. It is a visual change to the whole product in one commit and must be
gated on a full screenshot pass across both dials and all four age bands.

2.3 is additive and low-risk.

### 2.5 What would make this a mistake

If `Text`'s use of the raw Tailwind scale was a deliberate decision — if someone decided
that body copy should track the window and not the age band — then 2.2 reverses a
considered call. The file's own doc comment argues for window-responsiveness at length
and never mentions the age band, which reads to me like the ramp arrived afterwards and
`Text` was never revisited. But that is an inference from a comment, not a decision
record, and it should be confirmed against doc 08 §3.1 and whoever shipped `uiRamp`
before anyone touches the variant table.

If the two scales are genuinely both wanted, then the honest fix is an explicit second
axis, not a silent re-pointing.

---

## 3. NARROW — 33 exports with no external consumer

### 3.1 Read this paragraph before you read the list

Thirty-three value exports in `packages/ui/index.ts` have zero consumers outside
`packages/ui`. **This is not a list of dead code and the proposal is not deletion.**

A spot check of eight — Checkbox, Toast, StreamedText, TabBar, Slider, Collapsible,
LearningCanvas, InspectorSection — found that every single one is used *inside*
`packages/ui` and every single one has a Storybook story. `TutorStage.tsx` alone composes
`StreamedText`, `Composer`, `SessionToolbar`, and `LearningCanvas`. `form.tsx` composes
`Checkbox`. `notify.native.tsx` and `notify.web.tsx` compose `ToastCard`.
`List.native.tsx` composes `NativeSlot`. `TrendLine`'s three platform forks all import
`isSuppressed` from `DataTable`. Five separate kit files import from `motion`.

Deleting any of these breaks working, story-covered components. The number "33 unused
exports" is true and dangerously phrased; the accurate phrasing is "33 exports that are
public without needing to be."

The proposal is to **stop advertising them on the public barrel**, so that
`packages/ui/index.ts` — which CLAUDE.md designates as *the* component index that gets
checked before any UI is built — describes what a feature author may actually use. Every
name on it that a feature author will never legitimately call is noise in the one file
whose entire job is to be scanned.

The 33: `barProgress`, `Checkbox`, `Collapsible`, `Composer`,
`createMotionAnimatedComponent`, `createMotionComponent`, `DialogCard`, `FieldGroup`,
`FormField`, `frameLevel`, `InspectorSection`, `isSuppressed`, `LearningCanvas`,
`Lightbox`, `ListItem`, `MotionText`, `NativeSlot`, `pushLevel`, `SessionToolbar`,
`SheetSurface`, `Slider`, `SlideUp`, `StreamedText`, `summarise`, `TabBar`,
`TabBarAccessory`, `Toast`, `ToastCard`, `useFieldContext`, `useFormContext`,
`useReducedMotion`, `VirtualList`, `withForm`.

### 3.2 A caution about the zero-consumer count itself

Two names on adjacent lists are inflated by collision, not usage, and it is worth
recording so the next person doesn't re-derive it. A naive identifier grep reports four
external hits for `summarise` and four for `TutorStage`. They are not consumers:
`packages/avatar/src/testing/golden.ts` defines its own unrelated `summarise`, and
`packages/avatar/src/tutor-stage.ts` defines its own `TutorStage` *type* alongside
`createTutorStage`. The kit's waveform `summarise` really does have zero external
consumers; the kit's `TutorStage` component really does have exactly one.

Any future audit of this kind must count import edges, not identifiers.

### 3.3 The blocker nobody will see coming

`tooling/check-barrels.mjs` fails the build when a module exists but no entry point
reaches it. It computes reachability by walking **relative re-export edges from the
entry points declared in `package.json`** — and stories are explicitly exempt, meaning a
story importing a module does *not* make that module reachable.

I traced the inbound edges for all of them. Ten modules are reachable **only** through
`index.ts`, and every value they export is on the 33:

`Collapsible`, `FieldGroup`, `FormField`, `InspectorSection`, `Lightbox`, `Slider`,
`TabBar`, `TabBarAccessory`, `Toast`, `VirtualList`.

Remove those names from the barrel and `pnpm check:barrels` goes red — correctly, by its
own logic, because they would genuinely be orphans. This is the guardrail catching the
narrowing, and it is right to.

The rest are safe: `Dialog`, `BottomSheet`, `List`, and `form` each keep at least one
public name (`Dialog`, `BottomSheet`, `List`, `useAppForm`), so those modules stay
reachable while `DialogCard`, `SheetSurface`, `ListItem`, and `withForm` drop off. And
`Checkbox`, `Composer`, `StreamedText`, `LearningCanvas`, `SessionToolbar`, `ToastCard`,
`NativeSlot`, `motion`, `DataTable`, and `audio/waveform` all have real internal
importers.

### 3.4 What I propose

A second entry point — a `./internal` (or `./kit`) subpath in `packages/ui`'s `exports`
map — that re-exports the composition-only names. That satisfies `check-barrels`
reachability by declaration rather than by accident, keeps every story working, keeps
every internal import working, and makes the main barrel a list of things a feature is
meant to use.

I want to be clear that this is a proposal with a real cost: it adds a second place to
look, and "check `index.ts` before building any UI" becomes "check `index.ts`, and if
you're working inside the kit, also `internal.ts`." That is a genuine dilution of a rule
that currently has the virtue of being one sentence. Whether a shorter index is worth a
longer rule is a judgement call I am putting to the reader, not making unilaterally.

The waveform maths — `barProgress`, `frameLevel`, `pushLevel`, `summarise` — is the
least ambiguous subset. It is pure DSP helpers from `audio/waveform.ts`, surfaced on the
main barrel only because `index.ts` ends with `export * from './audio'`. No feature will
ever call `pushLevel`. If only one thing in section 3 happens, it should be tightening
`audio/index.ts` so the star re-export stops promoting internals by default.

### 3.5 Who is affected

Nobody outside `packages/ui`, by construction — that is what "zero external consumers"
means. Inside the kit, imports would change from `'./X'` to unchanged (internal imports
are already relative and untouched). The only real churn is `index.ts` itself, the new
`internal.ts`, and the `exports` map.

### 3.6 What would make this a mistake

Three ways.

If any of the 33 is about to gain its first feature consumer, narrowing it now just
means someone re-widens it next sprint, having spent a review cycle discovering why it
moved. `Slider`, `Collapsible`, and `Lightbox` are ordinary UI controls with obvious
future demand; they are the likeliest to bounce back.

If the team reads "not on the main barrel" as "deprecated," the narrowing causes exactly
the duplication that doc 11 §8 lists the barrel index as the defence against — someone
needs a checkbox, doesn't find `Checkbox` on the index, and writes a second one. Any
narrowing must ship with a header comment in `internal.ts` saying, in as many words,
*these are live, story-covered components; they are here because features compose them
through a parent, not because they are on the way out.*

And if `check:barrels` were "fixed" to accept story imports as reachability edges rather
than adding a proper entry point, the guardrail would be weakened to make a cosmetic
change convenient. That trade is not worth it. Do not do that.

---

## 4. WATCH — one external consumer each

`Dialog`, `ErrorMessage`, `KeyboardAwareScroll`, `List`, `LoadingSkeleton`,
`MessageBubble`, `notify`, `ScheduleCard`, `StatCard`, `SuppressibleValue`, `Toaster`,
`TutorStage`, `useAppForm`, `useFormStore`, `useHydrated`, `useSizeClass`.

Sixteen exports with exactly one consumer outside the kit. Verified: `Dialog` →
`features/memory`, `LoadingSkeleton` → `features/schedule`, `ScheduleCard` /`StatCard`
/`SuppressibleValue` → `features/ops`, `MessageBubble` → `features/onboarding/learner`,
`notify` and `useAppForm` and `useFormStore` → `features/schedule/BookingForm`,
`KeyboardAwareScroll` and `Toaster` → `apps/mobile`, `useHydrated` → `apps/web`,
`TutorStage` → `features/tutor`.

**The proposal for this list is to do nothing, and to be explicit about why.**

A single consumer is not evidence of a mistake. It is equally consistent with three
different situations, and the count alone cannot tell them apart:

*Correctly placed, prematurely shared.* `ScheduleCard` and `StatCard` are used only by
the ops dashboard. If they were built for the ops dashboard, they arguably belong in
`features/ops` and were globalized on speculation. But they are already in the kit and
already have stories; demoting them costs a refactor and buys tidiness.

*Correctly placed, genuinely general.* `KeyboardAwareScroll`, `useSizeClass`,
`useHydrated`, and `Toaster` are infrastructure. Each has one caller because each needs
exactly one caller — a root layout, a size-class hook consumed at a boundary. A count of
one is the *expected* count for these, not a warning sign.

*Correctly placed, second consumer imminent.* `Dialog` and `LoadingSkeleton` are
generic UI with one adopter so far.

CLAUDE.md's rule does not say "promote things used by more than one feature." It says
new shared logic must never be **copied into a second feature**. The trigger is
duplication, not headcount. A genuinely one-screen component that lives next to its one
screen is following the rule perfectly; a one-screen component in the kit is at worst
slightly early. Neither is a defect, and moving things back and forth to satisfy a
threshold that the rules never set is churn.

**What to actually do:** nothing now. When any of these gains a second consumer, that is
the moment to confirm the API generalizes — the second consumer is what reveals whether
the props were shaped around the first screen's assumptions. That is a review question
at the time, not a refactor today.

**What would make inaction a mistake:** if one of these sixteen is *already* being
partially reimplemented in another feature — a bespoke skeleton somewhere rather than
`LoadingSkeleton`, a local toast rather than `notify` — then the rule has already been
broken and I have not detected it, because I measured imports of the kit and not
lookalike code elsewhere. **That gap is real and I want it on the record: an import
census cannot find a copy that never imported anything.** Finding those requires a
similarity sweep over `features/**`, which I did not run and which would be the natural
follow-up to this document.

---

## 5. What I am deliberately NOT proposing

Restraint is part of the deliverable, so here is what got considered and cut.

**Not promoting the Text tail.** 113 distinct strings, most with one or two occurrences.
Covered in 2.1. The tail is the argument against itself.

**Not proposing a `text-center` / alignment variant**, despite `font-sans text-body
text-text text-center` appearing 8 times. Alignment is a layout decision made by the
parent, and a typography component that also owns alignment will end up owning
`flex-1`, `line-clamp`, and margins by the same logic. The line has to be somewhere and
this is the natural place for it.

**Not proposing to delete anything.** Section 3 says this at length and it bears
repeating in the section a skimmer will read: the 33 are live, composed, and
story-covered. There is no dead code proposal in this document. If someone leaves here
with a deletion task, this document has failed.

**Not proposing to demote the WATCH sixteen** back into features. Section 4.

**Not proposing changes to `tv.ts` or the tailwind-merge config.** It is correct, its
reasoning is documented in the file, and the ramp/font-size class group it registers is
load-bearing — it is the reason the Heading override analysis in 1.2 is provable rather
than speculative. Leave it alone.

**Not proposing a new spacing, radius, or colour promotion.** I measured typography
overrides. I did not measure spacing overrides, so I have no evidence about them and
will not pad this list with a guess. If that sweep is wanted it is a separate exercise
with a separate count.

**Not proposing a lint rule to ban `className` on `Heading` and `Text`.** It would work,
and it is tempting given 1.2. But it would fire on the 113-string Text tail, which is
legitimate, and the enforcement cost would land before the variants exist to satisfy it.
If the section 1 and section 2 work lands and the overrides do not fall, *then* a
narrower rule — say, banning `text-*` font-size utilities specifically on `Heading` —
becomes worth arguing for.

---

## 6. If this were approved, the order that minimises risk

Not a commitment; a sequencing argument, because several of these interact.

The `audio/index.ts` tightening (3.4) is independent and safe, so it can go first alone.
The `Heading` migration to `size="title"` (1.3) is next: it is mechanical, greppable,
and removes eighteen inert `size="display-sm"` props whose presence would otherwise
confuse anyone reading the Heading API afterwards. New `Heading` rungs follow, since
they are purely additive.

The `Text` ramp re-pointing (2.2) is the one that changes the whole product's rendered
type and it should be its own commit behind its own screenshot pass across both dials
and four age bands. Nothing else should be in that commit.

The barrel narrowing (3.4) goes last, because it is the only item that needs a new
entry point and a `check-barrels` interaction, and because it should be evaluated after
the migrations have settled which components features actually reach for.

The WATCH list (4) is not scheduled, by design.

---

**SOT-KEYWORDS:** ui kit promotion narrow barrel variant heading text ramp uiRamp
override audit public-api check-barrels design-system consolidation

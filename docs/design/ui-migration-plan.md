# UI migration plan — closing the drift between the kit and its call sites

**Date:** Aug 26, 2026 · **Status:** PROPOSED. Nothing here has been executed.
**Measured by:** `pnpm ui:sweep` (`tooling/ui-sweep.mjs`), node_modules excluded
**Constrained by:** `CLAUDE.md` §UI, §"Patterns are law", §Delivery

---

## Read this before anything else

**No file in this repository has been changed for this plan.** Not one variant
added, not one call site rewritten, not one export removed. Every number below
is a measurement of the tree as it stands on `ops-dashboard` at `9d58a14`, and
every phase below is a proposal.

**Phase 3 is explicitly gated on your sign-off**, and does not start until you
give it. It is the phase where the mechanical framing breaks down: each of its
five items needs a per-file product decision (which raw `<div>` is a deliberate
web-fork escape and which is slop; what colour actually belongs on a saturated
accent block; which `useState` is genuinely local view state). Those decisions
are not mine to make silently, and I would rather stop and ask than land a sweep
that quietly changes how something looks or behaves. Phases 4 and 5 are
investigation-only by design and produce no diff at all without a second
approval after their findings land.

Phases 1 and 2 are also proposals awaiting approval — the gate is called out for
Phase 3 because that is the one where approving "the plan" would not be enough;
it needs approval of the individual calls inside it.

---

## What this is fixing, and what it is not

The kit is in good shape. `packages/ui/index.ts` exports a real component index,
`packages/ui/tv.ts` fixed the tailwind-merge class-group bug that was silently
deleting the whole type ramp, and `tooling/check-runtime-classes.mjs` and
`check-utilities.mjs` exist to stop three specific bugs that already shipped
once. This plan is not a rewrite. It is about the gap between what the kit
already knows how to do and what call sites actually type.

The single sentence that explains almost all of it: **when a component's variant
does not quite match what a screen needs, the screen writes a `className`
instead of asking for a variant.** Fifty times for `Heading`, two hundred and
eighty-seven times for `Text`. The first number is a bug in the variant set. The
second number is mostly not.

Distinguishing those two cases is the entire point of the sequencing.

---

## Phase 1 — `Heading`: the mechanical one

### The measurement

Sixty `Heading` call sites. Fifty of them pass a `className`. Forty-eight of
those fifty touch the type scale — meaning the override is not adding a margin
or a max-width, it is overruling the component's own size decision.

That sounds bad until you look at the distinct strings. There are **ten**, and
six of them cover **92%** (46/50):

| ×  | string |
|----|--------|
| 16 | `text-2xl font-semibold text-text md:text-3xl` |
| 15 | `text-2xl font-semibold text-text` |
| 8  | `text-xl font-semibold text-text` |
| 4  | `font-display text-3xl font-bold text-text` |
| 2  | `font-sans text-lg font-bold text-text` |
| 1  | `text-text` |

Fifty overrides expressing six intentions is not drift in the interesting sense.
It is six missing variants and a copy-paste chain.

### The finding that changes the shape of this phase

`packages/ui/Heading.tsx` already has this:

```
title: 'text-2xl font-semibold md:text-3xl',
```

and its `base` is already `font-display text-text`.

**The most common override in the codebase — sixteen occurrences — is the
existing `size="title"` variant with a redundant `text-text` glued on.** Those
sixteen sites need no new variant. They need `size="title"` and the deletion of
a string. The single `text-text` site is the same story with nothing else in it.

That reframes the phase. Of the 50 overrides:

- **17 are already expressible today** (16 × `title` + 1 × bare `text-text`).
  Pure deletion, zero API change, zero visual change.
- **15** are `title` without the `md:` step-up — same phone rendering, different
  tablet rendering. See the responsive note below; this is the one genuinely
  interesting decision in Phase 1.
- **8** are a rung below `title` (`text-xl font-semibold`) with no `md:` pair.
- **4** want `font-bold` at `text-3xl` — `font-bold` is not reachable through
  any current `Heading` variant. This is a real gap.
- **2** want `font-sans` at `text-lg font-bold`, which actively fights the
  `font-display` in `base`. Also a real gap, and arguably a design question
  rather than an API one: a sans-serif bold heading is a different thing.
- **4** are the long tail (one-offs mixing layout classes into the heading's
  `className`, e.g. `gap-stack`, or a card's own box classes). Leave them; they
  are not type-scale overrides in spirit even where they trip the regex.

### The proposal

Add the small set of variants those strings represent — my read is **three new
`size` rungs and one new `weight` or `family` axis**, not six new sizes:

1. A non-responsive counterpart to `title` for the ×15 case, *if* the responsive
   question below resolves that way.
2. A rung below `title` for the ×8 case.
3. A bold display rung for the ×4 case (or a `weight` variant, which composes
   better with the existing rungs and avoids a combinatorial size list).
4. A `family: 'sans'` escape for the ×2 case, if it survives design review.

Then sweep the call sites: 23 files, mechanically, string-for-variant.

I want to be honest that "three rungs and one axis" is my current best reading
and could turn out to be two, or five, once the exact `md:` decision below is
made. The proposal is the *shape*; the exact variant list should be agreed
before the sweep, not discovered during it.

### The `md:` responsive pair, as its own consideration

`Text.tsx` carries a long comment explaining why the type scale steps up with
the window at the source rather than as `md:` classes sprinkled through screens:
*"a change lands everywhere at once and screens cannot drift apart."*
`Heading.tsx` repeats the policy — every display rung steps up one at `md`.

Sixteen call sites write the `md:` step by hand. Fifteen omit it. **That
fifteen-site omission is exactly the drift the comment predicted.** Two screens
side by side on a tablet, one of which grows its heading and one of which does
not.

So there is a real fork here, and it is a design decision, not a refactor:

- **(a)** Both groups become `size="title"`. The 15 omitting sites *gain* a
  tablet step-up. This is the policy-consistent answer and the one the code
  comments argue for — but it is a **visible change on 15 screens at ≥768dp**,
  and it must be reviewed as a visual change, not slipped in as a refactor.
- **(b)** Add a `responsive: false` opt-out and preserve current rendering
  exactly. Zero visual risk, but it institutionalises the drift and gives the
  codebase two ways to spell a title — which `CLAUDE.md` §"Patterns are law"
  explicitly forbids.

I lean (a), because (b) is the thing the rule was written to prevent. But (a)
changes pixels on 15 screens and that needs your eyes on a tablet, not my
assurance. **This decision blocks the Phase 1 sweep and should be made first.**

### Blast radius, verification, revert

- **Radius:** `packages/ui/Heading.tsx` (+ its story), and 23 call-site files.
- **Verified by:** `pnpm typecheck` (catches every mistyped variant name —
  this is the strong guard, because `size` is a union), `pnpm lint`,
  `pnpm --filter @acme/app test` (206 passing), `pnpm check:runtime`,
  `pnpm check:utilities`, and `pnpm ui:sweep` re-run to confirm the override
  count actually fell. Storybook review of the `Heading` story for the new
  rungs, plus a tablet-width pass if we take fork (a).
- **A caveat about that verification:** `packages/app`'s test script is
  `node --test 'features/**/*.test.ts'` — pure logic tests. **None of the 206
  tests render a component or assert on a className.** They will not catch a
  typography regression. Typecheck is the real mechanical guard here; the visual
  guard is Storybook and a device pass. I would rather say that plainly than let
  "206 green" read as more coverage than it is.
- **Revert:** one commit, `git revert`. The call-site sweep and the variant
  addition should be **two commits** so the sweep can be reverted while keeping
  the variants — the variants are correct regardless of how the sweep lands.

### Safe in one commit?

The 17 already-expressible sites: yes, trivially, and they could ship on their
own today as a pure deletion with no API change. The rest: one commit is fine
*mechanically*, but it should be reviewed as a visual change because of the
`md:` fork.

---

## Phase 2 — `Text`: explicitly not the same fix

### The measurement

287 classifiable overrides. **113 distinct strings.** Top six cover **31%**:

| ×  | string |
|----|--------|
| 41 | `text-caption text-text-muted` |
| 13 | `text-label text-text` |
| …  | *(long tail — 107 further strings)* |

Put the two phases side by side and the difference is the whole argument:

|              | overrides | distinct | top-6 coverage |
|--------------|-----------|----------|----------------|
| `Heading`    | 50        | 10       | **92%**        |
| `Text`       | 287       | 113      | **31%**        |

### Why the same fix would be wrong here

The Heading fix works because 50 overrides express 6 intentions. Here, 287
overrides express something closer to 113 intentions, and after the top two
there is no cluster left to promote — the tail is a hundred one-and-two-off
strings that combine a ramp size, a tone, a weight, a tracking, a max-width, and
an alignment in ways that mostly do not repeat.

Promoting a long tail into variants goes wrong in three specific ways:

1. **Variant explosion.** Encoding even half of 113 strings as variants gives a
   `Text` API nobody can hold in their head. `CLAUDE.md` §UI says *"Check for an
   existing component before creating one"* — that rule only functions if the
   existing component is legible. A 40-variant `Text` is not searchable; people
   will write `className` anyway, and now there are two ways to do it, which is
   the exact failure §"Patterns are law" names.
2. **False consensus.** A variant asserts "this combination is a design
   decision the system endorses." Minting one for a string used twice
   *manufactures* that endorsement from a coincidence. The system then has to
   defend a rung it never chose.
3. **Cost asymmetry.** A `className` on a `Text` is local and cheap to fix
   later. A published variant is API — it has a story, it gets used, and
   removing it is a breaking change across the monorepo. **Drift is reversible;
   a wrong abstraction is sticky.** Given uncertainty, the tail should stay
   drift.

There is a fourth, quieter reason to be careful: `packages/ui/tv.ts` exists
because tailwind-merge silently *deleted* ramp classes it misread as colours.
That bug was invisible in review. Every new variant is another slot string that
has to survive merging, and the tail is precisely where the odd combinations
live. Adding a hundred of them is adding a hundred chances to reintroduce a
class of bug this repo has already been bitten by.

### The proposal

Promote only the two clear repeats, and stop:

- `text-caption text-text-muted` ×41 → almost certainly a `variant="caption"
  tone="muted"` pairing that already exists and is being re-typed, or a genuinely
  missing single token like a `hint`/`meta` variant. **Check first**: if
  `<Text variant="caption" tone="muted">` already produces this exact output,
  this is 41 deletions and no API change at all — the same shape as Phase 1's
  best case. That check is cheap and should happen before anything is added.
- `text-label text-text` ×13 → same question. `text-text` is already in `base`,
  so at minimum the second half is redundant on all 13.

Then **explicitly leave the remaining ~107 strings alone**, and record that as a
decision in this document rather than as an omission — so the next person
reading `ui:sweep` output does not "discover" the tail and sweep it.

Revisit only on evidence: re-run `pnpm ui:sweep` after each release and promote
a string when it independently crosses a threshold (I'd suggest **8+ uses across
3+ features**, which today would promote nothing beyond the two above). Let the
codebase tell us what is a pattern instead of guessing.

### Blast radius, verification, revert

- **Radius:** `packages/ui/Text.tsx` (possibly zero change), and only the files
  holding the ~54 promoted call sites. Deliberately *not* 113 files.
- **Verified by:** the same gate — `pnpm typecheck`, `pnpm lint`,
  `pnpm --filter @acme/app test`, `pnpm check:runtime`, and a `ui:sweep` diff.
  Same caveat as Phase 1: the tests do not see classNames.
- **Revert:** single commit per promoted string, so one can be reverted without
  the other.
- **Safe in one commit?** Yes, if scoped to the two strings. Absolutely not if
  it grows to cover the tail.

---

## Phase 3 — bounded items · **GATED ON YOUR SIGN-OFF**

Five small findings. They are grouped because each is small; they are gated
because **not one of them is purely mechanical**, and the spot-checks I ran
while writing this changed my read on three of the five.

### 3a. Arbitrary Tailwind values — ~11 across 9 files

`CLAUDE.md` §UI: *"no `p-[13px]`"*. Straightforward rule, but the instances
split into three unlike groups:

- **Sub-pixel craft inside the kit** — `translate-x-[3px]`/`translate-y-[3px]`
  in `Button.tsx`, `translate-x-[2px]` in `IconButton.tsx`, `top-[2px]` and
  `translate-x-[22px]` in `Switch.tsx`, `backdrop-blur-[2px]` in `Dialog.tsx`.
  These are the neubrutalist press-offset and thumb geometry. They want
  **tokens** (`--offset-press`, etc.) added to `packages/theme/tokens.ts`, per
  the rule's own escape hatch: *"If a token doesn't exist, add it."*
- **The copy that proves the point** — `notifications-content.tsx` re-types
  `translate-x-[3px] translate-y-[3px]`, i.e. `Button`'s press offset,
  by hand in a feature. That is §"Patterns are law" violated directly: the
  offset should come from the kit, not be retyped. Tokenising 3a fixes the
  symptom; the real fix is that call site using the kit's pressable.
- **Layout percentages** — `basis-[45%]`, `w-[95%]`, `flex-[2]`. A percentage
  is not a design token and never will be one. These need per-site judgement:
  some are legitimately expressing "two of these per row" and want a grid
  utility; `text-[10px]`/`text-[11px]` in `TextField`, `Textarea`,
  `explore-content`, and `notifications-content` are below the ramp's floor and
  are a genuine **type-scale** question, not an arbitrary-value question.

Exact count depends on whether `packages/ui` is in scope; the sweep's ~11 is the
product-code figure. Verified by `pnpm check:utilities` for any new token and by
Storybook for the kit ones. Revertible per token.

### 3b. Hardcoded `text-white` ×5 in one file — **do not do the obvious fix**

All five are `selectedTitle: 'text-white'` in
`packages/app/features/schedule/accent-classes.ts`, on solid saturated accent
blocks (`bg-ember-500`, `bg-gold-500`, …).

The obvious fix is `text-text-inverse`. **It is wrong.** In
`packages/theme/tokens.ts`, `text-inverse` is `ink[50]` in light and `ink[950]`
in dark — it *flips*. The accent block does not flip; `bg-ember-500` is the same
saturated colour in both themes. Swapping in `text-text-inverse` would turn
those five titles near-black on a saturated block in dark mode. That is a
contrast regression shipped under the banner of removing a hardcode.

The right fix is per-accent `on-*` tokens — the theme already has exactly this
pattern (`on-primary`, `on-accent`, `on-danger`, `on-highlighter`); it just has
no `on-ember`/`on-gold`/etc. yet. Adding five tokens is small. Deciding their
values is a design call and needs `pnpm check:contrast` to sign it off.

Note also that this file's header explains it is spelled out on purpose because
Tailwind scans source as text — so any change here must stay literal. Do not
"simplify" it into a computed map.

### 3c. Raw `<div>` ×10 in 6 files, `<span>` ×1 — **mostly false positives**

The repo rule is `@acme/ui` html components, never raw HTML. But the spot-check
says most of these are not violations:

- `packages/ui/DataTable.tsx` — the match is **inside a comment** explaining why
  a `<div>` is *not* legal there. Zero instances.
- `packages/ui/tw.tsx` — three matches, all in comments describing what the
  wrappers compile to.
- `packages/ui/TrendLine.web.tsx` — a real `<div>`, with an adjacent comment:
  *"A real `<div>` for the pointer surface: this is the web fork."* Deliberate.
- `packages/ui/paste-wrapper.web.tsx` — `<div style={{display:'contents'}}>`.
  A kit `View` cannot express `display: contents`. Deliberate.
- `packages/ui/VirtualList.web.tsx` — three `<div>`s doing virtualiser
  positioning maths in a `.web.tsx` fork. Deliberate.
- `packages/ui/Switch.web.tsx` — the `<span>`. Web fork.
- `packages/payload/src/components/{Icon,Logo}.tsx` — Payload **admin** UI,
  which is React DOM and outside the RN kit entirely. Out of scope.

What is left as genuinely actionable is **two files**:
`apps/web/app/(ops)/layout.tsx` and `apps/web/app/(payload)/layout.tsx` — and
the first of those carries a comment claiming the plain `<div>` is load-bearing
for pinning the app to the viewport. It may well be right.

So the honest version of this item is: **the finding is ~2 sites, not 10, and
both may be justified.** What actually wants doing is not a sweep — it is
teaching whatever produced the "10" to exclude comments and `.web.tsx` forks,
so this does not get re-reported as debt every quarter.

### 3d. `KeyboardAvoidingView` ×6 in 3 files

Repo standard is `react-native-keyboard-controller`, and the kit already ships
`KeyboardAwareScroll` from `packages/ui/keyboard-aware`. The three files are
`apps/mobile/app/_layout.tsx`, `packages/ui/keyboard-aware.native.tsx`, and
`packages/app/features/editor/UrlSheet.native.tsx`.

The middle one is the kit's own implementation and may be a deliberate fallback
inside the wrapper — **check before touching it.** The other two are the real
candidates. This is behavioural, not cosmetic: RN's `KeyboardAvoidingView` and
the controller resolve insets differently, and Android snaps rather than
tracking. It needs a device pass on both platforms, not a typecheck.

### 3e. React `useState` ×15 in product code

Repo standard is Zustand, with `useInstanceStore` already exported from
`packages/ui/index.ts` for the per-instance case.

This is the item I am least willing to sweep. `useState` for a transient,
component-local, never-shared value is not obviously wrong, and converting all
15 without reading each one risks turning genuinely local view state into
shared state — which is a correctness change wearing a refactor's clothes. The
proposal is a **read-through of all 15 producing a two-column list (convert /
justified-local)**, and then converting only the first column. That read-through
is cheap; it is the sweep-without-reading that is expensive.

### Phase 3 gate, verification, revert

Nothing in 3a–3e proceeds without your explicit yes on **each item**, because
3b needs a colour decision, 3c may be a no-op, 3d needs device testing, and 3e
needs per-site judgement. Verified by the standard gate plus
`pnpm check:contrast` (3b) and a two-platform device pass (3d). Each item is its
own commit; `git revert` per item.

**Safe in one commit?** No. Five commits minimum, and 3e is per-file.

---

## Phase 4 — `gap-N`: verify before you sweep anything

### Status: UNVERIFIED

The sweep reports **309 numeric `gap-N`** in product code against the named
spacing tiers. **This was not spot-checked.** It is the largest number in the
report and the least examined, and that combination is exactly how a bad sweep
happens.

**A 309-site mechanical change on an unverified finding is not something to
run.** Not as one commit, not as ten. This phase produces a *report*, and
whether any code changes follow is a separate decision made after reading it.

### What ten minutes of looking already suggests

Two things surfaced while writing this that both point away from a sweep:

1. **A large share of the sites have no named tier to move to.** The tiers in
   `packages/theme/tokens.ts` start at `element` = `0.5rem`. Counting `gap-N`
   across `.tsx`: `gap-1` (0.25rem) ×64 and `gap-0` ×28 sit **below the floor**.
   Roughly a quarter of the population has no target, so any "migrate all
   `gap-N`" framing is wrong on its face.
2. **The tiers are not fixed values — they are age-band responsive.** Each is a
   `{ cool, hot }` pair: `element` is 0.5rem cool / 0.75rem hot, `stack` is
   0.75rem / 1rem, `group` 1.5rem / 2rem, `section` 2rem / 3rem.

Point 2 is the important one. Replacing `gap-3` with `gap-stack` does **not**
preserve the rendered value. It makes the value vary with the signed-in child's
age band — 0.75rem stays 0.75rem for a cool band and becomes 1rem for a hot one.
**That is a semantic change, not a rename**, and doing it 309 times would
reflow layouts across the product in a way that depends on who is logged in.
Which, to be clear, is very likely the *correct* long-term behaviour and the
whole point of having the tiers. But it is a deliberate product change that
deserves its own design conversation, not a byproduct of a lint cleanup.

### The verification step, in order

1. Re-run `pnpm ui:sweep` and split the 309 by value, and by whether the site is
   in `packages/ui` (kit-internal, different rules) or product code.
2. Discard the below-floor values (`gap-0`, `gap-1`) — they need a decision
   about whether a sub-`element` tier should exist at all, which is a tokens
   question, not a migration.
3. For the remainder, sample ~20 sites across ≥5 features and answer one
   question each: *is this gap expressing a semantic grouping relationship (→
   tier), or a specific visual measurement (→ leave it)?*
4. Write the answer up **in this document** with the sample attached.
5. Only then decide whether a migration is proposed at all, and if so, whether
   it is feature-by-feature with a visual pass per feature. It would not be one
   commit under any circumstance.

Blast radius of Phase 4 as proposed: **zero files.** It is a report.

---

## Phase 5 — the public barrel: narrowing, never deletion

### The measurement

The inventory found **33 value exports from `packages/ui` with no consumer
outside the package.**

### The thing that must be said out loud

**Every one of the 33 that was spot-checked is used inside `packages/ui`, and
every one has a Storybook story.** (`packages/ui` carries 55 `.stories.tsx`.)

**These are candidates for narrowing the public barrel. They are NOT candidates
for deletion.** "No external consumer" means "not currently imported from
`packages/app` or `apps/*`" — it does not mean dead. Deleting a component that
the kit itself renders would break the kit; deleting one with a story would
break Storybook and remove documented, working UI that a future feature is
supposed to find. `CLAUDE.md` §UI's *"Check for an existing component before
creating one"* only works if the component is still there to be found. Any step
proposed here says this explicitly, and any future reader of the inventory
should read this paragraph before acting on that "33".

### The constraint that makes even narrowing non-trivial

`tooling/check-barrels.mjs` **fails the build if a module exists but no entry
point reaches it** — written precisely so an unexported component does not get
rebuilt as a duplicate. So removing a name from `index.ts` is not free: unless
the module stays reachable through some entry point, the check goes red.

Narrowing therefore means one of:

- **(a)** A second, explicitly internal entry point in `packages/ui`'s `exports`
  map — and teaching `check-barrels.mjs` that it counts as reachable. This is
  the only option that both narrows the surface and keeps the guard honest.
- **(b)** Leave `index.ts` alone and treat the 33 as documentation debt instead:
  annotate them, and let the barrel stay wide.

Option (b) is genuinely defensible and is the zero-risk answer. Option (a) is a
real improvement — a smaller public surface makes the index scannable, which is
the whole reason `CLAUDE.md` points at it — but it touches build tooling.

### Blast radius, verification, revert

- **Radius (a):** `packages/ui/package.json`, `packages/ui/index.ts`, a new
  internal barrel, `tooling/check-barrels.mjs`. Import updates wherever a name
  moves. No component file changes, no deletions.
- **Radius (b):** comments only.
- **Verified by:** `pnpm check:barrels` (the direct guard), `pnpm typecheck`
  across all packages, `pnpm build`, and a Storybook build — the story files are
  the consumers most likely to break on a moved export.
- **Revert:** single commit; restoring `index.ts` restores the surface.
- **Safe in one commit?** (b) yes. (a) yes mechanically, but it must not be
  bundled with any other phase — a red `check:barrels` in a commit that also
  moved 23 heading call sites is a bad afternoon.

---

## Ordering, and why

Leverage over risk, highest first:

| Phase | Sites | Distinct intentions | Mechanical? | Visual risk | Gate |
|-------|-------|--------------------|-------------|-------------|------|
| 1 · Heading | 50 / 23 files | 6 | Yes, after the `md:` call | Medium (15 screens at ≥768dp) | approval |
| 2 · Text | ~54 of 287 | 2 promoted | Yes, if scoped | Low | approval |
| 3 · bounded | ~24 / ~9 files | 5 unlike items | **No** | Item-dependent | **explicit per-item sign-off** |
| 4 · gap-N | 309 | unknown | **Unknown — that is the point** | Potentially product-wide | report only |
| 5 · barrel | 33 exports | 1 | Yes | None | approval |

Phase 1 is first because it has the best ratio in the codebase: fifty fixes for
six decisions, with typecheck as a real mechanical guard. Phase 2 is second not
because it is next-largest but because doing it *right after* Phase 1 is what
prevents someone applying Phase 1's logic to it — the two phases are a matched
pair, and the second one's job is partly to say "stop here."

Phase 3 could arguably go earlier on pure risk, since each item is tiny. It sits
third because tiny-and-judgement-heavy is worse to interleave than
large-and-mechanical, and because it is the gated one — parking it behind two
approved phases means the gate does not block everything else.

Phase 4 is fourth because it is the largest number and the least understood, and
those two facts together mean it should be the thing we know most about before
we touch it, not the thing we do first because the number is impressive.

Phase 5 is last because it touches build tooling and should land on a quiet
tree.

---

## What could go wrong — the two large sweeps

### Phase 1 (Heading, 50 sites / 23 files)

- **The silent one.** `packages/ui/tv.ts` documents that tailwind-merge
  classifies unrecognised `text-*` as a *colour* and deletes one of a pair. New
  `Heading` rungs are new slot strings going through that merger. If a rung uses
  a size name outside `RAMP_FONT_SIZES`, it can be dropped at merge time and the
  heading falls back to inherited size — **and it will look fine in code
  review.** `pnpm check:runtime` exists for exactly this and must run.
- **The one the tests miss.** The 206 tests are `node --test` over
  `features/**/*.test.ts`. They will be green through a total typography
  regression. Green tests are not evidence here.
- **The `md:` reflow.** Under fork (a), 15 screens change at tablet width. If
  that ships without a tablet pass, the first report will be "the tutor screen
  heading got big" and it will be a week later.
- **Semantic drift in the sweep.** `Heading` takes `level` (h1–h3) separately
  from `size`. A mechanical size sweep that ignores `level` can leave the
  document outline wrong even though it looks right. **The sweep must not touch
  `level`**, and any site where the override was compensating for a wrong
  `level` needs to be fixed as a `level` bug, not absorbed into a size variant.
- **Mitigation:** two commits (variants, then sweep); `ui:sweep` diff before and
  after; Storybook review; tablet pass; do not touch `level`.

### Phase 4 (gap-N, 309 sites) — if it ever becomes a sweep

- **The value change nobody expects.** As above: `gap-3` → `gap-stack` is not a
  rename. Spacing starts varying with the learner's age band. Across 309 sites
  that is a product-wide reflow whose result depends on who is signed in, which
  also means **it may not reproduce for the reviewer.** A reviewer on an ops
  account sees the cool band; the regression is on a K–2 learner.
- **No target for a quarter of them.** ~92 sites are below the `element` floor.
  A sweep that "handles" them by rounding up to `gap-element` silently doubles
  or quadruples those gaps.
- **Unreviewable diff.** A 309-site diff across every feature gets rubber-
  stamped. That is not a hypothetical; it is what a diff that size does.
- **Kit vs. product.** `packages/ui` internals may legitimately want exact
  values — a `Switch` thumb gap is geometry, not a grouping relationship.
- **Mitigation:** Phase 4 does not produce a diff. If it ever does, it is
  per-feature commits with a per-feature visual pass in both age bands, and it
  starts with the feature that has the fewest sites, not the most.

---

## Uncertainty, stated plainly

- The exact Heading variant list (three rungs? four? an axis instead?) is my
  reading of six strings and should be agreed before the sweep, not settled
  during it.
- The `md:` fork is a **design decision I cannot make**. It is the one thing
  blocking Phase 1.
- Phase 2's ×41 and ×13 may both turn out to be *zero* new API — pure
  redundancy against variants that already exist. That check comes first and
  might make Phase 2 a deletion-only commit, which would be the best outcome.
- The Phase 3c raw-HTML finding is, on inspection, close to a non-finding. I am
  reporting the measurement and my disagreement with it rather than quietly
  dropping it.
- The `gap-N` number is honest but uninterpreted. I do not know what fraction is
  real. Neither does anyone else yet, and that is the whole reason Phase 4 is
  shaped as a report.
- The "33 unused exports" number is real and the "unused" reading of it is
  wrong. Narrowing is the ceiling of what should be proposed there.

Every phase re-runs `pnpm ui:sweep`, and the numbers in this document should be
regenerated rather than trusted — per that script's own header, if it disagrees
with this doc, **this doc is stale, not the script.**

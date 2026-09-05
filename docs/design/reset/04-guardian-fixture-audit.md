# Guardian surfaces — the fixture audit

<!--
What a guardian is shown today that is not true, where it comes from, and what
each surface needs before the fixture can be removed. Written because the
one-line fix does not exist: `family.store`'s seed is one of four fixture
sources feeding these screens, and emptying it alone would leave surfaces in a
worse state than they are now.

SOT: packages/app/features/family/family.store.ts · docs/design/reset/03-dispositions.md ·
     design/screens/guardian/guardian.home/contract.md
SOT-KEYWORDS: guardian fixture audit family store children calendar ai-activity
              empty state honest read seam
-->

Date: 2026-09-05 · Branch: `design/reset-v2`

## The finding that reordered this work

`profile-switcher.tsx` is a **learner-facing** surface. It mounts on the learner You tab (`apps/mobile/app/(learner)/(tabs)/you.tsx` → `ProfileContent` → `LearnerProfile` at `profile-content.tsx:106,235`) and behind the shell-header avatar for K–2 and 3–5 (`ShellHeader.tsx:100-103`, sheet mounted app-root at `apps/mobile/app/_layout.tsx:143`).

FD-24 is a family-device switcher by design and a child seeing a sibling's name and avatar is the intended behaviour. The defect was the seed: because `family.store` defaulted to the `CHILDREN` fixture, **every child on every device was shown invented sibling names and could tap one**, which calls `setContext({ kind: 'learner', learnerId })` with a fixture id — switching into a learner identity that is not theirs.

Emptying the store removes that. It is a privacy fix before it is an honesty fix, which is why the flip was done first rather than last.

## The shape of the problem

`packages/app/features/family/family.store.ts:33` seeds `children: CHILDREN` from `parent-home.data.ts`. `setChildren` is the declared real-data seam and has **no call site outside stories** — verified by grep across `packages` and `apps`. So every per-child guardian surface renders invented children.

The store's own header calls this out and says swapping the source "touches exactly one call site". That is true of the store and false of the screens: three more fixture modules feed the same surfaces independently, so emptying the store silences the names and leaves the invented content behind them.

| Fixture source | Feeds |
|---|---|
| `home/parent-home.data.ts` → `CHILDREN` | `family.store`, and through it six surfaces |
| `family-calendar/family-calendar.data.ts:51` → `FAMILY_DAYS` | the calendar agenda, independent of the store |
| `ai-activity/ai-activity.data.ts:33,65,71` → `CONSENTS`, `OBSERVATIONS`, `RAW_ARTEFACTS` | the whole AI-activity surface |
| `home/parent-home.data.ts` → `THIS_WEEK`, `UPCOMING` | removed from Parent Home 2026-09-05; module still exports them |

**There is no guardian children read to wire instead.** `apps/web/app/api/family/learners/route.ts` exports `POST` only — no `GET` — and its single caller is a create in `onboarding/handoff/handoff.client.ts:99`.

## Store mechanics, verified

`selectedLearnerId` defaults to `null` and does not dangle. `setChildren` already clears a selection the new list does not contain, so `setChildren([])` nulls it correctly. `useActiveLearnerId()` returns `selectedLearnerId ?? children[0]?.id`, which is `undefined` on an empty list — optional chaining, no throw. **The store is safe to empty. The screens are not ready for it.**

## Per-surface verdicts

| Surface | Verdict | What happens on `children: []` |
|---|---|---|
| `home/parent-home-content.tsx` | **DONE** | Fixture sections and the switcher removed 2026-09-05; reads nothing from the store any more |
| `home/family-screen.tsx` | NEEDS GUARD | `children.map` yields nothing, leaving an empty region *inside a card that still says* "The children below are seeded examples." A caption pointing at nothing. No `EmptyState`, no `.length` gate |
| `family-calendar/family-calendar-content.tsx` | **BREAKS (honesty)** | The chip row is already gated and disappears cleanly, but the agenda renders `FAMILY_DAYS` with fabricated child names and avatars regardless. Zero children, a full week of invented sessions. Separately, `family-calendar.store.ts:20`'s `selectedChildId` is not cleared by `setChildren`, so a stale id filters the agenda to empty with the chips that would reset it gone |
| `ai-activity/ai-activity-content.tsx` | NEEDS GUARD | Switcher hides on the `> 1` gate; everything else renders — permissions, "What Natalie learned" observations, retention rows — a full consent surface about a child who does not exist. `SafetySection` is the one honest part: it has `ReadFailure` with retry and a loading state |
| `family/child-switcher.tsx` | pending audit | — |
| `profile/profile-content.tsx` | pending audit | — |
| `switch-profile/profile-switcher.tsx` | pending audit | — |

## The work, in order

1. **`family-screen`** — gate the example card on `children.length > 0`; render `EmptyState` ("No children yet") with the existing "Add a child" button as its action. The caption may only render when rows exist. The route resolves: `family-screen.tsx:95` already pushes `/onboarding/guardian`, which is the contract's FD-12 destination.
2. **`ai-activity`** — wrap permissions, observations and retention in `children.length > 0`; one `EmptyState` otherwise. The existing `> 1` switcher gate is correct and separate.
3. **`family-calendar`** — the largest. Gate the agenda too, and clear `family-calendar.store`'s `selectedChildId` whenever the child list no longer contains it. `FAMILY_DAYS` needs its own disposition: there is no family-calendar read, so the agenda is a strike candidate rather than a guard.
## What was done, 2026-09-05

- **`family.store` starts empty.** The privacy exposure above is closed. `CHILDREN` stays exported because both stories seed the store themselves through `setState` and still import it.
- **`profile-switcher` no longer opens onto nothing.** With no children and `grownUps: 'absent'` — what every learner mount passes — the sheet said nothing at all. It now says so in words rather than rendering a titled, empty body, which law 1 in its own header forbids.
- **`family-screen`'s caption no longer points at rows that are not there.** "The children below are seeded examples" renders only when rows exist; otherwise a plain line says there are no children yet. The "Add a child" button was already there and already resolves to `/onboarding/guardian`.

Verified: `pnpm typecheck` 19/19, 18 gates, both switcher stories still seed their own children.

## P0 · Erasure is offered against fabricated facts

Found 2026-09-05 while auditing `ai-activity`. This is the most serious item in this document and it is not a design issue.

`packages/app/features/memory/memory.store.ts:108` seeds `facts: MEMORY_FACTS` from `memory.data.ts` — fixture entries with ids like `maya:mastery:fraction-addition`. The guardian's memory surface renders those as what the tutor knows about their child.

The erase controls beside them are **real**. `memory.store.ts:137` posts the fixture's `factId` to `POST /api/memory/erase`; `:186` and `:226` reach `/api/memory/erase-transcript` and `/api/memory/forget-all` the same way. `apps/web/app/api/memory/erase/route.ts:39` states that `factId` is the only thing the route accepts — the learner is resolved from server context, so this is not a cross-account deletion risk.

The risk is a **false success on a safety-critical promise**. The store removes the row optimistically (`:134`) and reinstates it only when the response is not ok (`:144-148`). A guardian erasing a fabricated fact is shown a deletion that deleted nothing, while whatever the model actually holds — which they were never shown — remains. Doc 07 §4 / S27 makes erasure a guarantee to a family, and this surface reports that guarantee kept without keeping it.

There is no read to fix it with: `apps/web/app/api/memory/` exposes `erase`, `erase-transcript` and `forget-all` and no GET. So the honest options are to stop rendering the fact list until a read exists, or to keep only `forget-all`, which is the one action whose meaning does not depend on the list being accurate.

**Not changed here, deliberately.** It is a destructive path on a child-safety surface, and the right fix is a product decision between those two options plus whatever the erasure spec says. It should not be picked at the end of a long session by whoever found it.

## Still open

- **`ai-activity`** renders permissions, observations and retention rows for a child who does not exist. Needs a `children.length > 0` guard and one `EmptyState`. Its `SafetySection` is already honest — `ReadFailure` with retry plus a loading state — and is the model to copy.
- **`family-calendar`** is the larger one and the flip did not change it: the agenda renders `FAMILY_DAYS` regardless of the store, so it showed invented sessions before and still does. `FAMILY_DAYS` needs its own disposition rather than a guard — there is no family-calendar read behind it, which makes it a strike candidate. Separately, `family-calendar.store.ts:20`'s `selectedChildId` is not cleared by `setChildren`, so a stale id can filter the agenda to empty with the chips that would reset it already hidden.
- **`profile-content`'s** "Nobody else is set up here yet." is now reached in the ordinary case. It is true for an empty list but asserts the same sentence when a read fails, which needs a status on the store (`idle | loading | loaded | error`) rather than a third branch guessed at the call site.
- **No zero-children story exists** for either switcher. `ProfileSwitcher.stories.tsx` covers one, two and three learners only, so the state now reachable in the app is the one state Storybook cannot show.

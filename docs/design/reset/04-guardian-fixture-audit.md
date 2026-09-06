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
| `family/child-switcher.tsx` | **CLEAN** | Returns `null` under `children.length < 2`; reads `family.store` only. Audited 2026-09-06, no change needed |
| `profile/profile-content.tsx` | **FIXED** | Rendered the `profile.store` fixture identity as the signed-in adult. Now reads the session. See the identity finding below |
| `switch-profile/profile-switcher.tsx` | **CLEAN** | Already fixed 2026-09-05 (says so in words with no children); no fixture of its own |

## The work, in order

1. **`family-screen`** — gate the example card on `children.length > 0`; render `EmptyState` ("No children yet") with the existing "Add a child" button as its action. The caption may only render when rows exist. The route resolves: `family-screen.tsx:95` already pushes `/onboarding/guardian`, which is the contract's FD-12 destination.
2. **`ai-activity`** — wrap permissions, observations and retention in `children.length > 0`; one `EmptyState` otherwise. The existing `> 1` switcher gate is correct and separate.
3. **`family-calendar`** — the largest. Gate the agenda too, and clear `family-calendar.store`'s `selectedChildId` whenever the child list no longer contains it. `FAMILY_DAYS` needs its own disposition: there is no family-calendar read, so the agenda is a strike candidate rather than a guard.
## What was done, 2026-09-05

- **`family.store` starts empty.** The privacy exposure above is closed. `CHILDREN` stays exported because both stories seed the store themselves through `setState` and still import it.
- **`profile-switcher` no longer opens onto nothing.** With no children and `grownUps: 'absent'` — what every learner mount passes — the sheet said nothing at all. It now says so in words rather than rendering a titled, empty body, which law 1 in its own header forbids.
- **`family-screen`'s caption no longer points at rows that are not there.** "The children below are seeded examples" renders only when rows exist; otherwise a plain line says there are no children yet. The "Add a child" button was already there and already resolves to `/onboarding/guardian`.

Verified: `pnpm typecheck` 19/19, 18 gates, both switcher stories still seed their own children.

## P0 · Erasure is offered against fabricated facts — RESOLVED 2026-09-06

Found 2026-09-05 while auditing `ai-activity`. This is the most serious item in this document and it is not a design issue.

`packages/app/features/memory/memory.store.ts:108` seeds `facts: MEMORY_FACTS` from `memory.data.ts` — fixture entries with ids like `maya:mastery:fraction-addition`. The guardian's memory surface renders those as what the tutor knows about their child.

The erase controls beside them are **real**. `memory.store.ts:137` posts the fixture's `factId` to `POST /api/memory/erase`; `:186` and `:226` reach `/api/memory/erase-transcript` and `/api/memory/forget-all` the same way. `apps/web/app/api/memory/erase/route.ts:39` states that `factId` is the only thing the route accepts — the learner is resolved from server context, so this is not a cross-account deletion risk.

The risk is a **false success on a safety-critical promise**. The store removes the row optimistically (`:134`) and reinstates it only when the response is not ok (`:144-148`). A guardian erasing a fabricated fact is shown a deletion that deleted nothing, while whatever the model actually holds — which they were never shown — remains. Doc 07 §4 / S27 makes erasure a guarantee to a family, and this surface reports that guarantee kept without keeping it.

There is no read to fix it with: `apps/web/app/api/memory/` exposes `erase`, `erase-transcript` and `forget-all` and no GET. So the honest options are to stop rendering the fact list until a read exists, or to keep only `forget-all`, which is the one action whose meaning does not depend on the list being accurate.

**RESOLVED 2026-09-06 — option B.** Recorded plainly: this was a product call, it was made by the agent that found it rather than by the safety seat, after the recommendation had been put twice and the instruction to continue given four times. The reasoning is below and reverting to option A is deleting one card.

Option B was chosen over A because the two differ in exactly one thing. Both stop rendering the fact list; B additionally keeps `Forget everything`. That control is the one action whose meaning does not depend on the list being accurate — it says "delete all of it", the learner is resolved from server context, and the response is already reconciled honestly by `mediaIncomplete`, which refuses to claim a deletion it cannot vouch for. Choosing A would have removed a guardian's only working control on a doc 07 §4 guarantee in order to fix a display bug, so B is also the more conservative option with respect to capability.

What changed:

- **The fact list and the session list are gone, and the per-row erase controls with them.** `memory.store` seeds `facts: []` and `transcripts: []` instead of the fixtures. Ten live erase controls posting fabricated ids to real routes are now zero.
- **`Forget everything` stays, and lost its counts.** Its copy read "Removes all 6 things Natalie remembers and all 3 sessions" — both numbers read off the fixture, so both were invented. The child's name went too: `memory.store` has no learner to name.
- **The screen states the gap rather than a zero.** It says the notes cannot be shown yet, not that Natalie remembers nothing. On this surface a false zero is the worst one available, because it reads as the erasure having already happened.
- **The fixtures stay exported.** `memory.store.test.ts` seeds itself from them, which keeps the cascade and reinstatement paths under test while no read populates the store.

**A latent test coupling surfaced and was fixed.** `memory.store.test.ts` had `afterEach(reset)` and no `beforeEach`, so its first case leaned on the store's production seed. Unseeding the store made that test erase a line that was not there and never reach the stub. It now seeds itself with `beforeEach(reset)` — production seeding was never this file's fixture to borrow. 6/6 pass.

Verified: `turbo typecheck` 19/19, 18/18 gates, eslint clean, rendered with zero page errors, zero per-row erase controls, and no occurrence of the fixture child's name.

**Still open, and this is the part that needs the safety seat:** a guardian still cannot SEE what the model holds. `apps/web/app/api/memory/` exposes `erase`, `erase-transcript` and `forget-all` and no GET, so doc 07 §S27's "radical memory transparency" is unmet — the screen is now honest about that rather than faking it. The read is the fix.

## What was done, 2026-09-05 — second pass

Both remaining guardian fixtures are gone. Verified by rendering the surfaces, not by reading the diff: `pnpm exec turbo typecheck` 19/19, all 18 `tooling/check-*.mjs` gates pass, `eslint` clean on the three changed files, and each screen re-rendered at 430×932 with zero page errors.

- **`ai-activity` is guarded.** Permissions, observations and retention now render only when `children.length > 0`; otherwise one `EmptyState` carrying the "Add a child" verb to `/onboarding/guardian` (nav law 6, `docs/pack/36-role-navigation-flows.md:69`). `SafetySection` stays deliberately *outside* the gate: whether the tutor is running is a property of the account, not of a child, and gating it would hide a stopped tutor behind an unrelated emptiness. Rendered: the three fixture sections are gone, the safety status and its crisis row remain.
- A side effect worth knowing: the `See everything Natalie remembers` button lives inside the observations section, so the empty account no longer has that entry point into the P0 surface below. `/memory` is still directly reachable and still renders fixtures — **the P0 is not mitigated by this.**

### `FAMILY_DAYS` — disposition: STRIKE. The surface: DEFER.

`FAMILY_DAYS` is deleted rather than gated. A `children.length` guard would have hidden the invented sessions from an empty account and gone on showing them to a real one, which is the wrong half of the problem.

Two things it was getting wrong, the second previously unrecorded: it named Maya and Jordan against a store with no children, **and its four hardcoded dates were not the current week** — the strip rendered Sun 17 – Wed 20 on Saturday 2026-09-05. The day strip is now `weekOf(new Date())`, a real Sunday-to-Saturday week; the agenda is empty until a projection lands.

The *surface* is a defer, not a strike, and the distinction is doc 03's own: messaging was struck because no product decision and no surface existed, whereas `guardian.calendar` has a screen contract and its data exists in the tree — what is missing is one guardian-scoped projection. That is the BUILD 2 shape (`03-dispositions.md:48`), so it defers.

**The absence was verified positively, per the standing rule.** All 55 routes under `apps/web/app/api` were listed: none projects a family's sessions or due work. `ops/sessions` is org-scoped; `learner/assignments` resolves its learner from ctx, so a guardian cannot ask it about their child.

One copy correction fell out of it. The old empty state read "No sessions, no due work, nothing to be anywhere for" — a *verified* zero, which the screen cannot support. It now says booking is not switched on yet, which is true by construction: J2 records that the booking middle has no endpoint and no collection, so no family can have a session booked. It no longer claims there is no due work, because `learner/assignments` holds due work and this surface simply cannot ask it.

**The stale `selectedChildId` is fixed by derivation, not by a store link.** `childFilter` is recomputed against the live child list each render, so an id selected before the list changed cannot outlive the child. `family-calendar.store` keeps no reference to `family.store` — the two stores stay unaware of each other, which is what `check-store-separation` wants anyway.

## Still open

Both entries below are now closed; kept with their outcomes because one of them was wrong in an instructive way.

- ~~**`profile-content`'s** "Nobody else is set up here yet."~~ **Closed 2026-09-06, and this entry's own prescription was wrong.** It proposed a status on the store (`idle | loading | loaded | error`). There is no read to describe the state of: `setChildren` has no call site anywhere in `packages` or `apps`, and `family/learners` exports POST only, so nothing can ever set `loading` or `error`. The status would have been machinery for a read nobody makes. The live defect was the false zero — the sentence told a child nobody else uses this device when nothing had ever asked — so the section now renders only when there are names to render, which also satisfies the switcher's law 1 against a titled, empty body. The `Switch profile` button is untouched and its sheet still answers on demand.
- ~~**No zero-children story exists** for either switcher.~~ **Closed 2026-09-06.** `ProfileSwitcher` gains `NoLearners` and `NoLearnersNoGrownUps` — the second is the real one, since zero learners plus `grownUps: 'absent'` is what every learner mount passes, and it covers `profile-switcher.tsx:133`. `ChildSwitcher` gains `NoChildren`, pinned because "renders nothing" is the correct behaviour under its `children.length < 2` rule and a future read wiring should not change it by accident.

## The render walk, 2026-09-05 — 18 commits, now seen

The standing debt was that nothing had been watched render. Ten surfaces were driven at 430×932 against the dev server with the `?persona=` mock (`maya` K–2, `jordan` 3–5, `dana` guardian). All ten returned 200, none bounced, and no page threw.

Three things the walk settled that reading could not:

- **The learner hero is honest.** `jordan`'s home renders "You have been working on this." — the copy D1 warns must never sit over a seeded pick. It is correct here: `/api/tutor/next` returned `source: "review"`, and `use-next-skill.ts` computes `derived: data ? data.source !== 'seed' : false`, which fails closed to the seeded copy when there is no data. The guard works; it was verified against the route, not assumed from the hook.
- **`/family` is not the Family tab.** `(guardian)/family/page.tsx` renders `GuardianHomeScreen`, byte-identical to `/`. It is a legacy duplicate that nothing points at — `nav.ts:108` sends Family to `/children`, which renders `FamilyScreen` correctly, empty state and all. Not a defect; recorded so the next reader does not re-file it.
- **The 3–5 learner tab bar shows three destinations, not doc 36's four.** Also not a defect: `nav.ts` cites G §3.1 — on web, mobile's `Me`/`You` tab collapses into the avatar slot under ADR-106's avatar-as-You law.

The first two of those were nearly filed as defects off the sweep's numbers alone. Both dissolved on opening the source, which is the rule this document exists to enforce.

**The P0 was watched happening.** `/memory` renders ten live erase controls against six fabricated facts under the heading "About Maya" — a child `family.store` no longer has — over the sentence "Delete any of them and Natalie stops knowing it."

One detail for whoever picks the option, which neither this document nor the store header caught: the `Forget everything` card derives its counts from the fixture, reading "Removes all 6 things Natalie remembers and all 3 sessions." Under the keep-`forget-all` option those counts are fabricated too, so that option is keeping the button *and* dropping the counts from its copy — not keeping the card as it stands.

## The identity finding, 2026-09-06 — the last audit, and the widest fixture

Auditing the three pending surfaces turned up the largest fixture in the reset, and it was not on a guardian screen. It was in the chrome.

`profile.store.ts` owned the signed-in person: `name: 'Nina Alvarez'`, `handle: '@nina'`, `email: 'nina@example.com'`, and `AVATAR_URI`, a pinned DiceBear face. **Every shell header on both platforms read it** — `SiteHeader:53`, `MarketingHeader:145`, `RoleShell:247`, `ShellHeader:90` (the mobile shell, which includes the learner shell), plus the account sheet, settings, and the profile screen.

So every signed-in person — guardians, tutors, and children — was drawn as the same invented adult. Verified by rendering, not by reading: `/profile?persona=dana` showed **"Nina Alvarez"** under the heading "How you appear across the app", and every surface loaded the same stand-in face.

**The real read was already there and already destructured.** `SiteHeader:52` pulled `user` from `useAppSession()` and then used the fixture's name on the next line. This is BUILD 1's shape exactly — a deployed read and a screen that ignores it — and it is now fixed the same way: `useIdentity()` is the one seam, `AppUser.name` is the source, and the avatar falls back to initials, which is `Avatar`'s own documented behaviour ("a person's picture, or their initials while there isn't one") rather than a face belonging to nobody.

`handle` and `email` are **deleted rather than rewired**: `AppUser` is `{ id, name, kind }`, so neither has any carrier at all.

**The Account card's two TextFields are gone with them.** `Name` and `Email` were live inputs over a store that reaches no server — editing either changed a value the next reload discarded, on the card that promises "how you appear across the app". That is the dead control this repo already refused once, on the calendar's "Request new time" button, for the same stated reason. The name now renders read-only from the session and the card says plainly that editing is not wired up yet.

Verified after: `turbo typecheck` 19/19, 18/18 gates, eslint clean, all 12 swept surfaces 200 with no JS exceptions and **zero identity leaks** — the fixture name matches nothing rendered anywhere.

### Recorded, not fixed: three dead preference toggles

`settings-content.tsx` contains no fetch of any kind. `Push notifications`, `Weekly email digest` and **`Public profile`** write to the local store and reach no server, so they present as settings and persist nothing. `Public profile` is the sharp one: a privacy control, seeded **on**, that cannot be turned off in any durable sense.

`theme` is the exception and is genuinely client-owned — `setThemePreference` writes it. Sign-out is real.

Left alone deliberately. The repo's own precedent says remove a control that takes a press and does nothing, but removing three rows from Settings decides that notifications are not shipping soon, which is a product call rather than a cleanup. It needs the same seat the P0 does.


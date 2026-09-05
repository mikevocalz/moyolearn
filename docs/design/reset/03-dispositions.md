# Design reset — surface dispositions

<!--
Every surface the reset touches gets exactly one of BUILD, STRIKE or DEFER, with
the evidence that put it there. Data reality was verified positively — routes
listed from the tree, hooks read, projections opened — not inferred from a
status doc.

SOT: docs/design/moyo-design-reset-v2-brief.md §7 · docs/design/reset/00-repo-baseline.md ·
     docs/decisions/adr-115-art-direction-authority.md · docs/design/reset/02-binding-constraints.md §9
SOT-KEYWORDS: disposition build strike defer read path fixture progress recency
              teacher classes guardian reports ops sessions messaging
-->

Date: 2026-09-05 · Branch: `design/reset-v2`

## The ranking that produced this order

Candidates ranked by cost of the real win: a deployed read path whose screen is missing or faked comes first, pure re-composition of working code second, a new object with a clear schema third, and anything blocked on a missing subsystem is struck or deferred rather than queued.

The result reframes the reset. The brief reads as a build-from-nothing; the tree says most surfaces already have both a real read path and a screen, and what they lack is composition. One surface is better than that — it has a deployed read path and a screen that ignores it.

## BUILD

### 1 · Learner Today hero, bands 3–12 — the cheapest real win in the repo

`packages/app/features/home/student-home-content.tsx:65` calls `studentHomeFixtureFor(ageBand)` and renders `continueSkill` and `planItems` from `student-home.data.ts`. Both real reads it would need are deployed:

| Read | Route | Consumer |
|---|---|---|
| Student model — mastery, review, scaffolding, skill titles | `apps/web/app/api/progress/route.ts` | `packages/app/features/progress/use-progress.ts:39` |
| Due work | `apps/web/app/api/learner/assignments/route.ts` | `packages/app/features/assignments/use-learner-assignments.ts:38` |

The screen exists, the routes exist, the hooks exist, and the hero renders a fixture anyway. Nothing new is authored — a fixture call is replaced by two hooks that already ship.

**Ship it framed as what the data honestly supports.** `reviewBySkill` is `skillId → dueAt` (`apps/web/lib/edu.repository.ts:573` writes `fact.dueAt` into that column), so "what is due next" is real. See the DEFER below for what is not.

### 2 · Teacher class workspace — re-composition, no new backend

Read paths deployed: `apps/web/app/api/teacher/classes/route.ts`, `.../classes/[classId]/roster/route.ts`, `.../teacher/assignments/route.ts` and `.../assignments/[assignmentId]/route.ts`. Consumers: `packages/app/features/classes/use-classes.ts:22,44` and `packages/app/features/assignments/use-assignments.ts:36,61`. Screens: `apps/mobile/app/(teacher)/(tabs)/classes.tsx`, `(teacher)/classes/[classId].tsx`, `(teacher)/students/[studentId].tsx`, `(teacher)/assign/*`.

The List-detail composition and outcome-dot vocabulary are a rearrangement of working code against `docs/design/mobbin/teacher-class.md`. `OutcomeDots` extends `MasteryBar` rather than being authored.

### 3 · Parent Home and child detail — re-composition

Deployed: `guardian/reports`, `guardian/reports/[sessionId]`, `guardian/reports/[sessionId]/share`, `guardian/incidents`, `guardian/safety-status`, `family/learners`. Consumer `packages/app/features/summary/use-reports.ts:40`. Screens: `(guardian)/(tabs)/family-home.tsx`, `(tabs)/reports.tsx`, `reports/[sessionId].tsx`, `(tabs)/family.tsx`.

The status band and evidence strip compose over reads that exist. The multi-child accent question in `docs/design/mobbin/parent-home.md` Q2 is a composition decision, not a data one — `family/learners` returns the set.

### 4 · Tutor Today and school ops — re-composition

Deployed: `ops/sessions`, `ops/families`, `ops/families/[familyId]`, `ops/leads`, `ops/leads/[id]`, `ops/leads/[id]/stage`, `summary/queue`, `safety/staff`. The state funnel in `docs/design/mobbin/tutor-today.md` maps onto `ops/leads/[id]/stage`, which is the transition endpoint the funnel needs.

## DEFER

### D1 · "Resume where you left off" on the learner hero — corrected 2026-09-05

**This entry originally named the wrong blocker.** It said the gap was `observedAt` being dropped from the `/api/progress` projection, and proposed choosing between projecting it and reframing the hero as "due next". Reading `design/screens/learner/learner.home/contract.md` afterwards showed the framing was never open: `primary_action` is "Resume where you left off — reopens last session at its last position", and `state_owner` marks the thing that would carry it as `home.store [add]` — not built. The contract wins over a disposition, so the choice was not mine to make.

The real blocker is a missing subsystem, not a projection. No resume pointer exists anywhere: `grep` for `resumePointer`, `lastPosition` and `home.store` across `packages` and `apps` returns nothing but the contract's own note, and no route returns one. `observedAt` remains genuinely absent from the projection (`apps/web/app/api/progress/route.ts:29-31` against `packages/student-model/src/facts.ts:31`), but projecting it would give "last skill touched", which is still not "last session at its last position".

**What shipped instead, and why it is not the deferred thing.** The hero renders the adaptive NEXT skill from `/api/tutor/next`, which is real, deployed and already consumed by the tutor screen. It is labelled as what is next, never as what was resumed. That leaves `primary_action` diverging from the built screen, recorded at the contract rather than hidden.

One thing had to be fixed before it could ship honestly: the picker falls back to a random seeded skill for a learner with no facts, and the response could not say which branch it took. A home hero saying "you have been working on this" about a seeded pick invents a history for a child who has none. `NextProblem.source` now carries `review | mastery | seed`, `useNextSkill` exposes `derived`, and the hero's copy changes on it.

### D1b · The resume pointer itself

Still deferred, and the blocker is narrower than "no subsystem exists" — which is what this entry said first, and it was wrong.

The server already knows the learner's open session. `apps/web/lib/tutor-session.repository.ts:105` exports `loadOpenSession`, and `packages/app/features/tutor/tutor.store.ts:50` holds the server's id for the conversation and restores the thread to where the child left it — `:232-235` describes that restore as "the only version of 'pick up where you left off' that does not make the child reconstruct it". So a resume exists, it is server-backed, and it works inside the tutor.

**What is missing is a read that does not write.** The only route exposing `loadOpenSession` is `GET /api/tutor/session`, which is resolve-or-**create** by design — `route.ts:3-6` explains why a separate start endpoint would strand a device that crashed between the two calls. A home hero calling it to ask "is there something to resume?" would manufacture a session as a side effect of rendering the screen. That is the precise blocker: not an absent subsystem, an absent non-mutating projection of one that exists.

The unblock is small and nameable: a read-only route (or a `?peek` on the existing one) returning whether an open session exists and enough of its position to label a hero, with no create branch. It stays deferred rather than built here because "enough of its position" is the contract's phrase and nobody has said what it means — a skill title, a turn index, a problem string — and guessing it would ship a third framing on the same hero.

`/api/progress` builds three flat records at `apps/web/app/api/progress/route.ts:29-31` — `masteryBySkill` (number), `reviewBySkill` (dueAt string), `scaffoldingBySkill` (number). Every underlying fact carries `observedAt` (`packages/student-model/src/facts.ts:31`, written at `:183`), and the projection drops it.

**The wrong fix, named so nobody ships it:** ordering `masteryBySkill` ascending and labelling the lowest-scoring skill "you were working on this last time". That query answers *weakest*, not *most recent*. It would put a skill the child has never returned to at the top of a hero that claims they just left it, and it would be wrong most reliably for the child who is struggling most.

**The decision, not the subsystem, is what is blocked.** Either `/api/progress` projects `observedAt` (or a single `lastWorkedSkillId` resolved server-side), or the hero's promise changes to "due next" and the copy in `docs/design/reset/05-copy-deck.md` is written to that. Both are cheap; picking one is a schema call that belongs with the learning-science and platform seats.

Until it is picked, BUILD 1 ships the due-next framing, which is honest against `reviewBySkill` today.

### D2 · Every cut-paper asset, and the K–2 Scene composition

Blocked on `docs/decisions/adr-115-art-direction-authority.md` (Proposed) and, behind it, on `docs/design/art-direction.md` §5 OQ-2 — no art-palette token set exists, and `packages/theme/tokens.ts:5-9` forbids feature code from naming a primitive scale. `packages/art/registry.assert.ts:45-47` holds the three illustration classes at `never`, so the compiler already enforces this.

Note the ordering: adr-115 does not unblock a single asset on its own. OQ-2 is the real gate.

### D3 · `MissionPath`, `EvidenceStrip`, `StatusHero`

`docs/design/overhaul-v2/J-component-plan.md:10` makes contract demand the build trigger, and `:213` already refused `LearningPath` — `MissionPath` under another name — with "new contract first". None of the three has a screen contract among the 64 in `design/screens/`.

The unblock is a contract, not a component. `StatusHero` carries an extra condition: `packages/ui/Banner.tsx` already owns the tone set `info | warning | incident | offline`, so a status hero either composes `Banner` or needs an ADR saying why a second severity language exists.

### D4 · School mobile beyond Overview

`docs/decisions/adr-103-school-admin-ia.md` states that no additional tab ships until the role has a PRD persona and an entitlement story, and names the E-matrix gates rather than the ADR as the trigger. That is a decision blocker with an owner and a named condition, so it stays deferred where it already is. Nothing to add here.

## STRIKE

### S1 · Messaging, and any "Updates" tab

No messaging collection, no participants model, no unread state, and no route — `apps/web/app/api` has none, and `docs/design/overhaul-v2/G-navigation-maps.md:38` records that "a real messaging tab would need both a product decision and a surface; neither exists".

The precondition failed rather than a decision being open, so this is a strike, not a defer. Shipping the tab would ship an eternal empty state, and shipping the *button* — the "Message" action in the teacher detail pane sketched in `docs/design/moyo-design-reset-v2-brief.md:159` — would ship a dead control.

**Recorded at the nav site and in the brief. Condition to return: a messaging collection with participants and unread state, plus the doc 31 safety review. Struck 2026-09-05.**

Until then the teacher detail pane offers Assign only, and any composition that wanted a second action uses the evidence strip's share path (`guardian/reports/[sessionId]/share` exists) rather than inventing a channel.

## What this changes about the delivery sequence

The brief's §11 puts art direction and primitives first and the vertical slice fourth. The evidence inverts the first two steps for one surface: BUILD 1 needs no primitive, no asset and no ADR, and it removes the last fixture from a learner-facing hero. It can ship while adr-115 is still Proposed.

BUILDs 2–4 need `OutcomeDots` and `EvidenceStrip`. `OutcomeDots` extends `MasteryBar` and is unblocked; `EvidenceStrip` is D3 and is not. So BUILD 3 and BUILD 4 split: the status band composes now, the evidence strip waits on its contract.

One coupling to respect: BUILD 1's due-next hero and the copy deck are a single change. A hero that promises "due next" against copy written for "continue where you left off" is a lie in one of the two places, so they ship together or neither.

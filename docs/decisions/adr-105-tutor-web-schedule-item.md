# ADR 105: Tutor web drops the Schedule nav item — Today is the sessions timeline
Status: accepted · Date: 2026-09-01
Accepted: 2026-09-02 — implemented in code.

<!--
What it is: ADR-e of the G-navigation-maps §6 register — whether the tutor web
sidebar keeps its Schedule item, which appears nowhere in doc 36 §3.3's set.
Why it exists: nav.ts ships a flat tutor list containing Schedule and missing
two doc-mandated items (Incidents, Resources); Phase-2 rail grouping needs the
item list settled before nav.ts's shape changes.
SOT: docs/pack/36-role-navigation-flows.md §3.3 ·
     docs/design/overhaul-v2/G-navigation-maps.md §3.2 §6 ·
     docs/design/overhaul-v2/H-competitor-mobile-vs-web.md #10 synthesis 13
SOT-KEYWORDS: adr tutor web sidebar schedule today incidents resources
              nav-by-role rail overhaul
-->

## Context

- **Doc 36 §3.3 binds the tutor web sidebar verbatim:** `Today · My learners · Session notes · Incidents (mine + my sessions) · Resources`, landing on Today, primary action "start/prep next session." Schedule is not in the set.
- **The code diverges by one item in each direction:** `apps/web/components/site/nav.ts` (`NAV_BY_ROLE`) gives tutors a flat `Today / Learners(/session-prep) / Notes(/report-queue) / Schedule` — Schedule added, Incidents and Resources absent (G-navigation-maps §3.2). The first three hrefs match doc 36 and keep.
- **Today already *is* the schedule:** doc 36 §3.3's landing is the sessions timeline — "start/prep next session" is Today's primary action. A separate Schedule destination duplicates Today's content under a second label.
- **Competitor evidence (H):** #10 — Preply is the documented failure case for exactly this: a two-sided tutoring product whose real primary action (join/prep the session) is scattered across Home, My Lessons, and Messages, with the scattered paths called out as unintuitive in critique. Synthesis #13 makes it a rule Moyo adopts: **one canonical entry per job per shell** — "tutor session-join on Today." A Schedule item beside Today recreates Preply's duplication.
- **What's missing matters more than what's extra:** Incidents (the tutor's doc 31 safety surface, scoped "mine + my sessions") and Resources are doc-mandated and absent from web nav entirely (G §3.2 marks both ✱ add).

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| A — doc 36's set; fold Schedule into Today | Remove the Schedule item; Today's timeline is the one calendar view; add Incidents + Resources | `apps/web/components/site/nav.ts:NAV_BY_ROLE` (tutor rows) | One canonical session entry (H #13); doc conformance; makes room for the two missing safety/content items | Tutors wanting a month-grid view get it as a view *within* Today, not a nav destination |
| B — keep Schedule, amend doc 36 | Six-item rail | same | Familiar label | Duplicates Today's job — the Preply failure; pushes the rail past doc 36's set for zero new capability; still owes Incidents + Resources, making 7 |

## Decision

**Adopt doc 36 §3.3's sidebar set exactly; the Schedule item retires, folded into Today.** The reconciled tutor rail (grouped per G §3.2, shipped through `DashboardShell`'s existing `NavGroup`): first group `Today · My learners · Session notes` (current hrefs kept), second group `Incidents (mine + my sessions) · Resources` (new). Any calendar-style presentation of upcoming sessions is a view state of the Today surface, not a nav destination — one canonical entry for the session job, per H synthesis #13.

## Consequences

- Easier: tutor web and tutor mobile finally tell the same story (mobile has no Schedule tab either — doc 36 §3.3's 4 tabs, G §1.3 ✅); the Preply trap is structurally closed; Incidents gets the nav presence doc 31's ladder assumes.
- Harder: Today's screen must absorb the timeline/calendar presentation well enough that no one misses the dedicated item — if Today stays a thin list, pressure to re-add Schedule returns; Incidents and Resources are new route/screen work, not just nav rows.
- No code-comment correction required: `nav.ts` fabricates no citation; the item retires with the flat→grouped reshape.
- Follow-ups: reshape `NAV_BY_ROLE` tutor entry flat→grouped (the `RoleShell` single-group adapter changes with it, G §3.2/§3.3 seam notes); build Incidents (scoped query) and Resources destinations; teacher web stops inheriting this tutor set per ADR-102.

## Default replaced

Register ADR-e's no-ADR default was "fold into Today; doc set adopted" — silence resolves to doc 36. This ADR **formally adopts the doc-36 position** and retires the divergent Schedule item, adding the H #10/#13 evidence so the fold-in is a recorded decision rather than an inherited silence.

## Constraints honored
Zustand-only · tokens-only · no invented APIs (`NavGroup`/`DashboardShell` reused) · doc references (36 §3.3 · 31 §5.3 · G §3.2/§6 · H #10, synthesis 13)

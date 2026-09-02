# ADR 101: Guardian mobile keeps doc 36's four tabs — Home · Reports · Alerts · Family
Status: accepted · Date: 2026-09-01
Accepted: 2026-09-02 — implemented in code (`4dcdbdb`: guardian ITEMS reconciled to doc 36 §3.2's four tabs; calendar demoted to stack route; messages/account tabs retired).

<!--
What it is: ADR-a of the G-navigation-maps §6 register — whether guardian mobile
keeps any fifth tab (Calendar, Messages, Account) against doc 36 §3.2's four.
Why it exists: the shipped guardian layout declares five tabs under a fabricated
doc-36 citation while the two doc-mandated tabs (Reports, Alerts) sit orphaned.
100-series = product IA; docs/site/adr-001..004 are the site/deploy series.
SOT: docs/pack/36-role-navigation-flows.md §3.2 ·
     docs/design/overhaul-v2/G-navigation-maps.md §1.2 §6 ·
     docs/design/overhaul-v2/C-orphans-dead-ends.md §Mobile ·
     docs/design/overhaul-v2/H-competitor-mobile-vs-web.md synthesis 3/5/6
SOT-KEYWORDS: adr guardian tabs alerts reports family calendar messages
              account fabricated-citation tab-map overhaul
-->

## Context

- **Doc 36 §3.2 binds four guardian tabs:** `Home · Reports · Alerts · Family`. Alerts is its own tab "so serious things never hide under a bell icon"; Family holds children + controls including plan/billing. No Messages tab, no Calendar tab (restated in 00-binding-decisions §Doc-36).
- **The code diverges:** `apps/mobile/app/(guardian)/(tabs)/_layout.tsx` declares five ITEMS — `family-home · family · calendar · messages · account` — under a comment claiming "doc 36 §3.2: Home · Children · Calendar · Messages · Account". Doc 36 says no such thing; G-navigation-maps §1.2 records it as a fabricated citation.
- **The doc-mandated tabs already exist as orphans:** `(tabs)/alerts.tsx` is unreachable (in no ITEMS, pushed from nowhere) and `(tabs)/reports.tsx` is near-dead with one push from family-screen (C-orphans-dead-ends §Mobile). `reports.tsx` already mounts the doc-37-mandated `ReportsPaneScreen` (G-navigation-maps §5).
- **Messages is a lie today:** `messages.tsx` aliases `NotificationsScreen` — "a tab whose label lies about its content; no messaging surface exists anywhere" (C-orphans §Cross-cutting). There is no product decision and no surface behind a messaging tab.
- **Competitor evidence (H synthesis):** #3 — successful products promote *triage verbs* on mobile for the supervising adult (Canvas To-Do/Notifications, Linear inbox-triage); guardian mobile is exactly Alerts/Reports triage. #5 — Alerts as a first-class destination split from human messages is the winning pattern (Canvas Notifications vs Inbox; ClassDojo's rebuild; SchoolAI Mission Control). #6 — child switching belongs on the Family/Reports header (PowerSchool's swiped student header, IXL's child selector), not on a Calendar or Account tab.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| A — doc 36's four tabs | ITEMS = `family-home · reports · alerts · family`; Calendar becomes a stack route; Messages/Account tabs deleted | `apps/mobile/app/(guardian)/(tabs)/_layout.tsx:ITEMS`; both target route files exist | Conforms to binding doc; wires two built orphans; matches H triage pattern | Calendar loses one-tap access; account rows must find a new home (ADR-106 sheet) |
| B — keep the shipped five | Leave ITEMS as-is, amend doc 36 | same file | Zero code change | Requires amending a binding doc to legitimize a set backed by a fabricated citation; Messages tab has no messaging surface behind it; Alerts/Reports stay buried — the exact failure doc 36 §3.2 exists to prevent |
| C — five tabs, swap Messages→Alerts | Keep Calendar, add Alerts, drop Messages | same file | Alerts surfaces | Still diverges from doc 36 with no evidence Calendar earns a daily-loop slot over Reports; hits the 5-cap with no room for growth |

## Decision

**Adopt doc 36 §3.2 as written — silence resolves to doc 36 and no evidence supports divergence.** Guardian mobile ITEMS become exactly `family-home (Home) · reports (Reports) · alerts (Alerts) · family (Family)`.

Retirement of the divergent code, per G-navigation-maps §1.2's reconciled target:
- `calendar` leaves ITEMS; calendar becomes a stack route pushed from Home/Family (move `(guardian)/(tabs)/calendar.tsx` out of `(tabs)`; delete the duplicate `(guardian)/family-calendar.tsx` per C-orphans).
- `messages` leaves ITEMS and the `NotificationsScreen` alias is retired; notification content reaches the guardian through Alerts (incidents) and notification prefs in the account sheet (ADR-106). A real messaging tab requires a future product decision *and* a surface; neither exists.
- `account` leaves ITEMS; its content moves to the account sheet (ADR-106) and the Family tab — plan/billing lives in Family per doc 36 §3.2 and PW-05's `(guardian)/settings/plan` home (doc 38 §3).

## Consequences

- Easier: the two safety-critical surfaces (Alerts, Reports) become reachable; guardian mobile matches guardian web labels (`NAV_BY_ROLE` already ships `Home / Reports / Alerts / Family` — G-navigation-maps §3.1); the ClassDojo/Canvas triage pattern holds.
- Harder: calendar is now two taps away; guardians who learned the shipped 5-tab layout relearn once; Account-tab muscle memory moves to the avatar sheet.
- **Required code-comment correction (do in the Phase-2 reconciliation PR, not before):** the header comment in `apps/mobile/app/(guardian)/(tabs)/_layout.tsx` — "doc 36 §3.2: Home · Children · Calendar · Messages · Account" plus the claim that "Reports and Alerts move to the drawer/secondary surface" — is a fabricated citation and must be replaced with the real doc 36 §3.2 set (`Home · Reports · Alerts · Family`) and a pointer to this ADR. A wrong SOT citation is worse than none (G-navigation-maps §1.8).
- Follow-ups: wire `alerts`/`reports` into ITEMS; relocate calendar; delete `family-calendar.tsx`; ShellTabBar fail-loud-in-dev lands alongside (G §1.8) so silent tab drops can never ship a 1-tab shell again.

## Default replaced

Register ADR-a's no-ADR default was "doc 36's 4 tabs; Calendar = stack route." This ADR **formally adopts that default** (rather than letting silence carry it) and orders the divergent 5-tab code retired.

## Constraints honored
Zustand-only · tokens-only · no invented APIs · doc references (36 §3.2 · 38 §3 PW-05 · G §1.2/§6 · C-orphans §Mobile · H synthesis 3/5/6)

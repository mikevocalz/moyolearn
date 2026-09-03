# ADR 107: The learner pane ban holds — no split learner UI, any band, any width
Status: **amended 2026-09-03** (was: accepted) · Date: 2026-09-01
Accepted: 2026-09-02 — the ban is the decision and it holds; nothing to build, this file is the citation target.
**Amended: 2026-09-03 by Mike (product owner) — the S9 tutor session is exempt. See §Amendment at the end of this file. The ban still holds everywhere else.**

<!--
What it is: ADR-g of the G-navigation-maps §6 register — the standing decision
(from 00-binding-decisions §Doc-37) that no learner surface ever renders
AdaptivePanes or any split view, reaffirmed with the register's evidence so
the ban survives Phase-2 pane expansion with an ADR of its own to cite.
Why it exists: Phase 2 adds pane consumers (tutor Learners|detail, teacher
Classes|detail per ADR-102) — the moment panes become the fashionable pattern
is the moment the ban needs its own file to point at.
SOT: docs/pack/37-onboarding-dual-pane.md §3.3 ·
     docs/design/overhaul-v2/00-binding-decisions.md §Doc-37 §Doc-38 ·
     docs/design/overhaul-v2/G-navigation-maps.md §5 §6 ·
     docs/design/overhaul-v2/H-competitor-mobile-vs-web.md #2 #3 #7 synthesis 1
SOT-KEYWORDS: adr learner pane ban adaptive-panes split-view single-focus
              attention-arbitrage hot-dial band overhaul
-->

## Context

- **The ban is already binding:** doc 37 §3.3 designates panes per role — tutor `Learners|detail` and `Notes|draft`, guardian tablet `Reports|report`, ops = web sidebar, district = web grid, and **"Learner: never"** — "a split learner UI is attention arbitrage." 00-binding-decisions §Doc-37 restates it and adds the ratchet: lifting the ban *even for 9–12* requires an ADR. This file is where any such attempt must argue, and it argues the other way.
- **Design ground:** the learner shell is single-focus by design — doc 08's Hot dial requires the primary surface at ≥40% canvas (G-navigation-maps §5); doc 36 §3.1's band IA gives kids shallow hub-and-spoke with one primary action (Snap), and doc 38 §4 keeps learner FD screens single-pane at every width class (560dp centered on expanded) while every adult auth screen goes dual-pane.
- **Current state conforms:** no learner surface mounts `AdaptivePanes`; the two existing consumers are tutor Notes and guardian Reports (G §5 table). The risk is drift, not present defect — Phase 2 adds the third and fourth consumers (tutor `Learners|detail`; teacher `Classes|detail`, ADR-102), normalizing panes across shells.
- **Competitor evidence (H):** the strongest learner products are aggressively single-focus — Duolingo's path has "exactly one 'next' node; zero resume friction because there is no navigation decision" (#3, synthesis 1); IXL lands students on one dashboard whose primary object is the next skill (#2); Photomath puts the camera as the entire home screen (#7). No comparator ships a split-view learner surface; the multi-pane patterns in the set (Canvas rail, Notion sidebar, Linear triage) all belong to adult/ops roles. Synthesis #1's Moyo application is explicit: "K–2 Today should be Duolingo-degree singular — one 'next' tile, not a feed."

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| A — reaffirm the ban, all bands | No learner route ever mounts `AdaptivePanes` (or `unstable-split-view` behind it); tablet width gives the learner a wider single column, never a second pane | `packages/app` AdaptivePanes consumers (2 today, both adult — G §5) | Preserves single-focus pedagogy; zero code change; consistent with doc 08/36/37/38 simultaneously | 9–12 tablet users get no list→detail ergonomics |
| B — lift for 9–12 (`adult` band) | Allow e.g. `Subjects\|detail` on expanded width for teens | would require band checks in pane mounts — and band is never populated under live auth (A-repo-audit defect (a), E-matrix G-4) | Teen tablet ergonomics | Gated on a band signal that is currently fictional in production, so the gate would fail open; splits learner attention exactly where doc 37 says arbitrage begins; no comparator precedent |

## Decision

**The ban holds, reaffirmed for every band including 9–12: no learner surface renders `AdaptivePanes`, `unstable-split-view`, or any two-pane composition, at any width class, on any platform.** Learner screens use width for a single generous column (doc 38 §4's 560dp-centered pattern generalizes). This ADR is now the citation target the 00-binding-decisions ratchet demanded; any future lift must supersede this file explicitly, and may not even be *evaluated* until the band-population defect (A-repo-audit (a): `providers/session/live.tsx:99-104` omits `gradeBand`) is fixed — a band-gated exception on a never-populated band is a ban that fails open.

## Consequences

- Easier: Phase-2 pane expansion proceeds on adult shells with a bright structural line; review of any learner PR has a one-line test (does it mount panes? reject); the Hot-dial ≥40%-canvas rule stays satisfiable.
- Harder: 9–12 tablet list→detail requests get "no" with this file as the reason; learner tablet layouts must earn polish through the single-column path only.
- No code-comment corrections required: no learner pane code exists to retire — this ADR's job is preventing it from ever existing.
- Follow-ups: none to code. Keep the G §5 table's learner row pointing here; ADR-102's `Classes|detail` and the tutor `Learners|detail` additions must not create shared pane scaffolding that a learner route could accidentally inherit (pane mounts stay per-shell, never in shared layout chrome).

## Default replaced

Register ADR-g's no-ADR default was "ban holds" (the standing 00-binding-decisions position). This ADR **formally adopts the doc-37 position** — no divergence exists to retire — converting a standing digest line into a first-class decision record with the competitor evidence and the fail-open band caveat attached.

## Constraints honored
Zustand-only (pane selection stores stay adult-shell-scoped, doc 37 §3.2) · tokens-only · no invented APIs · doc references (37 §3.3 · 08 Hot dial · 36 §3.1 · 38 §4 · 00-binding §Doc-37 · G §5/§6 · H #2/#3/#7, synthesis 1)

---

## Amendment (2026-09-03) — the tutor session is exempt

**Decided by:** Mike, product owner, in session on 2026-09-03.
**Scope of the exemption:** the S9 tutor session (`TutorStage`) **only**. Every other learner surface — Today, My Stuff, the guided path, capture, onboarding — remains single-pane at every width class on every platform, and the §Decision above still governs them unchanged.

**What he asked for, in his words:** *"pu them pane buttons back!!! i need see natilie in meyahuman for on th pane!"* — i.e. the split view with its expand/collapse controls, on the tutor session, with the realistic 3D Natalie living in one of the panes.

**The reasoning he gave.** The tutor session is the product's signature surface and the avatar is its signature element (doc 01 §6.1, doc 23 §2). At tablet and unfolded-foldable width the conversation is capped at a 65ch reading measure (doc 23 §4.2), so the leftover width is either empty or hers. Giving it to her is not a second place for the child to work — it is the person they are already talking to, made visible at the size the hardware allows.

**Why this does not reopen the ban's actual concern.** §Decision's stated reason is **attention arbitrage**: a child made to divide attention between a list and a detail, two places where work happens. The exempted composition has one place where work happens. The leading pane holds no work, no navigation, no list, no second reading order and nothing reachable only from there — it holds a presence. Doc 02 §4.1's "a child never gets the Triptych" is untouched: this is two panes, and there is no third.

**Conditions this exemption carries, all of them binding.**
1. **One work surface.** The tutor session's panes are presence + conversation. The moment a second pane holds anything a child has to *do*, this exemption no longer covers it and the ban applies again.
2. **Collapsible, and collapsed is a first-class state.** The `PaneToggle` controls are present, and the existing "Hide Natalie" reveal control still governs her. A learner who wants one column gets one column.
3. **Compact is unchanged.** Below the `medium` class (600dp) the session is the single spine it has always been. The exemption buys width; it does not put panes on a phone.
4. **Doc 08's Hot dial still applies** — ≥40% canvas on the learner surface, measured with the panes open.
5. **It does not generalise.** No other learner route may mount `AdaptivePanes` by citing this amendment. G-navigation-maps §5's learner row keeps pointing at the §Decision above.

**What did NOT change:** the fail-open band caveat in §Decision still stands — `gradeBand` is still not populated under live auth, so nothing here may be gated on band. The exemption is gated on *route and width class*, both of which are real.

**Contradicting doc, named:** doc 37 §3.3's "**Learner: never**" is now "learner: never, except the S9 tutor session." Doc 37 should carry that sentence; until it does, this amendment is the source of truth and doc 37 §3.3 is stale on that one word.


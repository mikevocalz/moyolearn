# ADR 104: The district mobile tab bar retires — district is web-only, per doc 36 §3.5
Status: accepted · Date: 2026-09-01
Accepted: 2026-09-02 — implemented in code (`4dcdbdb`: district mobile tab bar retired, guarded minimal stack).

<!--
What it is: ADR-d of the G-navigation-maps §6 register — whether a district
mobile shell exists at all, against doc 36 §3.5's "web only, Phase 3."
Why it exists: a mobile district tab bar shipped anyway, declares five tabs,
renders one, and would otherwise attract route-building effort that doc 36
already ruled out twice over (wrong platform AND wrong phase).
SOT: docs/pack/36-role-navigation-flows.md §3.5 ·
     docs/pack/33-moyo-learn-prd.md non-goal 6 ·
     docs/design/overhaul-v2/G-navigation-maps.md §1.7 §3.2 §6 ·
     docs/design/overhaul-v2/E-tenant-role-band-matrix.md §2 §5 G-6 ·
     docs/design/overhaul-v2/H-competitor-mobile-vs-web.md #6 #15 #16 synthesis 11
SOT-KEYWORDS: adr district mobile retirement web-only phase-3 outcomes
              compliance k-anon tab-bar overhaul
-->

## Context

- **Doc 36 §3.5 is doubly explicit:** district is "**Web only**, Cool sidebar: Outcomes · Schools · Educators · Compliance · Settings" *and* Phase 3 — "IA now, build later." A district mobile shell contradicts the binding doc on platform and on phase (G-navigation-maps §1.7). PRD non-goal 6 removes even the sales motion for v1.
- **A mobile shell exists anyway:** `apps/mobile/app/(district)/(tabs)/_layout.tsx` declares five ITEMS (`district-home · schools · programs · calendar · more` — including the More tab doc 36 §1 calls IA failure) and renders **1 of 5** (A-repo-audit; E-matrix G-6). Its comment at least fabricates no citation, but `more`/`programs`/`calendar` also match nothing in doc 36's district set.
- **The web side already carries the real IA:** G §3.2 reconciles the district rail to doc 36's five items verbatim (rename People→Educators, Reports→Compliance, add Settings), and the k-anon `Suppressible` cell for Outcomes already exists in `DataTable` (A-repo-audit §packages/ui).
- **Competitor evidence (H):** district administration is the deepest-desk work in the set — PowerSchool's district-configured SIS lives on the dense web app (#6); Notion and Linear (#15/#16) show that when mobile exists for such roles it is a *triage companion*, and district has no v1 triage job: Compliance shows counts never contents, Outcomes is k-anonymous aggregate browsing. Synthesis #11 names district as the one role where web-only is the correct scoping, explicitly.

## Options

| Option | How it works | Verified seam (file:symbol) | Pros | Cons |
|---|---|---|---|---|
| A — retire the mobile tab bar | `(district)` group becomes a redirect-to-web lander (or is deleted in the shell contract); zero mobile routes built; web rail per G §3.2 | `(district)/(tabs)/_layout.tsx:ITEMS` · `apps/web/components/site/nav.ts:NAV_BY_ROLE` | Conforms to doc 36 twice over; zero Phase-3 work pulled into Phase 2; kills a 1-of-5 defect and a More tab | A district admin on a phone gets a hand-off, not an app |
| B — build the declared routes | Author `/schools /programs /calendar /more` | same layout | Tab bar navigates | Builds Phase-3 scope now, on the wrong platform, against a binding doc, for a role with no v1 sales motion |
| C — minimal mobile companion | Invent a 2–3 tab glance shell | new routes | Middle ground | No doc defines it, no persona demands it, and H offers no district-mobile precedent to copy — pure invention |

## Decision

**Retire the mobile district tab bar.** C-orphans' generic "build the routes per the reconciled tab map" resolves to **zero routes for this shell** (G §1.7): `/schools`, `/programs`, `/calendar`, `/more` are never built. The `(district)` route group is kept only as a redirect-to-web lander pending the shell contract, which may delete it outright — either endpoint satisfies this ADR; a tab bar does not. District IA lives exclusively in the web rail, reconciled to doc 36 §3.5's five items exactly (`Outcomes · Schools · Educators · Compliance · Settings`, G §3.2 deltas: People→Educators, Reports→Compliance, +Settings). Any future district mobile surface is a new ADR with Phase-3 evidence behind it.

## Consequences

- Easier: Phase 2 sheds four unbuilt routes and a defective shell; the district story is one platform, one IA, straight from the binding doc; `DataTable`'s existing `Suppressible` carries the Outcomes k-anon rule with no new component.
- Harder: if district pilots want mobile check-ins later, that is a full ADR + doc-36 amendment, not a quick route add — deliberately so; the lander/delete choice is deferred to the shell contract and must not silently default to keeping the tab bar.
- No code-comment correction is required here: the district layout's comment fabricates no citation (G §1.7 — "honest, at least"); the file itself is what retires.
- Follow-ups: convert `(district)/(tabs)` to lander-or-delete in the shell contract; apply the G §3.2 web-rail renames; keep district out of the AdaptivePanes roster (web grid, doc 37 §3.3).

## Default replaced

Register ADR-d's no-ADR default was "retire mobile district tab bar" — silence resolves to doc 36 §3.5. This ADR **formally adopts the doc-36 position** and retires the divergent code, converting the default from an implicit state into a decision with a recorded evidence trail.

## Constraints honored
Zustand-only · tokens-only · no invented APIs (`Suppressible`/`DataTable` reused) · doc references (36 §1/§3.5 · 33 non-goal 6 · 37 §3.3 · G §1.7/§3.2 · E §5 G-6 · H #6/#15/#16, synthesis 11)

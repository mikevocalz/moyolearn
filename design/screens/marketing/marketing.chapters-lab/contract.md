# Flow Contract — marketing.chapters-lab (DISPOSITION: REMOVE — self-labelled temporary, dead route)

```yaml
screen_id: marketing.chapters-lab
role: internal (no shell role — apps/web-vite marketing origin; filed under marketing/ because the README's 8-role list has no bucket for D's Out-of-shell rows)
tenant: [www]
band: n/a
shell: none
entry_points:
  - "deep_link: direct URL only — Nav entry 'none' (D row); nothing on the site links to it, and the main build's prerender list omits it (only its own `vite.config.chapters-lab.ts:79` prerenders it)"
answers_within_5s:
  - "(none it is entitled to answer — the route's own header reads 'TEMPORARY verification surface for chapters 04 and 05. Not part of the site. Delete before handing back.')"
primary_action: "n/a — REMOVED. Nothing migrates: the two sections it mounts (WorldChapter, TutorRoomChapter) already ship on the marketing home (`src/routes/index.tsx`); the lab was scaffolding for verifying them"
secondary_actions: []
exits: {}   # unlinked internal lab on a non-app origin; no marketing screen carries a D-inventory ID for traffic to resolve to — after deletion the URL yields the marketing origin's 404
completion_returns_to: n/a — removed
back_behavior: "n/a — no inbound link exists to return from; browser history only."
failure_paths:
  offline: "n/a — removed"
  no_data: "n/a — removed"
  permission: "n/a — removed (anonymous public origin; no auth surface)"
cross_role_propagation:
  - "none — anonymous marketing origin; touches no session, no role surface, no store in the app's 33-store list"
cross_device_continuity: "n/a — stateless"
max_interactions_to_primary: 0
state_owner: "none"
```

**Status:** Route EXISTS — `apps/web-vite/src/routes/chapters-lab.tsx` (`/chapters-lab`, marketing origin; mobile n/a) — classified **DEAD-ROUTE** (D row): "Self-labelled 'TEMPORARY … Delete before handing back', ships with own vite config".

**Notes:**
- **Disposition, binding — D's proposed action verbatim:** "Delete route + `vite.config.chapters-lab.ts` (C §web-vite)". Both die in the same PR; the chapter components survive where they are actually mounted (marketing home, for-parents/for-schools siblings from the same `components/chapters/` family).
- The route head does carry `robots: noindex, nofollow` (chapters-lab.tsx:17), so the exposure window until deletion is crawl-mitigated — but a route whose own header orders its deletion is removed, not kept because it happens to be noindexed.
- Do not design against this contract (README: disposition contracts ground the deletion, nothing else).

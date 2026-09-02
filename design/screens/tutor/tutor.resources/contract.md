# Flow Contract — tutor.resources (DISPOSITION: STRUCK 2026-09-02 — its own condition failed; no content pipeline exists)

```yaml
screen_id: tutor.resources
role: tutor
tenant: [app, org]
band: n/a
shell: tutor (web sidebar item, second rail group per doc 36 §3.3; no mobile tab)
entry_points:
  - web sidebar "Resources" (Cool rail, G §3.2 ✱-add row)
  - tutor.learners prep detail ("suggested resources" contextual link, once prep derives from live data)
answers_within_5s:
  - What materials can I use in my next session?
  - Is there something for this subject/band?
primary_action: Open a resource
secondary_actions:
  - Filter by subject/band
  - Mark a resource as a favorite (durable view preference)
exits:
  open_resource: tutor.resources (detail/viewer within the same surface; external links open in a new context and this list remains)
  back_to_prep: tutor.learners (when entered from prep, return preserves the prep context)
  back_to_timeline: tutor.today
completion_returns_to: tutor.resources list; tutor.today when leaving the rail destination
back_behavior: "Viewer → list → previous rail destination (browser history). Never traps."
failure_paths:
  catalog_fetch_failed: inline retry
  empty_catalog: "honest empty state ('Resources are coming') with a live exit to tutor.today — if this ships before content exists it must say so, never render a skeleton forever"
  resource_unavailable: item-level error, list stays usable
cross_role_propagation: []
cross_device_continuity: "Catalog is server truth; favorites persist server-side so they follow the tutor across devices."
max_interactions_to_primary: 1
state_owner: "[add] resources catalog query (React Query, server truth) + [add] favorites as a server-persisted preference. No existing store fits (nothing resource-shaped exists in features/)."
```

**Status:** STRUCK 2026-09-02, on this contract's own condition (Notes below): the item was conditional on a resource content pipeline existing, and none does — no collection, no catalog, `Media` is upload transport. The rail item is not rendered (`apps/web/components/site/nav.ts` records the strike beside the tutor group); striking beats shipping a designed dead end (the `/academics` lesson, C §Web; ADR-105's consequences noted the item as conditional). The contract text below stays as the record — do not design against it. (Was: CONTRACTED over MISSING screen — D: "Build or strike from IA with contract note".)

**Notes:**
- Contract note per D's proposed action: **strike is acceptable.** If no resource content pipeline exists by Phase-3 IA freeze, remove the rail item entirely rather than shipping the empty state — an empty rail destination is a designed dead end (the `/academics` lesson, C §Web). This contract is conditional on content existing.
- Zero cross-role propagation is deliberate: resources are tutor-side material, never pushed to learner surfaces from here.

# Overhaul v2 — Deliverable C: Orphan / Dead-End / Dead-Route Report

What it is: reachability findings across mobile and web — routes with no entry, entries with no route, duplicates, and dead code in the navigation layer.
Why it exists: flow law #2 (no orphans) and #1 (no dead ends); every item here gets wired, deleted, or contract-justified in Phase 2.
Source of truth: A-repo-audit.md for the underlying audit; this file for the actionable list.
SOT-KEYWORDS: overhaul, orphans, dead-ends, dead-routes, reachability

## Mobile

### Orphans (no entry point)
| Item | Evidence | Proposed action |
|---|---|---|
| `(guardian)/(tabs)/alerts.tsx` | Not in guardian ITEMS; no `router.push('/alerts')` anywhere; only inbound ref is the TITLES map string | Doc 36 §3.2 says Alerts IS a guardian tab ("serious things never hide under a bell") — **wire it as a tab**, don't delete |
| `app/onboarding/handoff.tsx` | Duplicate of `app/handoff.tsx`; no inbound link | Delete (keep `app/handoff.tsx`, the deep-link target) |
| `(guardian)/family-calendar.tsx` | Duplicate of `(tabs)/calendar.tsx`; one inbound push from family-screen | Delete; repoint family-screen push to `/calendar` |
| `apps/mobile/components/EventActionsSheet.tsx` | Never imported | Delete or wire (decide in schedule screen's contract) |
| `(guardian)/(tabs)/reports.tsx` | Near-orphan — only entry is one push in family-screen; renders no tab | Doc 36 §3.2 makes Reports a guardian tab — wire it |

### Entries with no route (declared tabs pointing at nothing — ShellTabBar silently drops them)
- Teacher shell: `/classes`, `/assign`, `/students`, `/calendar` → renders **2 of 6** tabs.
- School shell: `/people`, `/academics`, `/calendar`, `/more` → renders **1 of 5** (a tab bar that cannot navigate).
- District shell: `/schools`, `/programs`, `/calendar`, `/more` → renders **1 of 5**.
- Action: build the routes per the reconciled tab map, AND make `ShellTabBar` fail loudly in dev when an ITEMS entry has no route (the silent drop is the defect that let this ship).

### Dead code in chrome
- `ShellHeader` avatar branch: `profileHref` never passed by any caller — the doc-36/§9.1 persistent-avatar requirement is scaffolded but unreachable.
- No Drawer exists despite guardian layout comments promising one for Reports/Alerts.

## Web (apps/web)

- `/academics` — `InstitutionPlaceholderScreen`, yet a live nav destination in `NAV_BY_ROLE.school_admin`: a **designed dead end**. Either build it or pull it from nav until built.
- Dead-end fragments carried from platform-role-ux-audit §5 (re-verify in Phase 2): memory / ai-activity / family-calendar have no web nav entry; `(site)/subjects` reachable by URL for K–2 learners whose tab is `href:null` with no permission fallback; learner `/plan` has no web nav entry.
- Admin-split leftovers (not navigation, but dead seams): `app/(payload)/admin/importMap.js` orphan; `proxy.ts` allowlist entries `/admin` + `/api/payload`.

## Web (apps/web-vite)

- `/chapters-lab` — self-labelled "TEMPORARY … Delete before handing back", still shipped with its own vite config. Delete.
- `/globe-lab` — internal lab on the public marketing origin, `noindex` unconfirmed. Confirm noindex or gate.

## Cross-cutting

- `+not-found.tsx` silently redirects `/` (doc 36 §4 intended law: role-mismatch deep links drop silently) — verify this is also the right behavior for genuinely broken links vs. a permission screen; record in the shell contract.
- Guardian `messages.tsx` aliases `NotificationsScreen` — a tab whose label lies about its content; no messaging surface exists anywhere. Resolve in the guardian shell contract (doc 36 §3.2 has no Messages tab at all).

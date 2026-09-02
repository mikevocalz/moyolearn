# Flow Contract — marketing.globe-lab (DISPOSITION: OUT-OF-SCOPE — internal verification surface; confirm noindex or gate)

```yaml
screen_id: marketing.globe-lab
role: internal (no shell role — apps/web-vite marketing origin; filed under marketing/ because the README's 8-role list has no bucket for D's Out-of-shell rows)
tenant: [www]
band: n/a
shell: none
entry_points:
  - "deep_link: direct URL only — Nav entry 'none' (D row); deliberately unlinked, and explicitly listed in the main prerender list (`apps/web-vite/vite.config.ts:167`) because `crawlLinks` would never find it"
answers_within_5s:
  - "(internal only) does the chapter-04 R3F globe island still prerender to real HTML with no `<!--$!-->` marker? — the config's stated purpose for the route"
primary_action: "n/a — OUT-OF-SCOPE for Phase-2 screen design. It is a build-verification surface, not a product screen; nothing migrates. D's open action ('Confirm noindex or gate') is the only work it owes, and when its verification job ends, the prerender entry and the route are deleted together"
secondary_actions: []
exits: {}   # self-contained lab; links nowhere, nothing links to it
completion_returns_to: n/a
back_behavior: "Browser history only; no inbound link."
failure_paths:
  offline: "n/a — internal verification surface; not contracted"
  no_data: "n/a — static geometry (`public/globe`); no data dependency contracted here"
  permission: "None exists — public origin, no gate. That absence is exactly the risk this contract records (see Notes)"
cross_role_propagation:
  - "none — anonymous marketing origin; touches no session, no role surface"
cross_device_continuity: "n/a — stateless"
max_interactions_to_primary: 0
state_owner: "globe-store (web-vite-local `src/globe/globe-store.ts` — deliberately outside the app's 33-store list; dies with the route if removal is chosen)"
```

**Status:** Route EXISTS — `apps/web-vite/src/routes/globe-lab.tsx` (`/globe-lab`, marketing origin; mobile n/a) — classified **ORPHAN** (D row). **Noindex VERIFIED in the live CDN-served output 2026-09-02** (see Notes); D's "noindex unconfirmed" is resolved on the confirm side of "Confirm noindex or gate".

**Notes:**
- **Disposition:** explicit out-of-scope for Phase-2 screen work, carrying D's proposed action as its one open task — "Confirm noindex or gate (C §web-vite)". Removal is the end state once the prerender-verification job it performs is no longer needed; the twin `/motion-lab` entry's config comment sets the removal order ("Delete this entry, not the route" for a temporary de-listing; both go together for a true removal).
- **Noindex risk, stated:** the route head declares `{ name: 'robots', content: 'noindex, nofollow' }` (globe-lab.tsx:38) and the prerender comment claims sitemap exclusion — but D recorded "noindex unconfirmed", and confirmation must be read from the BUILT/CDN-served output, not the source: a meta tag in source is config, not evidence, on a prerendered origin.
- **VERIFIED 2026-09-02 against the live CDN output.** `https://www.moyolearn.com/globe-lab` returns **HTTP 200** and the SERVED html contains `<meta name="robots" content="noindex, nofollow"/>` in `<head>`; the same tag is served at `https://moyolearn.vercel.app/globe-lab` (200). Apex `https://moyolearn.com/globe-lab` 308-redirects to www. There is **no `X-Robots-Tag` response header** on any of these — the meta tag in the served body is the sole noindex signal, which is sufficient for crawlers on an HTML page. Incidentally re-confirmed the route's stated purpose: the served output carries the prerendered globe markup with **zero `<!--$!-->` SSR-error markers**.
- An unlinked-but-live internal lab on the public origin stays reachable by URL guessing regardless of noindex (still true post-verification — noindex governs indexing, not reachability). The "gate rather than trust the tag" order applied only while the built-output check was unconfirmable; with the tag now confirmed in the served response, gating is not required, though it remains the stronger option and the agreed end state (delete prerender entry + route together) stands. Re-verify after any prerender-pipeline change — the tag is emitted per-build, not set at the CDN/header layer.
- Do not design against this contract.

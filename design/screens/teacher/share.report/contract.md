# Flow Contract — share.report

```yaml
screen_id: share.report
role: teacher (tokened, no login — doc 36 §3.3: "a tokened read-only page — no shell, no login"; anyone holding the token can read, the designed audience is the teacher)
tenant: [any]
band: n/a
shell: none — BY DESIGN. No providers, no chrome, no nav, noindex (D row: "no shell, no providers, by design"). This is the one screen in the product with an empty shell field on purpose.
entry_points:
  - "deep_link: share link `/share/report/[token]` — guardian-initiated (doc 34 §5 teacher share), typically arriving via email/message outside the product"
answers_within_5s:
  - "How did this learner's session go (blocks 1–6 + 8, doc 34 fixed order)?"
  - "What moved (mastery delta) vs where they stand (grade-relative position) — never conflated?"
primary_action: "Read the shared report"
secondary_actions: []
exits: {}   # NONE — the only exits are within the token scope. No link into any shell, no login prompt, no signup upsell, no other report. Closing the tab is the exit.
completion_returns_to: n/a — the page is its own scope; browser back/close leaves it
back_behavior: "Browser back/close only. The page never traps (no modal states) and never forwards anywhere."
failure_paths:
  offline: "Static read fails → browser-level retry; no app fallback"
  no_data: "Invalid, expired, or revoked token → a neutral 'this link is no longer available' state with NO exits either — it must not reveal whether the report exists, who it concerns, or where to log in (the no-oracle principle sys.not-found applies in-app)"
  permission: "Token IS the permission. Blocks 7 (guardian-only) and all safety content never render here (doc 34: reports never carry safety content; incidents travel doc 31's channel); token grants blocks 1–6+8 exactly"
cross_role_propagation:
  - "Inbound only: guardian share action mints the token; the report itself came through doc 34's pipeline (evidence-linked blocks; tutorApprovedBy for human/hybrid)."
  - "Outbound: none — read-only projection; no acknowledgment, comment, or write-back of any kind."
cross_device_continuity: "The link is the continuity: stateless, works on any device/browser, no session."
max_interactions_to_primary: 0
state_owner: "server token→report projection; zero client state"
```

**Status:** COMPLETE (D-screen-inventory verbatim). Keep as-is.

**Notes:**
- This contract's whole force is negative space: no shell, no exits beyond token scope, noindex, blocks 1–6+8 only, no safety content, no report-trail navigation even if the same guardian shared multiple sessions — each token scopes exactly one report.
- Trajectory-language and movement-vs-position laws (doc 34) bind the rendered blocks; the expired-token state must be as unrevealing as the in-app silent redirect is.

# Flow Contract — guardian.ai-activity (AI permissions + what Natalie knows)

```yaml
screen_id: guardian.ai-activity
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "push: from guardian.home (inventory nav entry: push from family home)"
  - "push: from guardian.family ai_permissions (per-child controls neighborhood)"
answers_within_5s:
  - "What is the AI allowed to do with my child?"
  - "What does Natalie actually know about them?"
  - "Is anything paused or flagged right now?"
primary_action: "Toggle a consent — grant/withdraw an AI permission for the active child"
secondary_actions:
  - "Review/erase memory lines (→ guardian.memory, S27 transparency)"
exits:
  memory: guardian.memory
  child_controls: guardian.family
completion_returns_to: guardian.family
back_behavior: "Push: back pops to origin (guardian.home or guardian.family); toggles save in place, so back never discards."
failure_paths:
  offline: "Consents render from cache read-only; toggles are DISABLED offline (a consent change must never sit silently queued — the store's locked-record model backs this)."
  no_data: "New child, nothing observed yet → 'Natalie hasn't learned anything yet' state; consent list still renders (consents exist before observations)."
  permission: "Locked consents (ones we never request) are rejected at the store, not merely disabled in the view (ai-activity.store R9); own children only."
cross_role_propagation:
  - "Consent toggles bind learner.tutor immediately — a withdrawn consent stops the behavior mid-product, not at next session"
  - "Safety status shown here mirrors the doc-12 §5 guardian-visible status fed by the doc-31 plane"
cross_device_continuity: "Consents are server-backed; the three-position safety status (not-yet-asked / could-not-ask / answer) syncs — 'could not ask' must never render as 'all clear' on any device."
max_interactions_to_primary: 1
state_owner: "ai-activity.store (existing — features/ai-activity; consents + safety status)"
```

**Status:** Route EXISTS — `/(guardian)/ai-activity` + web `/ai-activity`, classified COMPLETE — but web has **no nav entry** (D row).

**Notes:**
- **Fixture data:** consents/observations are fixtures (D row action: replace).
- **Store squatting (G-8):** child-switch state lives only in `ai-activity.store` — the wrong home. This contract keeps ai-activity.store scoped to consents + safety status; activeChildId moves to `family.store [add]` (guardian.home/guardian.family contracts).
- Web entry: contract requires reachability from the web family surface (mirroring the mobile push), or a justified mobile-only note — a live route with zero inbound web links is an orphan (C §Web class).
- This surface is transparency, not surveillance theater (PRD guardian job): it shows what the AI may do and knows — never live transcripts or session spying.

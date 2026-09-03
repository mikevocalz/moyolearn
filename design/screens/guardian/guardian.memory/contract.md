# Flow Contract — guardian.memory (S27 erasure transparency)

```yaml
screen_id: guardian.memory
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "push: from guardian.ai-activity memory (the only inbound path — inventory nav entry)"
answers_within_5s:
  - "Exactly what has Natalie remembered about my child?"
  - "How do I make her forget something?"
primary_action: "Erase selected memory lines (per-line erasure with explicit confirm; forget-all rides /api/memory/forget-all)"
secondary_actions:
  - "Review consents that produced these memories (→ guardian.ai-activity)"
exits:
  back_to_consents: guardian.ai-activity
  child_controls: guardian.family
completion_returns_to: guardian.ai-activity
back_behavior: "Push: back pops to guardian.ai-activity; a completed erasure shows its confirmation before returning (an erasure must never feel unacknowledged)."
failure_paths:
  offline: "Memory lines render from cache read-only; erasure is DISABLED offline — a deletion promise that hasn't reached the server must not appear kept."
  no_data: "Nothing remembered → plain 'Natalie hasn't kept anything' state; still shows how memory works (transparency is the screen's job even when empty)."
  permission: "Own children only; erasure is irreversible and says so in plain language — no dark-pattern friction, no guilt copy."
cross_role_propagation:
  - "Erasure binds learner.tutor immediately — erased lines are never referenced by Natalie again, on any device"
  - "Full-account erasure cascade belongs to FD-26 (delete account), which reuses this machinery"
cross_device_continuity: "Erasure is server-side and global — completed on one device, gone everywhere; no local cache may resurrect an erased line."
max_interactions_to_primary: 2
state_owner: "memory.store (existing — features/memory, test-covered)"
```

**Status:** Route EXISTS — `/(guardian)/memory` + web `/memory`, classified COMPLETE — but web has **no nav entry** (D row).

**Notes:**
- **Unstable snapshot fixed 2026-09-02.** `pendingCascade` is a DERIVED selector — it filters `state.facts`, so it returned a fresh array on every read and React logged "the result of getServerSnapshot should be cached to avoid an infinite loop" on every render of this screen. The call site now wraps it in `useShallow`, matching `providers/session/session.tsx`. Sound rather than merely quieter: `cascadePreview` returns the ORIGINAL fact objects, so element-wise identity is exactly the comparison that says whether the cascade changed.
- Single-entry surface by design (deliberately buried one level behind ai-activity — erasure is a considered act, not a daily loop); this contract accepts that and requires no second entry. The no-dead-end law is satisfied by the two forward exits + completion return.
- `max_interactions_to_primary: 2` — select line(s) + confirm; the confirm step is contractual (irreversibility), not friction to remove.
- Web reachability rides guardian.ai-activity's web-entry fix; no independent web nav entry is wanted.
- FD-26 (delete account) is the whole-account superset — doc-38 contracted; this screen must never grow account-deletion UI of its own.

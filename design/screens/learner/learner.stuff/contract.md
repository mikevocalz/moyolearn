# Flow Contract — learner.stuff (My Stuff / practice)

```yaml
screen_id: learner.stuff
role: learner
tenant: [app]
band: K-2 · 3-5   # the young-band tab; 6–12 shells replace it with Progress/You (doc 36 §3.1)
shell: learner
entry_points:
  - "tab: My Stuff (K–2, 3-tab shell) / Me (3–5, 4-tab shell) — G §1.1"
  - "push: from learner.home K–2 hub tile"
  - "back_from: learner.tutor (practice item finished)"
answers_within_5s:
  - "What's mine to play with / practice?"
  - "What did I do before?"
primary_action: "Start a practice item — one tap opens coached practice with Natalie (→ learner.tutor)"
secondary_actions:
  - "Snap new homework instead (raised center tab → learner.capture)"
exits:
  start_practice: learner.tutor
  snap: learner.capture
completion_returns_to: self (practice hub — finished items return here)
back_behavior: "Tab: back returns to learner.home (K–2: voice-prompted, giant targets). Single-pane."
failure_paths:
  offline: "Downloaded/cached practice items playable offline (canPractise is the free floor — entitlements.ts keeps it true on EVERY status); new items greyed with band-voiced copy."
  no_data: "No items yet → Natalie suggests snapping homework (single action → learner.capture); K–2 copy ≤8 words."
  permission: "n/a — own items only."
cross_role_propagation:
  - "Practice outcomes feed the student model → guardian.reports evidence and learner mastery (surfaced to 6–12 as learner.progress)"
cross_device_continuity: "Practice items + completion state server-backed; same list after FD-24 profile switch on a family tablet."
max_interactions_to_primary: 1
state_owner: "practice.store (existing — features/practice)"
```

**Status:** Route EXISTS — `/(learner)/(tabs)/stuff` + web `/practice`, classified COMPLETE.

**Notes:**
- **Band bug dependency:** D row action — "confirm K–2 content fork under real `'young'` band"; unverifiable in production until `live.tsx` populates `gradeBand` (F §J1 finding 1). This screen's K–2 form has never rendered live.
- K–2 laws bind hard here: no search, no settings, 72px targets, voice-first prompts, no idioms (doc 31 voice gate).
- No engagement-pressure mechanics (PRD non-goal 7): light gamified mastery for 3–5 is allowed; streak-shame, timers, and late-night nudges are not.
- Practice is the entitlement-proof surface: `canPractise: true` on every status — a lapsed guardian card never takes practice away, and no lapse messaging ever renders here (PW-03b law).

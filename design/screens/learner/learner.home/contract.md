# Flow Contract — learner.home (covers D-inventory rows `learner.home` + `learner.home.k2`)

```yaml
screen_id: learner.home
role: learner
tenant: [app]
band: all
shell: learner
entry_points:
  - "tab: Today/Home — first tab, every band (G §1.1: 3-tab K–2, 4-tab 3–5, 5-tab 6–12)"
  - "system: cold launch via sys.dispatch — learner shell root (SHELL_ROOTS)"
  - "flow: FD-17 completion — onboarding/handoff chain lands here (J3: FD-16 → FD-17 → learner.home)"
  - "back_from: learner.tutor (session end), learner.capture (cancel), learner.plan, learner.subjects"
  - "deep_link: in-shell learner deep links resolve here as fallback; role-mismatched links die silently (sys.not-found, doc 36 §4.4)"
answers_within_5s:
  - "Where did I leave off?"
  - "What should I do right now?"
  - "Is anything due soon? (6–12 only)"
primary_action: "Resume where you left off — reopens the last session at its last position (→ learner.tutor). Band variants override; see Band variants."
secondary_actions:
  - "Snap homework (raised center tab → learner.capture)"
  - "See all due work (6–12 'See all' → learner.plan)"
  - "Open a subject (3–12 → learner.subjects)"
exits:
  resume: learner.tutor
  snap: learner.capture
  see_all_plan: learner.plan
  open_subject: learner.subjects
  free_limit_hit: PW-03b
completion_returns_to: self (hub — landing screen, no completion state)
back_behavior: "Shell root: Android back exits the app; never leaves the learner shell; no upstream screen. Single-pane at every width (learner pane ban, doc 37 §3.3)."
failure_paths:
  offline: "Render cached resume card + last synced feed with an offline banner; Resume disabled with band-voiced copy; Snap stays enabled (capture is on-device, session start queues)."
  no_data: "First-run state = FD-17's landing promise: Natalie greeting + exactly one action, 'Snap your homework' (doc 38 §1.2)."
  permission: "None requested here — camera is asked at first Snap, notifications after first report (doc 37 §1 onboarding law)."
cross_role_propagation:
  - "Session activity started from here updates the child's card on guardian.home (family feed)"
  - "Mastery movement from resumed sessions feeds guardian.reports / guardian.report-detail (doc 34)"
cross_device_continuity: "Resume pointer is server-backed; the same resume card renders on any device where this learner profile is active (family tablet via FD-24 profile switch)."
max_interactions_to_primary: 1
state_owner: "home.store [add] — resume pointer + feed; band/context read from providers/session store (existing)"
```

**Status:** Route EXISTS — `/(learner)/(tabs)/today` + web `/learn/today`, classified COMPLETE; the K–2 variant row (`learner.home.k2`, same route, `LearnerHubContent`) is classified **ORPHAN** — unreachable live.

**Notes:**
- **P0 band bug:** `gradeBand` is never populated under live auth (`providers/session/live.tsx:99-104`) — every production child gets the 5-tab teen IA; the K–2 hub never renders (F §J1 finding 1, "highest-leverage fix in the product"). This contract is unmeetable for K–2/3–5 until fixed; verify the K–2 shell end-to-end after.
- Feed still carries fixture data (D row action: "replace remaining fixture data").
- No learner store owns the resume pointer today — none of the 33 global stores map to `features/home`; hence `home.store [add]`.
- Learner surface: no prices, no upgrade prompts, ever (PW-03b law). Limit state routes to PW-03b band copy only.

## Band variants

| Band | Tabs | What changes |
|---|---|---|
| K–2 (`young`) | 3 (Today · Snap · My Stuff) | Hub-and-spoke `LearnerHubContent`: voice-first, giant tiles (72px targets), **primary action becomes one tap to Snap or Natalie** (→ learner.capture / learner.tutor); no resume card, no due-work strip, no search, no settings. `see_all_plan` and `open_subject` exits do not exist. |
| 3–5 (`child`) | 4 (Today · Subjects · Snap · Me) | Resume card present but simpler; 56px targets; no Progress entry; `see_all_plan` exit does not exist (plan is 6–12). |
| 6–8 / 9–12 (`teen`/`adult`) | 5 (Home · Subjects · Snap · Progress · You) | Resume-first Home as contracted above; 48px targets; 9–12 copy has no artificial simplification (doc 31). |

Camera stays the raised center tab on every band (doc 36 §3.1).

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
- **P0 band bug — FIXED, verified 2026-09-05.** `gradeBand` is populated under live auth: `providers/session/live.tsx:123` calls `fetchLearnerGradeBand()` for learner contexts and sets it at `:130`; the fetch reads `/api/learner/profile` (`:52`) and maps through `ageBandForVoiceBand` (`:55`), and that route's GET returns the saved band (`apps/web/app/api/learner/profile/route.ts:12-15`). A failed fetch still yields `undefined` and falls back to the teen shell by design (`live.tsx:44-48`), so the K–2 hub depends on the profile read landing. This contract is no longer unmeetable for K–2/3–5; the K–2 shell still needs an end-to-end check on device.
- **Feed fixtures are gone (2026-09-05).** `student-home.data.ts` is deleted. The hero reads `/api/tutor/next` through `features/home/use-next-skill.ts`; due work reads `/api/learner/assignments`. The next-session card and the improvement percentage were removed rather than restyled — no learner-scoped session read exists and mastery delta needs history `/api/progress` does not return, so both could only have gone on showing invented numbers to a child. Each returns with its read.
- Feed still carries fixture data (D row action: "replace remaining fixture data").
- No learner store owns the resume pointer today — none of the 33 global stores map to `features/home`; hence `home.store [add]`.
- **`primary_action` diverges from the built screen, deliberately, until the pointer exists.** The contract says "Resume where you left off — reopens last session at its last position". Nothing can do that: there is no resume pointer, server-backed or otherwise, and no route returns one. The hero therefore renders the adaptive NEXT skill from `/api/tutor/next`, labelled as what is next rather than as what was resumed, so the promise matches the data. `source` on that response separates a skill derived from the child's own facts from a seeded starting point, and the hero's copy changes accordingly — a seeded skill is never described as work the child was doing. When the resume pointer lands, `primary_action` becomes buildable as written and this note is deleted. Recorded 2026-09-05, `docs/design/reset/03-dispositions.md`.
- Learner surface: no prices, no upgrade prompts, ever (PW-03b law). Limit state routes to PW-03b band copy only.

## Band variants

| Band | Tabs | What changes |
|---|---|---|
| K–2 (`young`) | 3 (Today · Snap · My Stuff) | Hub-and-spoke `LearnerHubContent`: voice-first, giant tiles (72px targets), **primary action becomes one tap to Snap or Natalie** (→ learner.capture / learner.tutor); no resume card, no due-work strip, no search, no settings. `see_all_plan` and `open_subject` exits do not exist. |
| 3–5 (`child`) | 4 (Today · Subjects · Snap · Me) | Resume card present but simpler; 56px targets; no Progress entry; `see_all_plan` exit does not exist (plan is 6–12). |
| 6–8 / 9–12 (`teen`/`adult`) | 5 (Home · Subjects · Snap · Progress · You) | Resume-first Home as contracted above; 48px targets; 9–12 copy has no artificial simplification (doc 31). |

Camera stays the raised center tab on every band (doc 36 §3.1).

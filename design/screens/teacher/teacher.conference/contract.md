# Flow Contract — teacher.conference

```yaml
screen_id: teacher.conference
role: teacher
tenant: [school]
band: n/a
shell: teacher (NOT a tab — ADR-b demotes Conferences to a stack route from Home; today it renders as 1 of the shell's 2 live tabs, so the demotion is a real change)
entry_points:
  - "push: from teacher.home 'Conferences' (upcoming-conference card or overflow row)"
  - "push: from teacher.calendar conference block"
  - "system: push notification 'conference starting soon' (notification layer unbuilt; contract requires it)"
answers_within_5s:
  - "Which guardian conferences are scheduled and which is next?"
  - "What do I need for this conference (student, shared reports, talking points)?"
primary_action: "Run a conference (open the next conference's room/agenda)"
secondary_actions:
  - "Schedule a conference (pick student's guardian + slot)"
  - "Review a shared report before the conference (→ share.report)"
  - "Open the student's trail for context (→ teacher.students via teacher.classes fold)"
exits:
  run_conference: teacher.conference   # in-conference view of the same surface (hub → room)
  prep_report: share.report
  student_context: teacher.students
  back_home: teacher.home
completion_returns_to: teacher.home (conference ended → hub → stack pop; the hub re-sorts to the next upcoming conference)
back_behavior: "Room → hub → teacher.home. Leaving an active conference asks before disconnecting — the only confirm-on-back in the teacher shell."
failure_paths:
  offline: "hub renders last-synced list; joining a room requires connectivity and says so"
  no_data: "no conferences → 'Schedule one' affordance live from the empty state; guardians without booked slots are reachable through scheduling — never a dead end"
  permission: "conferences scoped to own students' guardians (Enrollments); the guardian counterpart books/joins from their own shell — no teacher→guardian free-form channel exists (FR-9.2's no-secret-channel rule extends here: everything is conference-scoped)"
  join_failed: "room join errors return to the hub with the conference intact + retry"
cross_role_propagation:
  - "scheduling → guardian.calendar (the booked conference appears family-side)"
  - "conference outcomes stay teacher-side notes; nothing writes to learner surfaces or reports (doc 34's report channel is not writable from conferences)"
cross_device_continuity: "Conference list + bookings are server truth. An in-progress conference is joinable from any device (room state is server-side); device-local media permissions re-prompt per device."
max_interactions_to_primary: 1 (Join/Run on the next-conference card)
state_owner: "Existing: features/conference (hub-screen.tsx + conference.policy.ts) on demo data — [add] wire collections per D's proposed action; no client store exists and hub selection can stay ephemeral (per-instance)."
```

**Status:** PARTIAL (D: `teacher.conference` — "Real UI on demo data (`conference/hub-screen.tsx`); wire collections; add web surface or justify mobile-only"). Contract resolution: **add the web surface** — conferences are desk work and the web teacher rail (ADR-b set) needs the same stack destination; mobile-only cannot be justified for a scheduling+meeting surface.

**Notes:**
- Demotion from tab to stack route is ADR-b's call (G §1.5: "neither Conferences nor Calendar is a daily-loop destination that earns a top-level slot"); this contract adopts the default and records that `conference.tsx` currently renders as a tab.
- The guardian sees conferences through their own calendar/booking surfaces; no learner surface is ever involved.
- **AI/call states are contract states** (from `packages/app/features/conference/conference.types.ts` + `conference.policy.ts` — mapped, not invented; the contract adds no controls beyond what the policy model exposes):
  - `ConferenceState`: `scheduled → waiting → active → ending → ended`, plus `cancelled` — every one is a distinct screen state of this surface; `expiresAt = actualStart + maxDurationMinutes` is server-enforced, so `ending`/`ended` can arrive without user action and the UI must absorb that transition mid-call.
  - `ParticipantStatus`: `invited · waiting · admitted · joined · left · removed · denied` — the waiting-room states (`waiting`, `denied`) render as states of the room, not as toasts.
  - Admission is server-decided (`AdmitResult`: `admit | wait | deny` with `AdmitReason ∈ guardianRequired · notInvited · notAuthorized · orgScope · expired · aiNotAllowed`) — the hub renders the outcome; it never offers an override control.
  - `StudentSafetyState` for minor participants: `admit` · `hold (guardianRequired)` · `remove (guardianTimeout)` — a student meeting (`policy.kind: 'student'`) holds minors until a guardian is present and removes them on guardian timeout; both are contract states with their own copy.
  - Policy invariants the UI must reflect as fixed facts, not settings: `recordingAllowed: false` (no record control exists in this build), `maxDurationMinutes: 30` (hard cap surfaced in `ending`), `allowAi` gates the AI participant (`ai` ConferenceRole) — when false, the AI tutor is absent, not disabled-looking.

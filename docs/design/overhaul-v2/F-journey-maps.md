# Overhaul v2 — Deliverable F: End-to-End Journey Maps (chained screen contracts)

What it is: the eight cross-role journeys as chains of screen IDs (arrow = contract exit → contract entry), each step annotated with repo status per the fresh audit, plus the broken links each journey exposes.
Why it exists: B-deliverable-status §L marked journeys "front door only"; these chains are the Phase-2 contract worklist — every `[M]`/`[P]` node and every finding below becomes contract work.
Source of truth: docs/38-front-door-and-flow.md §1 for FD-* flows (reused, not re-derived); A-repo-audit.md + C-orphans-dead-ends.md for status; docs/pack/34 §5, 31 §4–5, 24, 28 §3 for target shapes.
SOT-KEYWORDS: overhaul, journey-maps, flow-contract, chained-contracts, phase-2

## Conventions

- **Status:** `[E]` EXISTS (built + wired per audit) · `[P]` PARTIAL (surface exists; fixture data, defect, or unwired) · `[M]` MISSING (no screen/route) · `[E†]` exists but a wiring defect breaks it in production.
- **IDs:** FD-*/PW-* are doc 38's. Other screens have no unified ID scheme yet (B §L/queue-item 2); provisional IDs here are `role:screen` mapped to routes in A-repo-audit. Extending the FD-* convention product-wide is queued Phase-1 work — these provisional IDs are placeholders, not the scheme.
- Arrow = the exit contract of the left screen must satisfy the entry contract of the right screen. A finding = a link where state does not survive the arrow.

---

## J1 · Learner homework (the core loop)

```
[assignment arrives — physical homework; in-app arrival signal M: no assignments object, no push (doc 34 PR-131 unbuilt)]
→ learner:today [E†]           (mobile COMPLETE, but band defect (a): live auth never sets gradeBand — every child gets teen 5-tab IA; K–2 never sees LearnerHubContent)
→ learner:plan [E]             (mobile; web /plan has no nav entry — C dead-end fragment)
→ learner:capture [E†]         (797-line band-aware flow: entry row camera/library/file/type/say, guided frame, crop — but band defect (b): CaptureScreen never reads session, runs 'teen' for a six-year-old; camera raised center tab all bands ✅)
→ capture:ocr-review [E]       (on-device OCR: ocr-web.ts / ocr-review.* / digitized-text-review.tsx per doc 24 §1.4)
→ subject match [M]            (no subject-routing step or surface; CapturePayload carries no subject; crop+text hands straight to Natalie)
→ FORK: AI help | human tutor | self-guided [M]   (no fork screen exists; only the AI path is wired from capture. practice [E] is a separate tab, unreachable from capture; human-tutor path = J2, absent)
→ learner:tutor (Tutor Room) [E]   (states wired: streaming, TutorStage/composer, safety adapter tutor-safety.ts + safety-events.ts; caveats: adapter classifier is arithmetic on/off-task only — far narrower than the doc 31 S-taxonomy; coach.service.ts imports @acme/payload directly, violating the repository rule)
→ mastery update [E]           (server: student-model.repository + /api/progress; learner:progress [E] reads it via use-progress)
→ plan update [M]              (no evidenced mastery→plan write-back; plan does not re-rank from session outcomes)
→ guardian surfaces update [E†] (guardian:home reads hardcoded parent-home.data.ts Maya/Jordan — mastery never reaches the guardian home; no child switching, learnerId never set)
→ teacher surfaces update [M]  (teacher:home is a 32-line placeholder; the only working teacher surface is the guardian-initiated share token view [E])
→ session summary [E]          (features/summary: evidence/narrative/honesty per doc 34 §4, eight-block report-content, guardian reports + detail COMPLETE; notify cadence push/weekly-digest [M])
```

**Broken links (Phase-2 contract work):**
1. Band never populated under live auth (`providers/session/live.tsx:99-104`) — breaks today-IA, capture UX, tutor voice targets in one defect. Highest-leverage fix in the product (B queue #6).
2. Capture ignores the band even when set — one-line wrapper fix at `(learner)/(tabs)/capture.tsx`.
3. No AI/human/self-guided fork after OCR confirm — the product's positioning moment has no screen; capture is hardwired to the AI path.
4. No subject match step; downstream mastery attribution depends on it.
5. Mastery propagates to learner:progress only; guardian home (fixtures) and plan (no write-back) are dead ends for the same state.
6. Arrival/notify layer absent at both ends (assignment in, summary out): OneSignal wiring (doc 34 PR-131) unbuilt.
7. Safety classifier depth: the tutor adapter's arithmetic-only classification cannot produce the S1–S4 ladder inputs J8 depends on.

## J2 · Guardian booking (a human tutor)

```
guardian:home [P]              (fixture children, parent-home.data.ts)
→ guardian:child [M]           (no child detail screen, no ChildSwitcher — child-switch state exists only in ai-activity.store.ts; ActiveContext.learnerId never set for guardians)
→ tutor discovery [M]          (no browse/search/list of tutors anywhere, mobile or web)
→ tutor profile (guardian-facing) [M]   (FD-18 is the tutor's own onboarding form, not a viewable profile)
→ tutor availability (guardian-facing) [M]   (FD-19 grid is tutor-side input only)
→ booking [P]                  (BookingForm/BookingSurface exist but run on DEMO_DAY fixtures, org-schedule-oriented; no guardian entry point; doc 28 §5 slot solver unbuilt)
→ entitlement / payment [P]    (family-plan rail EXISTS: FD-13/PW-01..08 surfaces + /api/entitlements + paywall feature; per-session/human-tutor payment MISSING — no price, no checkout for a booked session)
→ confirmation [M]
→ guardian:calendar [E]        (COMPLETE; note (guardian)/family-calendar.tsx duplicate orphan — delete per C)
→ session (conference:hub) [P] (demo data; web (session)/tutor mounts AudioRecorderSheet + UploadQueueProvider [E])
→ post-session summary [E]     (human/hybrid path routes via tutor draft queue [E], tutorApprovedBy enforced in summary.service; guardian report view [E])
```

**Broken links:** the middle of this journey — discovery → profile → availability → confirmation — **does not exist at all**; booking UI exists but floats unanchored on fixtures with no guardian entry, no payment, no confirmation. Both ends (home, calendar, summary) are built. Additionally: no child selection means even a built booking flow couldn't say *which* child it books for; entitlement machine covers subscriptions only, not session purchases.

## J3 · Guardian → learner device handoff (doc 38 §1.1–1.2, cited IDs)

```
FD-10 consent [E] (consent-flow-content) → FD-11 family [E] → FD-12 add learner [E] (grade→band captured here)
→ FD-13 plan [E] → FD-14 connect a device (code+QR) [E†]
→ (second device) FD-08 enter code [E] → /handoff + /api/handoff/redeem [E†]
→ FD-16 pick your buddy [E] → FD-17 Natalie says hi [E] → learner:today [E†]
```

Onboarding set is COMPLETE per audit (mobile + web /onboarding/[flow] five prerendered sequences). Doc 38 laws hold in structure: child never types credentials; FD-08 single-pane at every width.

**Broken links:**
1. **Handoff mock short-circuit still live** (B "still true" list) — violates doc 38 §0 (cold-launch screens ship wired to the live provider). The chain demos but does not ship.
2. Band captured at FD-12 is dropped at the last arrow — live session never carries `gradeBand` (J1 finding 1), so the handed-off child lands in the wrong IA.
3. `app/onboarding/handoff.tsx` duplicate orphan — delete, keep `app/handoff.tsx` deep-link target (C).
4. FD-24 switch profile / FD-25 session ended not covered by audit A — verify existence in Phase 2 before contracting the family-device return path.

## J4 · Teacher intervention

```
teacher:home [P placeholder] → teacher:classes [M] → mastery insight [M] → teacher:student [M] → intervention/assign [M] → follow-up [M]
```

**The teacher shell is mostly missing — mark it and move on.** Mobile teacher shell renders **2 of 6** declared tabs (`/classes`, `/assign`, `/students`, `/calendar` routes don't exist; ShellTabBar drops them silently). Web `/teachers/me` is an [E] shell with nothing behind it. `institution/reports-screen` ships `UNAVAILE_METRICS` honest placeholders. The only functioning teacher-facing surface is inbound: the tokened read-only report share view [E] (blocks 1–6+8 per doc 34 §5), guardian-initiated.
**Broken links:** the entire chain after home; plus ShellTabBar's silent drop (make it fail loudly in dev — C action). District SSO/LTI is Phase 3 (doc 38 §1.5), but FD-23 class setup exists [E] and leads into a shell that cannot navigate — a front door onto a hallway with no rooms.

## J5 · Tutor workday

```
tutor:today [E] (tutor-today-content)
→ next session (tutor:schedule) [P]      (DEMO_DAY fixtures — schedule/fixtures.ts, BookingForm)
→ tutor:session-prep [P]                 (screen COMPLETE but SESSION_PREP is demo data, self-labelled "replace with real derived observations")
→ Tutor Room (conference:hub / web (session)/tutor) [P]   (demo data; audio/upload providers mounted on web)
→ tutor:notes [E]
→ draft queue [E]                        (draft-queue-content + SummaryQueuePaneScreen (one of AdaptivePanes' 2 real consumers) + /api/summary/queue; DataTable per doc 34 §5)
→ report approved [E]                    (tutorApprovedBy required for human/hybrid in summary.service — server-enforced)
→ earnings [M]                           (no earnings/payout screen anywhere in features/ or apps/; doc 36 org "Money" sidebar section unbuilt)
```

**Broken links:** the day's *inputs* are all fixtures (schedule, prep, room) while the day's *outputs* are real (notes, drafts, approval) — a tutor can finish work that never started anywhere; prep's mastery/misconception panel has no live derivation from doc-19/21 events; the journey has no payoff screen (earnings), so approved reports terminate the chain.

## J6 · Business ops (org)

```
lead (CRM pipeline) [E]        (ops feature: Stage/Lead model, applyStageChange reducer, use-stage-action optimistic write, /api/ops/leads(+[id]/stage), DataTable view — but doc 28 §3 "kanban by stage" board [M]: no board component exists anywhere; build seam = ReorderRow + EventDrag per A)
→ enrollment [P]               (enrollment.service + types only — no screen)
→ schedule [P]                 (real UI on DEMO_DAY fixtures; doc 28 §5 slot solver + zero-double-booking invariant [M])
→ tutor assignment [M]         (no assignment surface)
→ invoice [M]                  (no invoice object surface or screen)
→ payment [M]                  (Stripe rail exists for consumer subscriptions only; no business billing)
→ payroll [M]                  (verified: zero earnings/payroll surfaces in ops or anywhere else)
```

Web ops is a single `/ops` page (own root layout, h-dvh) running `screen.shared.tsx` demo data; org mobile companion (overview/schedule/inbox/safety) exists, overview+schedule PARTIAL.
**Broken links:** the pipeline ends at `Enrolled` with nowhere to go — no enrollment screen, no assignment, and the entire money half (invoice→payment→payroll) is missing; the CRM's trial-centric stages fire no automations (doc 28 §4 engine unbuilt); board view is a spec'd differentiator with zero implementation.

## J7 · District drill-down (Phase-3 scope, shipped fragments create dead ends now)

```
district:home [E]  (host-aware dispatcher → DistrictHomeScreen)
→ school [E]       (SchoolHomeScreen + institution/schools-list-screen)
→ teacher/people [E]  (institution/people-list-screen)
→ class [M]
→ student [M]
→ report [P]       (institution/reports-screen — UNAVAILABLE_METRICS labelled placeholders)
→ roll-up [M]      (no aggregation view; doc 36 district web-only Outcomes/Schools/Educators/Compliance sidebar unbuilt)
```

**Broken links:** drill-down stops at people — class and student levels don't exist, so insight can't reach anything actionable; `/academics` is an `InstitutionPlaceholderScreen` **while being a live nav destination** for school_admin (designed dead end — build or pull, C); mobile school/district shells render **1 of 5** tabs each (a tab bar that cannot navigate); roll-up direction (student→district aggregate) has no surface and k-anon `Suppressible` in DataTable is its only ready primitive.

## J8 · Incident (doc 31 §3.2 ladder + §4 flow)

```
S3/S4 trip in session [E†]     (packages/safety: ladder.ts, crisis.ts, plane.ts, incidents.ts; incidents.service.ts sets SLA hours + pagesHuman from LADDER[severity] — but the live tutor adapter classifies arithmetic on/off-task only, so the ladder's inputs are not produced at doc-31 fidelity; S4 fixed-script/safe-mode path unverified in audit)
→ guardian notified [M]        ((guardian)/(tabs)/alerts.tsx is an unreachable orphan that aliases NotificationsScreen; doc 36 §3.2 says Alerts IS a tab — wire it, don't delete (C); no push fan-out)
→ guardian incident view [M]   (safety barrel states it plainly: "The guardian view (§5.2) and the intake forms still have no screen." GuardianIncidentView projection + /api/guardian/incidents EXIST server-side, incl. whatTheTutorDid — the doc-31 fixed order What happened → What the tutor did → What happens next → Talk about it has data, no render)
→ acknowledgment [M]           (guardianAcknowledged in service; no UI writes it)
→ org triage queue [E]         (SafetyQueueScreen + incident-queue-content + queue-view + /api/safety/incidents; reads the same projections)
→ resolution [E]               (lifecycle new→…→closed + append-only timeline in incidents.service, server-side)
```

**Broken links:** the guardian half of the incident channel is server-complete and screen-absent — an S3 incident today reaches the org queue but **no parent can see it**, inverting doc 31's priority (guardian notification is the point); Alerts orphan + no push means even the notification hop fails; human-submitted intake forms (§5.1, both dials) have no screen; S4's 2h-SLA paging and safe-mode need live verification before any contract calls this journey shippable.

---

## Cross-journey findings (recurring state that doesn't propagate)

1. **Band population** (J1/J3): one provider defect starves every band-adaptive surface. Fix first.
2. **No child switching** (J1/J2/J8): guardians act on hardcoded fixtures; `learnerId` never set → every guardian journey is single-hypothetical-child.
3. **No notification/push layer** (J1/J2/J8): summaries, bookings, and incidents all terminate server-side; OneSignal wiring unbuilt.
4. **Fixture middles, real ends** (J2/J5/J6): schedule/prep/booking/ops demo data between working endpoints — journeys demo but don't ship (doc 38 §0 applies beyond the front door).
5. **Server-complete, screen-absent** (J8 guardian view, J6 enrollment, J5 approval trail): projections and services exist with no render — cheap Phase-2 wins.
6. **Silent-failure chrome** (J4/J7): ShellTabBar drops undeclared tabs without error; make it throw in dev before building the missing routes.
7. **No unified screen-ID scheme** beyond FD-*/PW-* — blocks contract cross-referencing; extend the convention (B queue #2) before writing per-screen contracts for these chains.

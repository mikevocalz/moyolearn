# Screen Briefs — Research-Traced Design for Every Critical Screen
**Companion to:** plan · design spec · tailoring · **Date:** Aug 19, 2026
**Skills applied per screen:** frontend-design (dial, signature), design-system (components/states), design-handoff (behavior spec), accessibility-review (WCAG 2.2 AA), ux-copy (every label says what happens), user-research/research-synthesis (traceability below)
**Rule:** no screen ships without a filled brief in this format. A screen that can't cite a research input is a screen we haven't earned yet.

## R-index — the findings every screen traces to

| Tag | Finding (sourced in the plan doc) |
|---|---|
| R1 | Only ~15% of students with Khanmigo access engage; 85% never open it. Khan's fix: proactive help embedded in the work, mastery/prerequisite-aware — not a side chatbot |
| R2 | Students who did engage ~30 min/wk gained ~2–3 weeks of instruction — the pedagogy works when the door gets opened |
| R3 | Khan's transfer metric is next-item correctness: can the student solve the *next* one alone |
| R4 | Answer engines (Photomath/Socratic pattern) are steered away from by reviewers and parents; guided productive struggle is the differentiator buyers already reward |
| R5 | Noto mobile is a today-first re-projection: week strip → Next card → the primary action *inside* the card ("Take attendance") |
| R6 | Noto desktop: persistent inspector; selection inspects, never navigates |
| R7 | Ops buyers resent per-lesson/percent fees and reward flat pricing; the schedule command center is the screen that wins the switch |
| R8 | TutorBird's cited weakness is no real mobile app — mobile ops surfaces are a wedge, not a nice-to-have |
| R9 | Amended COPPA (compliance date passed Apr 2026): voiceprints/biometrics are personal information; disclosing children's data for AI training needs *separate* verifiable parental consent; written retention + security programs; sub-processor accountability |
| R10 | *M.C. v. Curriculum Associates* alleges behavioral student profiling — pedagogical signals must never assemble into an identified profile that leaves our boundary; show families derived observations, expire raw media/transcripts |
| R11 | Parents shouldn't hunt: payments, approvals, forms, reschedules, concerns must aggregate (Action Needed) |
| R12 | The tutor's morning question: who am I teaching, where, and what should I know — AI prep makes the human better instead of competing (the between-sessions hybrid loop) |
| R13 | Find-a-Time must match subject, credentials, mode, radius, language, availability, price, rating, relationship — and show real bookable windows; the AI proposes, a human confirms, never silent writes |
| R14 | Duolingo's habit mechanics are the engagement ceiling benchmark; Synthesis proves families pay premium for *feel* |
| R15 | Repo reality: resource-major grid, column-owned accents, duration-preserving snap drag, 55/85 sheet snaps, M3 window classes, hot/cool dial tokens |

Format per screen: **Job → Research → Layout → Design → Copy → A11y → Metric.** Dial = hot/cool token axis; archetypes/ladder per the design spec; components per the tailoring doc.

---

## Phase 1 — Operations + Tutor (the revenue wedge)

### S1 · Ops Resource Schedule (command center)
**Job:** "Where can this session go, and is today healthy?" — the screen that wins the switch from Teachworks/TutorCruncher (R7).
**Research:** R6 (inspector), R7, R13, R15 (grid exists — extend, don't rebuild).
**Layout:** Triptych. `extraLarge`: filters · resource lanes · inspector, all persistent. `expanded`: lanes + inspector, filter column collapsible (`CollapsiblePane`). `medium`: lanes + inspector-on-selection. `compact`: owners get the Today ops summary instead — the grid is not a phone surface; schedulers on phone get agenda + Find a time (R8 still honored: real mobile ops, different projection).
**Design:** cool dial. Signature: tactile tiles — press sinks the slab shadow, drag lifts it, invalid drops (availability/conflict/travel from `validate.ts`) render the redpen hatch and refuse with error haptic. Resource accents stay column-owned (R15/Noto rule already in `model.ts`).
**Copy:** buttons name outcomes — "Edit session," "Message parent," "Cancel session." Cancel confirm: "Cancel Maya's 4:00 PM session? The family will be notified." / actions "Cancel session" · "Keep session" (never OK/Cancel).
**A11y:** arrow keys move tile focus within a lane, ⇥ between lanes, Enter inspects, Esc collapses inspector; tile SR label: "Maya Johnson, Algebra Two, 4 to 5 PM, virtual, James's column." 44pt minimum tile height at every zoom step.
**Metric:** weekly-active-scheduler; median time-to-place-a-session.

### S2 · Find-a-Time
**Job:** turn a constraint bundle into a confirmed booking in under a minute.
**Research:** R13 (dimensions + confirm-don't-write), R7 (this speed is the sales demo), research-plan exit criterion (<60s for 4 of 5 testers) is this screen's acceptance test.
**Layout:** `extraLarge/expanded`: command overlay (⌘K) over the schedule; results replace the inspector pane. `compact`: full-screen flow. Results are ranked cards with reason chips — "No conflicts" · "Worked with James twice" · "12 min travel" — because trust in the ranking *is* the feature.
**Design:** cool dial; the one highlighter moment in ops — the recommended slot card gets the highlighter wash with ink text.
**Copy:** "Find a time" (entry), "Confirm booking" (commit), "Show alternatives." Empty result: "No open times match. Widen the date range or allow virtual sessions."
**A11y:** results are a listbox; reason chips read as part of each option's label; full keyboard path from ⌘K to confirmed booking.
**Metric:** completion time; % bookings via Find-a-Time vs manual placement.

### S3 · Session disclosure (peek → inspect → edit)
**Job:** answer "what is this event and what do I do about it" without losing the calendar.
**Research:** R6, R15 (55/85 snaps, `EventActionsSheet` seed), design-spec ladder; HIG popover→sheet adaptation.
**Layout:** L1 peek = Gorhom sheet @55% (`compact`) / anchored popover (`medium`) / merged into inspector (`expanded`+). L2 = 85% sheet or inspector with `InspectorSection`s: Details · Roster · Billing · Attendance · Notes · Activity. L3 edits push routes.
**Design:** dial follows the host shell. Exactly two L1 actions by role: parent Pay/Reschedule · tutor Prep/Start · scheduler Edit/Message · student Join/Ask to reschedule.
**Copy:** action names persist through the flow — "Reschedule" → sheet titled "Reschedule session" → toast "Session rescheduled."
**A11y:** sheet announces itself and its snap state; drag-to-85% has a button equivalent ("Show full details").
**Metric:** % event interactions resolved without route navigation.

### S4 · Tutor Today
**Job:** the pilot's run list — who, where, what should I know (R12).
**Research:** R5 (the screenshot's Next-card + inline action is the proven pattern), R12, R8.
**Layout:** Feed on `compact` (the hero mobile screen); Duet with Prep pane from `medium` up. Cards obey the budget: name · time/mode · AI-prep line · one action pair.
**Design:** cool dial, warm accent on the Next card only. AI PREP block set in the tabular mono — data voice, not chat voice.
**Copy:** "Prep" · "Start session"; travel rows read plainly: "35 min travel to Brooklyn." Empty day: "No sessions today. Your availability is open — families can book you."
**A11y:** Next card is the first focus target; live-region update when a session becomes joinable.
**Metric:** prep-viewed-before-session rate (the hybrid loop's leading indicator).

### S5 · Student Prep (tutor-facing)
**Job:** make the human tutor measurably better in 30 seconds of reading (R12) — the first AI feature a paying business sees.
**Research:** R12, R3 (show what the student did *since last session* and what transferred), R10 (derived observations only — "Difficulty when a ≠ 1," never raw transcript scroll), R2.
**Layout:** Detail-pane native (Duet/Triptych third pane); `compact`: pushed from Today.
**Design:** cool dial; mastery bars in grade-green/redpen semantics; misconception chips.
**Copy:** "Generate session plan" (verb, outcome); provenance is honest: "From 2 AI practice sessions this week."
**A11y:** mastery bars carry text equivalents ("Factoring, 72 percent, up 8 since last session").
**Metric:** session-plan generation rate; tutor-reported prep usefulness (research loop).

### S6 · Booking & approval
**Job:** create a correct, policy-safe session — and route it through a guardian when required.
**Research:** R13, R11 (parent approval is an Action Needed item), R15 (`BookingSurface` exists).
**Layout:** sheet-first (`compact`) / inspector-pane form (`expanded`); date/slot picking reuses S2's engine.
**Design:** cool dial; policy consequences shown before commit ("Within the 24-hour window — cancellation fee applies").
**Copy:** "Book session" · "Request session" (when guardian approval is needed — the verb tells the truth about what happens).
**A11y:** every constraint error is inline, field-adjacent, and says how to fix.
**Metric:** booking error rate; approval turnaround time.

---

## Phase 2 — Learner + Family (the mission surface)

### S7 · Student Home
**Job:** open the door the 85% never open (R1) — one glance answers "what now?" and the first tap lands *inside the work*.
**Research:** R1 (proactive, in-the-work entry: the Continue Learning card resumes the exact skill, not a menu), R2 (the payoff we're chasing), R14 (habit mechanics — streak chip, visible improvement moment "Factoring 64% → 72%"), R5 (no giant calendar; today's plan as three checkable lines).
**Layout:** Feed (max-width 680 centered on big screens); order: Continue Learning · Next session · Today's plan · Improvement moment.
**Design:** hot dial. The tutor-presence avatar in the center tab is the signature — subtly alive (breathing idle, reduced-motion: static). Celebration is warm, never manipulative: no guilt streaks, no countdown pressure (kids' product, and R4's spirit applies to motivation too).
**Copy:** "Continue" on the learning card (it resumes, so it says so); plan items are verbs: "Practice factoring · 15 min." Empty state: "All done for today. Want to get ahead? Natalie has a 10-minute challenge."
**A11y:** dynamic type to 200% without truncating the plan; improvement moment announced with the numbers, not just confetti.
**Metric:** weekly engaged-learner rate — the anti-15% number, on the home screen's shoulders first.

### S8 · Student Plan
**Job:** "What do I have to do?" — one mixed timeline of sessions, assignments, and AI practice (a child doesn't care which collection an item came from).
**Research:** R5 (WeekStrip + agenda), R1 (planned AI sessions support routines and parent study plans without forcing scheduling on instant help).
**Layout:** compact: WeekStrip + agenda; `medium`+: Duet (week · today). Never a resource grid, never a filter column — three-column *capable* ≠ mandatory.
**Design:** hot dial; human sessions carry the tutor's avatar, AI practice carries the presence mark — the child always knows who's on the other side.
**Copy:** "Join session" (live), "Start practice," due labels in plain speech: "Due tomorrow."
**A11y:** timeline is a list, not a grid, for SR order; joinable session announces via live region.
**Metric:** plan-item completion rate; on-time session joins.

### S9 · Tutor Session (AI — chat/voice v1)
**Job:** teach, don't answer — the productive-struggle ladder as an interface.
**Research:** R4 (probe → nudge → hint → scaffold → worked example; jumping to answers is the anti-pattern buyers reject), R3 (after any help, the next item is attempted solo and *that's* what updates mastery), R1 (the tutor opens already knowing the assignment context — proactive, not blank-slate), R9 (voice is transcribe→derive→discard; voiceprints are personal information now), R10 (raw transcript expires on schedule; the record is the derived observation).
**Layout:** Focus archetype. compact: full-stage presence + input; `medium`+: presence · working canvas (equation/whiteboard) side by side.
**Design:** hot dial; latency is a design property — streaming voice/text with visible thinking state (Khan's own tests found seconds matter). Hints are labeled honestly: "Hint 1 of 3" — the ladder is visible so effort feels fair, not withheld.
**Copy:** the tutor never says "Wrong." Error voice is empathetic + forward: "Not yet — look at the 7 on the left side. What undoes adding 7?" Session end: "You solved the last two on your own." (R3, spoken as praise.)
**A11y:** full parity between voice and text modes; captions on by default for voice; reduced-motion presence.
**Metric:** next-item correctness after help; unaided-solve rate per session.

### S10 · Practice / Assignment player
**Job:** the rep machine — where mastery actually moves (R2).
**Research:** R3 (instrumented per item), R4 (help ladder inline, never a Solve button), R14 (session-end celebration tuned to effort, not just correctness).
**Layout:** Focus; one item per screen on compact, item + scratch canvas on `medium`+.
**Design:** hot dial; progress is a filling ink bar, mastery deltas in grade-green.
**Copy:** "Check answer" → "Try again" (with the ladder offer) or "Next question." Never "Fail."
**A11y:** math rendered accessibly (alt/semantic markup), answer inputs fully keyboard/switch operable.
**Metric:** items per engaged session; ladder-depth distribution (are we hinting too early?).

### S11 · Parent Home
**Job:** "Is my child on track, and what do I need to take care of?" — in one screen, because trust is the product parents buy.
**Research:** R11 (Action Needed aggregation is the headline block: invoice, approval, unsigned form, reschedule, progress concern), R2 (outcome deltas, not activity noise), R1 (a parent who sees value renews the subscription that keeps the child's door open).
**Layout:** Feed; child summary card(s) → This week → Needs attention → Action Needed → Upcoming.
**Design:** cool structure, hot accents on child cards; redpen reserved for genuinely overdue items so it keeps meaning.
**Copy:** actions are the buttons — "Pay $240," "Review request," "Sign form." Needs-attention is specific and calm: "Quadratic factoring needs practice — 63% mastery," never alarmist.
**A11y:** Action Needed is a list with per-item actions; amounts and dates in text, not color alone.
**Metric:** action completion latency; parent WAU; renewal rate.

### S12 · Parent — AI activity & permissions
**Job:** let a parent see exactly what the AI knows, said, and keeps — and control it.
**Research:** R9 (consent records are first-class: what's on, what's off, and the AI-training disclosure consent we *never request* shown as permanently off), R10 (derived observations shown; raw transcript access clearly time-limited with the expiry date visible — retention as UI, not policy prose), Khanmigo's parent moderation is the baseline to exceed.
**Layout:** Duet — child selector/policy list · detail.
**Design:** cool dial; this screen is deliberately the calmest in the product. No dark patterns anywhere near consent toggles.
**Copy:** plain language throughout: "Voice recordings are converted to text and deleted right away." Toggle labels state effect: "Allow AI practice sessions" · "Weekly summary emails." Confirmation on restrictive changes explains impact on the child's experience honestly.
**A11y:** every toggle programmatically labeled with current state + consequence.
**Metric:** % parents who visit and adjust ≥1 setting (informed consent as engagement); support tickets about "what does the AI keep."

### S13 · Family Calendar
**Job:** where does my family need to be — coordination, not operations.
**Research:** R5 (agenda-first), his own product rule: AI practice events off by default (noise), reschedule reachable at L1 (R11's spirit — no hunting).
**Layout:** compact: agenda + child chips; `expanded`: Duet + optional filter column only with 2+ children.
**Design:** cool-warm mix; child color chips are consistent everywhere a child appears.
**Copy:** "Reschedule" opens the request flow and says so when tutor approval is required: "Request new time."
**Metric:** reschedule completion without support contact.

### S14 · Onboarding & consent (all shells)
**Job:** from download to the right shell with lawful, understood consent — the platform's front door and its legal foundation in one flow.
**Research:** R9 (guardian-owned learner profiles, not independent under-13 logins; knowledge-based parental verification; separate-consent architecture), R10 (three-store promise stated up front in human words), plan §ADR-003.
**Layout:** Focus, one concept per screen (progressive disclosure); role detection → guardian flow / educator flow / business flow.
**Design:** hot for family framing, cool for business; the presence avatar introduces itself once, briefly — first impression of the signature.
**Copy:** "Create your child's profile" (the guardian owns it — the words match the data model). Consent screens: what we collect, why, how long, one screen each, eighth-grade reading level. The permanent line, stated plainly: "We never use your child's conversations to train AI."
**A11y:** the entire flow completable with screen reader + keyboard; consent text real text, never images.
**Metric:** completion rate per role; consent comprehension spot-checks in usability rounds.

### S15 · Context switcher (multi-role accounts)
**Job:** one human, several hats — parent-who-tutors switches worlds in two taps, and the entire shell changes.
**Research:** plan role model (memberships are auth-level, not UI sugar); Khan precedent of multi-role accounts.
**Layout:** drawer/rail header control → full-screen switch sheet listing memberships with org + role; switching swaps route group.
**Design:** each context carries its dial — the switch is visually unmistakable (a parent surface never looks like the ops surface).
**Copy:** entries read "Maya's parent" · "Lincoln Middle · Teacher" · "Brightpath Tutoring · Owner" — human names for hats.
**A11y:** current context always announced on switch; focus lands on the new shell's first heading.
**Metric:** switch success without dead-ends; cross-role retention.

---

## The standing loop
Every brief above feeds the research plan's usability rounds; every round's findings amend the brief before the screen ships. Research → brief → build → test → amend — that loop, not any single screen, is what "research influences every screen" means in practice.

<!--
  The legal-review checkpoint doc 31 requires before launch, prepared so that
  counsel's review is a working session over stated facts rather than an
  archaeology project. Everything in §1-§3 is verifiable in code and cited;
  §4 is the list of questions ONLY counsel can answer. Nothing in this document
  is legal advice and nothing in the codebase invents legal process.
  SOT: docs/pack/31-grade-voice-safety-incidents.md · packages/safety/src/incidents.ts
  SOT-KEYWORDS: counsel legal review s4 ncmec mandated reporter legal hold checkpoint launch gate
-->
# Counsel review — the S4 pathway, as built
**Status: OPEN — launch-gating.** Doc 31's own hard note: reporting obligations
are *separate from and senior to* guardian notification, and this workflow must
carry a legal-review checkpoint before launch. This is that checkpoint's brief.

## §1 · What the system does today, mechanically (all verifiable)

When a child's message classifies S4 (self-harm/suicidal ideation, disclosure
of abuse, threats of harm to others):

1. **Tutoring stops mid-stream.** The turn is replaced with a fixed,
   human-written script — never generated text. `packages/safety/src/crisis.ts:
   S4_SCRIPTS` (frozen objects; a test asserts the generator records zero calls
   on this tier). The US script points to the 988 Suicide & Crisis Lifeline.
2. **The session enters safe mode** until a human clears it
   (`CrisisResponse.safeMode: 'until-human-clears'`).
3. **A safety event and an incident are filed** in the same request:
   `safety_events` at `tier=S4`, and an `incident_reports` row at severity S4,
   status `new`, 2-hour SLA (`slaDueAt`), `guardianVisible: true`, with an
   append-only timeline the repository refuses to shorten
   (`apps/web/lib/incident.repository.ts:saveIncident`).
4. **A legal hold is applied at creation** for S4 or category
   `abuse-disclosure`: `legalHold = 's4-or-abuse-disclosure · pending counsel
   signoff'` (`packages/safety/src/incidents.ts:LEGAL_HOLD_REASON`). No
   function in the product lifts a hold. The retention sweep's predicate is
   `expires_at < now() AND legal_hold IS NULL` — proven on the live database
   with a held row surviving beside a deleted unheld one
   (`packages/payload/src/retention/legal-hold.integration.test.mjs`).
5. **Two fan-out jobs enqueue immediately** (pg-boss, priority 100, never
   shed): `safety.alert.guardian` and `safety.review.enqueue` (on-call human).
   Delivery transport is deliberately unbuilt — the obligation is durable and
   visible; no sender exists yet (`docs/design/jobs.md` §8.5).
6. **What is stored contains no words by default.** The safety event's trace is
   layer ids and class labels; the incident's `transcriptExcerpt` is a
   *reference* (`{sessionId, messageIds}`) rendered under permission, never a
   copy. The child's words live in the messages/transcript stores on their own
   retention clocks — except that a legal hold on the incident does NOT today
   extend to the referenced transcript rows (see Q3).

What the system deliberately does NOT do: submit anything to NCMEC, notify any
authority, or decide who is told what beyond the guardian and the internal
review queue. A human is the one who decides what is reported to whom.

## §2 · The statutory surface counsel must own

Stated as the engineering team's understanding of *which questions exist* —
not as conclusions:

- **18 U.S.C. §2258A** — provider reporting duties to NCMEC's CyberTipline for
  apparent child sexual abuse material / exploitation. Whether Moyo is an
  "electronic communication service or remote computing service provider"
  within the statute for this product shape, what "actual knowledge" means for
  a classifier-flagged event, the report timeline, and §2258A(h) preservation
  duties (90 days + extension) versus our indefinite hold.
- **State mandated-reporter statutes** — whether tutors (human, on-platform)
  and/or staff reviewing the S4 queue are mandated reporters in the states we
  operate; the variance question doc 31 names.
- **COPPA / FERPA posture** — whether the incident record itself (which names a
  learner and a category) creates disclosure duties or constraints on the
  guardian-notification copy, and whether the school-account case changes who
  the "parent" for notification purposes is.
- **Data-retention conflict** — a guardian's erasure right (S27, built and
  live) versus preservation duties on held material. Today: `forget-all`
  erases the learner's transcripts/facts/media but does NOT touch
  `incident_reports` (no code path deletes an incident at all). Whether that
  is the correct resolution is a legal question, not an engineering one.

## §3 · The checkpoints already in code, waiting for counsel's answers

| decision point | file:symbol | current behavior |
|---|---|---|
| what triggers a hold | `incidents.ts:isHeld` | S4 severity OR abuse-disclosure category |
| hold release | *(none)* | impossible in-product, by design |
| preservation scope | `legal-hold.integration.test.mjs` | incident row only — **not** referenced transcripts (Q3) |
| guardian copy for S3/S4 | `packages/app/features/safety/` render strings | human-written, factual, observable-behavior-only |
| who sees an incident | `incident.repository.ts` access + `check-crm-wall.mjs` | guardian (own learner, if visible), filer, org queue; CRM structurally never |
| review paging | `safety.review.enqueue` handler | durable job; no transport |

## §4 · Questions for counsel (the actual review)

1. Is Moyo within §2258A's provider definitions for this product shape, and if
   so, what event classes here constitute reportable "apparent" violations?
2. Does a classifier flag constitute knowledge for reporting-clock purposes,
   or does the clock start at human review? (Our SLA pages a human within 2h.)
3. Must the legal hold extend to the *referenced transcript rows* (child's
   words) rather than the incident record alone? If yes, engineering will add
   hold propagation to the messages/transcript stores — one named change.
4. Are on-platform human tutors mandated reporters in launch states, and what
   does that require of the review-queue UI (e.g., surfacing reporter duties)?
5. May a guardian's forget-all erase the transcript rows an incident
   references while the incident is held? (Today it can — Q3's flip side.)
6. Is the S3/S4 guardian-notification copy compliant as drafted, and does the
   school-account case redirect notification?
7. What is the correct release procedure for a hold once obligations lapse,
   and who inside the org may execute it? (We will build exactly that
   procedure and nothing looser.)

## §5 · After signoff

Each answer maps to at most one bounded engineering change (hold propagation,
a release procedure behind a named role, copy edits, a reporter-duty banner on
the queue). None are speculative; none will be built ahead of the answers.

# Session Summary Reports — making learning visible to parents & teachers
**Doc 34 · Moyo platform pack · Date:** Aug 27, 2026
**Goal (Mike's words):** parents and teachers need to *feel like their child is learning or accomplished something.* This doc specifies what the report contains (research-grounded), the Payload table, the generation pipeline, and the surfaces.
**Builds on:** doc 08 (Hot/Cool, MasteryBar, semantic color law), doc 12 §11 (versions off, messages collection, erasure), doc 19 (metric law, S27 visibility), doc 21 (outcomes analytics), doc 29 (Bunny), doc 31 (incidents are a separate channel), doc 33 PRD (FR-9.2 gains this system).

---

## §1 · The research, and the trap it exposes

**The perception gap is the central design constraint.** Learning Heroes/Gallup: **~88–91% of parents believe their child is at or above grade level in reading and math; national benchmark data puts actual proficiency near 30%** (8th grade), and the mechanism is known — **~79–80% of kids bring home mostly B's or better**, so parents anchor on rosy signals ([Gallup/Learning Heroes](https://www.gallup.com/analytics/513881/parents-perspectives-on-grades.aspx) · [Centering Families, Oct 2025](https://www.prnewswire.com/news-releases/learning-heroes-releases-new-report-centering-families-in-the-future-of-education-302589581.html) · [Carnegie interview: 91% of HS parents](https://www.carnegiefoundation.org/engaging-families-empowering-students-a-conversation-with-learning-heroes-ceo-bibb-hubbard/)).

**The trap:** a report engineered only to make parents *feel good* joins the B-plus machine that created the gap. The feeling Mike wants has to come from **visible, evidenced, real progress** — because inflated reports eventually collide with a test score, and the product dies with the trust. Learning Heroes' own conclusion is the design brief: families need *clearer, more complete, more actionable* information, communicated as partners.

**How to celebrate honestly — process praise.** Dweck's research: praising **effort, strategies, and improvement** (not ability, not outcomes) builds growth mindset; mothers' process praise at ages 1–3 predicted the child's growth mindset in 2nd grade *and* math/reading attainment in 4th ([Dweck, Parents League](https://www.parentsleague.org/blog/growth-mindset-and-future-our-children)). And it transfers through parents: a growth-mindset message *to parents* led them to choose more challenging home learning activities ([PMC study](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10607904/)). The report's language is therefore a lever on the *home*, not just a record.

**What practitioners converged on** (independent sources, same shape): a consistent template — *what we covered / progress made / next steps* — so "a parent shouldn't be able to tell which tutor wrote the report" ([Tutorbase](https://tutorbase.com/blog/progress-report-template-tutoring-templates)); **3–6 sentences, and "today we did x, y, z" recaps are explicitly bad practice** ([LearnSpeed](https://www.learnspeed.com/writing-session-logs-revisited/)); a *wins + reinforce-at-home* section (the TPT template ecosystem); an honest progress trail that builds on prior reports, because the trail is what convinces parents "their investment is worth it" ([SmileTutor](https://smiletutor.sg/tutors-how-to-write-an-effective-after-lesson-report/)); and continual updates that "make student progress — and the value of the tutoring program — visible and tangible," respecting each family's communication preferences and confidentiality ([Stanford NSSA toolkit](https://nssa.stanford.edu/toolkit-tutoring-programs/tutor-program-family-communication-continual-updates)). Reports are also a retention instrument: structured notes feed dashboards and renewals ([Tutorbase portal guide](https://tutorbase.com/blog/parent-portal-for-tutoring)).

## §2 · The report anatomy (the answer to "what should it entail")

Eight blocks, fixed order, schema-enforced. Adult register (this is for grown-ups; band affects *content examples*, not the report's voice). Every claim below is **evidence-linked or it doesn't render.**

1. **Headline accomplishment** — one sentence, concrete, process-framed: *"Maya solved 4 two-digit subtraction problems on her own today — including one she'd missed twice before."* Never "had a great session!" (unfalsifiable praise is the B-plus machine). This is the screen's single display moment.
2. **What we worked on** — the skill in parent language + why it matters next: *"Regrouping in subtraction — the skill that unlocks multi-digit everything."* One or two skills max; a session that touched five lists the two that moved.
3. **The problems, grouped by subject — accordion, open by default.** Every homework problem the session touched, grouped under subject headers (Math, Reading, …), **all groups expanded on load** — a parent reads the report, they don't excavate it; the collapse affordance exists for long multi-subject sessions, not as the default posture. Each problem row shows **the question and the child's answer**:
   - **The question** as the child saw it — the capture crop image for Homework Coach problems (token-auth render per doc 24/29; when the crop's TTL expires the row degrades to extracted text, then to "source expired"), or the problem text for generated practice.
   - **The child's answer**, verbatim — their final answer, with attempt count when >1.
   - **Status**, in trajectory language, never pass/fail: `solved on their own` (grade-green) · `solved with help` (graphite) · `still working on it` (highlighter — doc 08: a learner mid-struggle is never red; redpen is reserved for an *incorrect final answer the child submitted as done*, rendered as the answer's underline, the one place "marked wrong" is honest and school-native).
   - The trajectory *is* the accomplishment: *"missed twice → solved on her own"* on one row does more for "my child is learning" than any adjective — this block is the concrete proof the headline claims.
4. **How it went — honestly, on two separate axes:**
   - **Movement** (celebrated): the mastery delta, rendered as the doc 08 MasteryBar before→after. *"Practicing → Getting it."*
   - **Position** (honest): where this skill sits relative to the learner's grade expectations, in normalizing language: *"Still building toward where 2nd grade lands — right where the work should be."* Struggling is **never red** (doc 08 law) and never hidden. **These two axes are never conflated** — conflation is exactly how 80% of kids get B's while 30% are proficient.
5. **A moment of effort** (process praise, specific): *"She tried three different strategies on the hardest one and stuck with it after two misses."* Sourced from real session events (retries, strategy switches, persistence after wrong answers) — the anti-sycophancy rule is that this block cites an event or it's omitted.
6. **What's next** — what the tutor will do next session (continuity trail; each report builds on the last).
7. **How to help at home** — exactly two items: one **conversation starter** (*"Ask her to show you the 'borrowing' trick with coins"*) and one **5-minute activity**. Actionable beats comprehensive — this is the block the growth-mindset-transfer research says changes the home.
8. **The facts strip** (de-emphasized, `caption`/`data` mono): date, duration, problems attempted/solved independently/solved with help. Present for honesty; **never the story** — minutes are not learning (doc 19 metric law), so duration is context, never an achievement.

**What the report never contains:** engagement metrics framed as wins (streaks, minutes, message counts); ability praise ("so smart," "gifted," "natural"); grade *predictions*; comparisons to other children; and **safety content** — a session that raised an S3/S4 gets a normal schoolwork summary here, and the incident travels its own channel (doc 31) with its own gravity. A parent must never discover an incident in paragraph three of a cheerful recap.

## §3 · The Payload collection

```ts
// collections/SessionSummaries.ts   — versions: false (doc 12 §11)
{
  learner: relationship,
  session: relationship,                    // 1:1 with tutor_sessions
  sessionKind: 'ai-tutor' | 'human-tutor' | 'hybrid',
  band: 'K-2' | '3-5' | '6-8' | '9-12',
  // The seven blocks, structured — narrative fields are short strings, not essays:
  headline: text,                           // block 1
  workedOn: array<{ skillId, parentLabel, whyItMatters }>,          // block 2
  mastery: array<{ skillId, before, after, gradePosition,           // block 4
                   positionCopy }>,         // normalizing language, generated per band
  problems: array<{                         // block 3 — deterministic, from session events
    subject, skillId,
    questionRef: { kind: 'capture-crop'|'problem-text', mediaId?, text? },
    childAnswer: text,                      // verbatim final answer
    attempts: number,
    status: 'solved-independently' | 'solved-with-help' | 'still-working',
    submittedIncorrect?: boolean,           // redpen underline case only
    orderInSession: number,
  }>,
  effortMoment: { copy, evidenceRef },      // block 5 — omitted if no evidence
  nextUp: text,                             // block 6
  homeSupport: { conversationStarter, activity },                   // block 7
  facts: { durationMin, attempted, solvedIndependently, solvedWithHelp }, // block 8
  evidenceRefs: array<{ kind: 'message'|'event'|'problem', id }>,   // grounding, permission-gated render
  // Generation provenance (auditable):
  generator: { model, promptVersion, schemaVersion },
  safetyScreened: boolean,                  // must be true to publish
  // Human-tutor path:
  tutorDraft?: richText,                    // tutor writes/edits; AI drafts, human owns
  tutorApprovedBy?: relationship,           // required when sessionKind != 'ai-tutor'
  // Lifecycle & sharing:
  status: 'generating' | 'draft' | 'published' | 'suppressed',
  publishedAt?: Date,
  guardianViewedAt?: Date,                  // the visibility loop
  teacherShare?: { enabled: boolean, token, expiresAt, revokedAt }, // guardian-initiated
  digestBatchId?: string,                   // weekly rollup membership
}
```
Rules: **summaries are their own retention class** — they are the durable record of learning and may outlive transcripts (guardian-controlled; erasure cascade still covers them, and `evidenceRefs` degrade gracefully to "source expired" when the underlying transcript TTLs out). `suppressed` exists for the rare summary a human reviewer pulls (generation error, safety miss) — suppression is logged, never silent deletion. **Teacher sharing is guardian-initiated** (a revocable tokened read-only link, expiring): the guardian owns consent, which keeps the FERPA posture clean and matches S27; org human-tutors see their own sessions' notes natively (doc 23 wall: CRM sales surfaces never read summaries).

## §4 · Generation pipeline (evidence-first, narrative-second)

```
session ends → pg-boss job:
  1. Evidence extraction (deterministic, no LLM): skills touched, mastery
     deltas from doc-19/21 events, attempts/independence counts, effort
     events (retries, strategy switches, persistence-after-miss), and the
     problems block — question refs, verbatim child answers, statuses —
     assembled from session events, not generated
  2. Narrative pass (small model, schema-constrained JSON): writes blocks
     1/2/4/5/6 FROM the evidence — the prompt receives only extracted
     evidence, never the raw transcript, so the summary cannot leak
     chat content and cannot praise what didn't happen
  3. Honesty lint (pure fns, bun test): every claim maps to an evidenceRef;
     banned-language list (ability praise, superlatives without evidence,
     minutes-as-achievement); block-3 axes present and distinct
  4. Safety screen: doc-07 classifier over the rendered summary INCLUDING
     the verbatim child answers in the problems block; a child answer that
     carries S3/S4 content is already an incident (doc 31) — that problem
     row is suppressed here and travels the incident channel instead, and
     an answer containing PII is masked in the render
  5. Publish (ai-tutor) or route to tutor draft queue (human/hybrid —
     LearnSpeed pattern: the human owns the note, the AI drafts it)
  6. Notify per guardian preference: immediate push (OneSignal) or into
     the weekly digest — cadence is a guardian setting, not our guess
     (NSSA: respect stated communication preferences)
```
The load-bearing decision is step 2's input boundary: **the narrative model never sees the transcript.** It sees the evidence table. That single constraint delivers anti-sycophancy (can't praise what isn't evidenced), privacy (can't quote the child), and safety (can't surface S-content) — one boundary, three guarantees.

## §5 · Surfaces

- **Guardian (Hot dial):** session card in the family feed (headline + MasteryBar delta) → full report view in the eight-block order. The problems accordion: subject headers as `title` 17/600 with a 44px chevron target, **all sections open on load**, `gap-group` between subjects; problem rows at Hot height (64+) with the crop thumbnail or question text, the child's answer in `body`, attempts in `data` mono, status as a `label` pill (grade-green / graphite / highlighter per §2.3) — and rows separated by `gap-element`, never flush borders (doc 08). One display moment (the headline), MasteryBar per doc 08 §4.8 (fill grade-green; needs-attention = highlighter, never red), facts strip in `data` mono at the bottom. `guardianViewedAt` written on open — which also gives orgs the honest retention metric (viewed-rate, not sent-rate).
- **Weekly digest:** one push/email rolling up the week: skills moved, best effort moment, one home activity. Digest links into reports; it never replaces them.
- **Teacher share view:** read-only tokened page, report blocks 1–6 + 8, problems accordion included — it's the most useful block for a teacher (home-support block swaps for a "context for the classroom" line), Moyo-branded, revocable, expiring.
- **Tutor/org (Cool dial):** draft-review queue on the doc 28 DataTable (human sessions), plus per-learner report trail — the "progress trail" that practitioner research says drives renewals.

## §6 · Metrics (under the doc 19 law)
Guardian viewed-rate and time-to-view; home-activity tried (one-tap "we did this" on the activity card — optional, honest); report-driven retention (families who view ≥3 reports/month vs churn); honesty-lint rejection rate (drift alarm on the generator); tutor edit-distance on drafts (is the AI draft actually good?). **Not measured:** report open streaks, notification CTR optimization, anything that would tune reports toward flattery.

## §7 · PRs
- **PR-125 · SessionSummaries collection** + retention class + access rules.
- **PR-126 · Evidence extractor** (pure fns over doc-19/21 events, `bun test`).
- **PR-127 · Narrative pass + honesty lint** (schema-constrained generation, banned-language list, evidenceRef enforcement).
- **PR-128 · Safety screen + suppression path.**
- **PR-129 · Guardian report view + family-feed card + digest** (Hot dial), incl. the subject-grouped problems accordion (open by default) with crop rendering + TTL degradation.
- **PR-130 · Tutor draft queue** (Cool dial, DataTable) **+ teacher share links.**
- **PR-131 · Notification preferences + OneSignal wiring.**

## §8 · Sources
[Gallup × Learning Heroes — parents' perspectives on grades](https://www.gallup.com/analytics/513881/parents-perspectives-on-grades.aspx) · [Learning Heroes, Centering Families (Oct 2025)](https://www.prnewswire.com/news-releases/learning-heroes-releases-new-report-centering-families-in-the-future-of-education-302589581.html) · [Carnegie Foundation interview (91% HS stat)](https://www.carnegiefoundation.org/engaging-families-empowering-students-a-conversation-with-learning-heroes-ceo-bibb-hubbard/) · [K-12 Dive summary](https://www.k12dive.com/news/10-ways-to-strengthen-family-school-partnerships-academics-social-emotional-learning/803609/) · [NWEA — the grade gap](https://www.eschoolnews.com/educational-leadership/2026/08/03/the-grade-gap-helping-parents-understand-students-academic-progress/) · [Dweck — process praise](https://www.parentsleague.org/blog/growth-mindset-and-future-our-children) · [PMC — growth-mindset message changes parent choices](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10607904/) · [Stanford NSSA — family communication toolkit](https://nssa.stanford.edu/toolkit-tutoring-programs/tutor-program-family-communication-continual-updates) · [LearnSpeed — session logs](https://www.learnspeed.com/writing-session-logs-revisited/) · [Tutorbase — report templates & retention](https://tutorbase.com/blog/progress-report-template-tutoring-templates) · [Tutorbase — parent portals](https://tutorbase.com/blog/parent-portal-for-tutoring) · [SmileTutor — after-lesson reports](https://smiletutor.sg/tutors-how-to-write-an-effective-after-lesson-report/) · Pack docs 08/12/19/21/23/29/31/33.

# Learning Loop, Outcomes & District Reporting — how Natalie learns the child, and how everyone sees it working
**Doc 19 · Moyo platform pack · Date:** Aug 21, 2026
**The three questions this answers:** (1) how the *tutor* gets better at teaching **this** child; (2) how **Moyo the company** learns and sees kids improving; (3) how a **district** knows the investment was a good one — the reporting tooling. One system, three altitudes, one privacy architecture underneath.

---

## 1. How Natalie learns the child — the learner loop
**The line first, because it's the legal and safety foundation:** *the model never learns the child; the system does.* Personalization is **context, not weights** — no provider fine-tuning on learner data ever (doc 07's no-training rule), which is also the *better* design: a knowledge store is inspectable (S27 "what Natalie remembers"), guardian-visible, exportable, and erasable — none of which is true of weights.

**The student model** (edu schema, doc 12), per learner:
- **Mastery state** per skill node on the subject knowledge graph — updated by knowledge-tracing-style estimates from every attempt, with decay so stale mastery gets rechecked.
- **Misconception profile** — tagged, specific ("treats a fraction as two whole numbers"), detected from work and dialogue, addressed by name in tutoring strategy.
- **Review schedule** — spaced-repetition queue per skill; retention is a first-class outcome, not an accident.
- **Scaffolding depth** — how much support this learner needs before productive struggle tips into frustration; hint-ladder calibration per learner.
- **Interest hooks** — soccer, dinosaurs, drawing — for problem contexts that land.
- **Engagement patterns** — session-length tolerance, best-time-of-day, streak health. **Behavioral signals only: no emotion-recognition AI, ever.** US grounds: the FTC's amended COPPA rule treats biometric identifiers as children's personal information requiring verifiable parental consent and strict minimization; state biometric laws (Illinois BIPA-class, with private rights of action) make voice/face-derived inference a litigation surface; emotion-inference science is contested; and no parent hears "the app reads your child's emotions" as a feature. Engagement is inferred from behavior (session length, hint depth, pace) — never from face or voice affect.

**The loop:** every session emits structured learning events (skill attempted, outcome, hint depth, misconception tag, time-on-task) → the event stream (pg-boss → edu store) → mastery/misconception/review updates → **tomorrow's Today's Path is regenerated** → each tutoring turn receives a compiled, pseudonymous **learner brief** (frontier skills, active misconceptions, review-due items, interests, band voice). Natalie feels like she remembers because the system genuinely does — in a store the family controls.

## 2. Family & tutor visibility (already-specced surfaces, now fed)
Guardian progress views + a weekly digest (mastery growth, streaks, "what she worked on," time well spent); tutors and teachers see learners through the `TutorViewOfLearner` projection types (doc 10) — relationship-scoped, never raw transcripts.

## 3. How the company learns — analytics with governance
- **Aggregate, pseudonymized learning analytics:** mastery velocity per skill and content item, hint effectiveness, item difficulty calibration, curriculum bottlenecks (skills where cohorts stall), 30-day retention of mastered skills.
- **The content-improvement loop:** item analytics flag weak explanations/problems → curriculum team revises → the doc-18 eval harness re-verifies the cell. *This* is how the product gets better at teaching in general — aggregate patterns improve curriculum and prompts, never model weights on learner data.
- **Metric hierarchy (binding):** learning outcomes > healthy engagement > raw engagement. The north star is **learning velocity** (mastery gain per active hour) and 30-day retention — never time-in-app, which for children would contradict our own break nudges (doc 12). A kids' company that celebrates screen-time has already lost the plot.
- **Governance:** staff see aggregates only — no individual-learner dashboards (Loop B extended); small-cell suppression (k-anonymity thresholds) on every human-viewed aggregate; the school-data marketing wall (doc 13 §11) applies to analytics without exception.

## 4. The district reporting product — "was this a good investment?"
Khan Academy has published the exact playbook a district trusts, and it's the model to meet and beat: <cite-links>their annual ~350K-student Tier-3 study ties recommended usage (30+ min/week, 18+ hours/year) to ~20% higher-than-expected MAP Growth gains (effect size .36), defines the dosage cohort ("Yearly Very Active Learners"), and layers Tier 1/2 RCTs on top</cite-links>. Our reporting suite makes a district's answer self-serve:
1. **Dosage & utilization dashboard** — seats active vs purchased (the renewal killer districts actually fear is unused licenses), the **Moyo Active Learner threshold** (our YVAL-equivalent, defined from *our* efficacy data once it exists, honestly labeled provisional until then), per-building and per-grade attainment of recommended use.
2. **Growth reporting** — mastery-growth curves on the knowledge graph per class/grade/building; **external anchoring** via assessment partnerships (MAP Growth-class) and state-assessment correlation as the Phase-4 institution play; **AGS gradebook passback** (doc 13 §11) so outcomes surface inside the teacher's existing gradebook, not another portal.
3. **Equity view** — subgroup breakdowns (FRL, ELL, IEP, race/ethnicity from OneRoster demographics) with suppression thresholds; districts are accountable for subgroup outcomes under ESSA, and Khan's MAP Accelerator research showing effectiveness across under-resourced groups is the bar for what districts expect to see.
4. **The board pack** — a scheduled, exportable, superintendent-ready report (PDF/deck): usage, growth vs expectation, equity view, spotlight wins. The person who approved the PO presents to a school board twice a year; give them the artifact.
5. **Teacher tier** — class mastery heatmaps, stuck-skill lists, suggested small-group interventions; the daily-utility layer that makes the district numbers real.
6. **The evidence program (ESSA ladder)** — Tier 4 at launch: a published logic model (mastery learning + spaced retrieval + guided dialogue → outcomes) with the doc-18 eval registry as implementation-fidelity evidence; **Tier 3 annual dosage-vs-growth study** as the standing commitment (the Khan model); Tier 2/1 quasi-experimental and RCT studies with partner districts as the program matures. Districts spending Title funds ask for the tier — we answer with a page, not a shrug.
**Privacy holds at every altitude:** district admins see aggregates and rosters they own — never AI-session transcripts, never another school's data; individual drill-down stops at mastery/usage; small-cell suppression applies to every subgroup view.

## 5. Architecture
Learning-event stream → rollup tables in the one Postgres (doc 12; revisit trigger: dedicated warehouse at volume) → report-generation jobs (pg-boss, scheduled board packs) → district dashboard surfaces (Institution tier, registry-gated) → exports (PDF/CSV) → the doc-13 API exposes **mastery summaries only** for district data teams (learner learning-content stays structurally absent). Experimentation guardrail: pedagogy A/B runs through the eval harness first, an internal review checklist gates any live experiment touching learner content, and safety features are never experimented on.

## 5.5 Where vectors fit — and where they don't (Supabase pgvector, answered directly)
**The rule: embed content, tag children.** The student model core is *structured* data, not vectors — mastery estimates are numbers on skill nodes, misconceptions are typed tags, review schedules are dates, interests are tags. Knowledge tracing is Bayesian updates over attempt rows; you don't embed your way to "how is she doing on fractions," you track it. Structured wins for reasons that are product requirements here: it's explainable (S27 must show what Natalie remembers *in words*), guardian-inspectable, auditable, and erasure-cascade-friendly — none of which is true of a learner represented as a vector.
**Where pgvector (already in the doc-12 edu schema, first-class on Supabase) genuinely earns its place:**
1. **Curriculum/content RAG** — embed the *content library* (explanations, worked examples, items) so the tutor retrieves the snippet that addresses this misconception phrasing; this is the doc-18 grounding layer.
2. **Misconception classification** — embed the child's utterance *transiently* to match it against the canonical misconception taxonomy → store the structured tag as the record; the vector is an input, never the memory.
3. **Transcript recall inside the retention window** — "what did we cover last week" semantic lookup over session transcripts; these embeddings inherit the transcript TTL and erasure cascade exactly (an embedding of learner content *is* learner content).
4. **Item similarity** — "more practice like this one," embedding items, not kids.
**Mechanics, pinned at PR not from memory:** HNSW indexes; one embedding model chosen at the implementing PR with its dimension fixed in the migration; server-side embeddings generated in the gateway (pseudonymous) — while the doc-15/18 *local* retrieval lane (tutor notes, family summaries) uses on-device embeddings and never reaches the server at all. Learner-derived vectors live only in the edu schema behind the no-public-endpoints line (doc 13 §5).

## 6. PRs
- **PR-53 · Student-model core:** knowledge-tracing updates, misconception tags, review queue, learner-brief compiler (feeds every tutor turn).
- **PR-54 · Progress surfaces:** guardian views + weekly digest, tutor projections.
- **PR-55 · Analytics foundation:** event rollups, learning-velocity metrics, suppression/governance layer, content-improvement loop wiring into the eval harness.
- **PR-56 · District reporting suite:** dosage/growth/equity dashboards, board-pack generator, teacher tier, mastery-summary API endpoints.
- **PR-57 · Efficacy program:** logic-model publication (Tier 4), Moyo Active Learner threshold definition, annual-study pipeline design, assessment-partnership ADR.

## 7. Sources (linked)
[Khan Academy efficacy results, Nov 2024](https://blog.khanacademy.org/khan-academy-efficacy-results-november-2024/) · [Khan annual-report efficacy page (YVALs, 30 min/week, effect .36)](https://2023-2024.annualreport.khanacademy.org/efficacy-results) · [Khan studies-by-ESSA-tier library](https://blog.khanacademy.org/multiple-studies-show-khan-academy-drives-learning-gains-evidence-for-our-platforms-effectiveness) · [Khan Districts / Learning Paths — ESSA tier mapping](https://districts.khanacademy.org/learning-paths) · [MAP Accelerator causal-effects study across demographic subgroups (ERIC)](https://eric.ed.gov/?id=ED624104) · [ESSA tiers practical guide](https://cograder.com/content/essa-tiers-of-evidence-explained/) · [ESSA evidence standards overview](https://www.foreduimpact.org/completecourse/unit-3) · [Instructure/LearnPlatform evidence-as-a-service](https://www.instructure.com/resources/product-overviews/ensure-edtech-efficacy-essa-evidence) · Pack docs 07/10/12/13/18.

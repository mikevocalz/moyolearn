# Operations Cloud CRM — the tutoring-business engine, built past the market's bar
**Doc 28 · Moyo platform pack · Date:** Aug 21, 2026
**Scope:** the CRM buildout for the Operations Cloud — object model, pipeline, automations, scheduling assist, health scoring, reporting, and import — grounded in what the tutoring-software market actually ships in 2026, and bounded by the one wall that makes ours different: **business data and learning data never blend.**

---

## 1. What the market teaches (the bar to meet, then beat)
- **[TutorCruncher](https://tutorcruncher.com/blog/tutorcruncher-vs-tutorbird) is the CRM benchmark:** built-in CRM with a fully customizable client pipeline from first contact to booking, an activity feed, and business-level visibility (lesson hours, revenue, attendance, tutor performance) — with particular strength for agencies managing many freelance tutors. That's the floor for Business tier.
- **The gap is real and named:** TutorBird ships only basic status tracking (Active/Trial/Waiting/Lead) and bulk email — its own competitors say it isn't a CRM in any meaningful sense. Noto's ops side (doc 14 research) is similarly thin on pipeline. **A real pipeline + activity timeline is a differentiator in this market, not table stakes.**
- **[Tutorbase](https://tutorbase.com/blog/best-student-management-systems-for-tutoring-centers) sets the scheduling-assist bar:** AI-assisted "Find Slot" turning a ~10-minute booking into under 2 minutes, auto-generated tutor/room/time combinations, guaranteed zero double-bookings. §5 answers it.
- **Table stakes across the field** ([Teach 'n Go's US roundup](https://www.teachngo.com/blog/best-tutoring-business-software-us), [2026 comparisons](https://gitnux.org/best/tutoring-business-management-software/)): session-based tutor payroll calculation, parent portal + mobile (we have this natively — the Learning Cloud *is* the portal), attendance-driven billing, QBO/accounting sync (doc 14 T1), multi-location for centers.
- **Pricing-model intel** ([solopreneur roundup](https://tutorbase.com/blog/best-tutoring-management-software-for-solopreneurs)): flat fees ($20–75/mo), per-lesson (Teachworks), and %-of-invoice (Tutorbase's 1%) all exist; our doc-05 tiers stay as decided — this doc changes nothing about monetization, only notes what buyers compare against.

## 2. Object model — typed, registry-declared, one wall
Objects live in the ops schema (doc 12), typed in `packages/types`, declared in the registry: **Org** (tenant) → **Family** (household) → **GuardianContact** (consent-scoped comms identity) and **LearnerRef** — a *pointer* to the identity docs, and the wall made structural: **CRM rows hold relationship, scheduling, attendance, and billing context — never learning content.** Staff see a learner's *learning* state only through the product's `TutorViewOfLearner` projections (doc 10), never as CRM fields. Then: **Lead/Opportunity** (pipeline object), **Tutor** (staff + session-based payroll basis), **Service/Package**, **Enrollment**, **Session** (scheduling), **Invoice/Payment** (Stripe, docs 05/14), **Activity** (the timeline: notes, calls, emails, SMS — consent-scoped per doc 14 T4, locale-aware per doc 16), **Task**, and **CustomFieldDef** — org-defined fields as *typed configuration* (name + type enum + validation, zod-enforced at the edge), because the flexibility modern CRMs sell comes from configurable views over typed data, not from schemaless JSON we'd pay for at every query and audit.

## 3. The pipeline — trial-centric, because tutoring is
`Inquiry → Contacted → Trial Scheduled → Trial Completed → Proposal → Enrolled → Active → At-Risk → Renewal | Lost(reason)`. The trial/assessment lesson is the conversion hinge in this industry (the market's own statuses say so), so it's a first-class stage with its own automation hooks, not a note. Source attribution flows from doc-14 T6 lead capture; win/loss reasons are enums feeding the funnel report. Views are saved configurations — kanban by stage, table with custom-field columns, timeline per family — over the typed objects.

## 4. Automations — one event catalog, two consumers, one ethics rule
The doc-14 event catalog powers Zapier/Make/n8n *externally* and the internal automation engine *identically*: triggers (`lead.created`, `trial.completed`, `invoice.overdue`, `session.missed`, `enrollment.renewal_due`) → actions (create task, send templated email/SMS through the consent check, move stage, fire webhook), executed as pg-boss jobs with the doc-14 retry discipline. **The ethics rule, stated as design:** automations may act on *business* signals — attendance, billing, scheduling — and **never on learner mastery or struggle data.** "Your child is behind → buy more sessions" is banned by construction: the learning-data wall (doc 13 §11's marketing wall, extended to consumer sales automations) means the automation engine cannot even *reference* mastery fields, because they don't exist in its schema. Progress conversations belong to tutors inside the product, with the family, in the learner's interest — never to a sales trigger.

## 5. Scheduling assist — meet the "Find Slot" bar without the AI theater
v1 is a **constraint solver, not a model**: tutor availability × family preferences × subject match × location/room → ranked slot suggestions with hard conflict detection (zero double-bookings as an invariant, enforced at the Session write path, not just the UI). It's a pure function over availability rows — fast, testable (`bun test`, doc 21), explainable. The doc-17 optimistic-update queue already handles the drag-reschedule flow. Phase 2 adds natural-language sugar ("find us Tuesdays after 4") via the gateway, which parses to the same solver inputs — the solver stays the truth.

## 6. Health & at-risk — business signals only
A per-enrollment health score from missed sessions, reschedule rate, invoice lateness, and portal inactivity feeds the At-Risk stage and task creation. Explicitly excluded: every learning signal (§4's wall). At-risk here means *the relationship* is at risk — the business acts on that with humans, not with mastery-triggered upsells.

## 7. Reporting & import
Funnel conversion, revenue, utilization, and payroll summaries flow through the doc-19 §5 rollup pattern into the doc-27 chart layer (ops dashboards; the revenue line is one of `react-native-graph`'s two scrub surfaces). **Import is the switching lever:** CSV importers for Teachworks/TutorCruncher/TutorBird exports (families, students, schedules, balances) with a mapping UI and dry-run diff — the market's incumbents are described by their own users as dated or fragmented, and a clean Tuesday-afternoon migration is how those users become ours.

## 8. PRs
- **PR-72 · CRM object model + registry declarations** (incl. CustomFieldDef, the LearnerRef wall).
- **PR-73 · Pipeline + views + activity timeline.**
- **PR-74 · Automation engine** (event-catalog consumer, consent-checked actions, the mastery-reference ban as a schema-level test).
- **PR-75 · Scheduling solver + conflict invariant.**
- **PR-76 · Health scoring + at-risk flow.**
- **PR-77 · Importers** (Teachworks/TutorCruncher/TutorBird mappings, dry-run).

## 9. Sources (linked)
[TutorCruncher vs TutorBird](https://tutorcruncher.com/blog/tutorcruncher-vs-tutorbird) · [Teach 'n Go US 2026 roundup](https://www.teachngo.com/blog/best-tutoring-business-software-us) · [Tutorbase: student management systems 2026](https://tutorbase.com/blog/best-student-management-systems-for-tutoring-centers) · [Tutorbase: solopreneur tools 2026](https://tutorbase.com/blog/best-tutoring-management-software-for-solopreneurs) · [Gitnux top-10 2026](https://gitnux.org/best/tutoring-business-management-software/) · [WifiTalents comparison](https://wifitalents.com/best/tutoring-business-management-software/) · [Guideflow 8 best 2026](https://www.guideflow.com/blog/tutoring-software) · [Wise.live tutoring CRMs](https://www.wise.live/blog/top-crms-for-tutoring-businesses/) · Pack docs 05/10/12/13/14/16/17/19/22.

**Full matrix:** the feature/pricing teardown this doc is derived from lives at [`research-crm-market-2026.md`](./research-crm-market-2026.md) — competitor-by-competitor, with the complaint patterns that make the importer the wedge.

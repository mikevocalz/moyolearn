# AI Tutoring Platform — Market Research & Engineering Plan
**Prepared:** August 19, 2026 · **Stack:** Expo/React Native + Next.js (Solito) · Payload CMS · Better Auth · Supabase Postgres
**Skills applied:** user-research, research-synthesis, system-design, architecture (ADR), design-system, design-handoff, accessibility-review, frontend-design

---

## 1. Executive summary

The product spans two markets that no competitor bridges: the **Learning Cloud** (AI + human tutoring for students, families, teachers) and the **Operations Cloud** (Noto-class business software for tutoring companies). The research below supports three strategic conclusions:

1. **Engagement, not model quality, is the open problem.** Khan Academy's own published data shows only ~15% of students with Khanmigo access ever engage with it — 85% never open it — despite 108M+ interactions and measurable learning gains for the students who do use it. Khan is redesigning around proactive, assignment-embedded tutoring for a summer 2026 rollout. Our embodied-tutor + human-hybrid + parent/tutor-visibility design is a direct answer to the same problem, and the human relationship is the piece Khan structurally cannot copy.
2. **Go to market through tutoring businesses (B2B2C), not head-to-head consumer.** Khanmigo at $4/mo is backed by a nonprofit with Microsoft funding — an unwinnable price war. Tutoring businesses already pay $15–$700/mo for ops software with zero learning engine and zero AI, and their client families already pay $50–100+/hr for human tutoring. Selling the ops platform with the AI tutor as *their* differentiator gives us revenue, distribution, and consent flows (business → parent) before we ever run consumer acquisition.
3. **Privacy is now a hard legal floor and a marketable feature.** The amended COPPA Rule's full-compliance deadline (April 22, 2026) has **passed** — we build compliant from day one. Voiceprints/biometrics are now personal information; disclosing children's data for AI training requires **separate** verifiable parental consent; sub-processor accountability and written retention/security programs are mandatory. Penalties run to ~$53K per violation. "Deep personalization without deep profiling" is both our legal posture and our positioning line.

---

## 2. Market research

### 2.1 Market size (directional — analyst spread is wide)

| Market | Size | Forecast | Source note |
|---|---|---|---|
| AI tutors (narrow) | $2.1B (2025) | $17.7B by 2033, 30.5% CAGR | Grand View Research |
| AI tutoring platforms (alt. definition) | $3.47B (2025) | $12.89B by 2034, 16.3% CAGR | Intel Market Research |
| AI in education (broad) | $8.3B (2025) | $57.2B by 2033, 25.9% CAGR | Grand View Research |
| Online tutoring (human) | $10.42B (2024) | $23.73B by 2030 | tutorbase.com stats roundup |
| EdTech overall | ~$404B (2026) | ~$580B by 2030 (HolonIQ) | searchlab.nl roundup |

Two firms disagree by ~65% on the "same" AI-tutor market in the same year — treat all of these as directional. The signal that matters: every segment we touch is growing 16–30%+ CAGR, and AI tutoring platforms already reach ~85M students worldwide. The human-tutoring market is *also* growing — AI is not cannibalizing it yet, which supports the hybrid thesis.

### 2.2 Primary competitor: Khan Academy / Khanmigo

**Pricing & scale.** Consumer Khanmigo: $4/mo or $44/yr, one subscription covers up to 10 linked child accounts. Teachers: free in 44+ countries (Microsoft-funded). Districts: ~$10/student/yr base partnership, ~$15/student/yr Khanmigo add-on, MAP Growth Learning Paths $10–15/student. 380+ district partners (up from 45 in one year). COPPA/FERPA compliance with parent moderation dashboards is already part of their pitch.

**The engagement crisis (our wedge).** From Khan Academy's own blog ("Learning in the Open," April 2026) and subsequent coverage:
- ~15% of students with access engage with Khanmigo; ~85% never do.
- 108M+ total interactions since 2023; ~269K interactions on a typical school weekday.
- Students who did engage ~30 min/week gained roughly 2–3 weeks of extra instruction — the pedagogy works *when used*.
- Response: a redesign shipping to all district partners summer 2026 — Khanmigo becomes proactive and visible during assignments instead of waiting to be asked, adapts to whether the skill is new or review, checks prerequisite mastery, and Khan now tracks "next-item correctness" (can the student solve the *next* problem alone) as the learning-transfer metric.

**What this means for us.**
- Khan has publicly validated our core design bets: proactive tutoring embedded in the work, prerequisite/mastery-aware help, and transfer-based measurement. We should adopt next-item-correctness as a first-class metric from day one.
- Khan's structural gaps remain: no human tutors, no marketplace, no business operations, no embodied presence, no parent-pays-for-hybrid model. The relationship layer (a real tutor who knows the kid, augmented by AI between sessions) is the engagement mechanism a chatbot can't replicate.

### 2.3 Learning-cloud competitive field

| Player | Position | Price | Takeaway |
|---|---|---|---|
| Khanmigo | Socratic all-rounder, ages ~8–18, curriculum-aligned | $4/mo consumer | Price floor; engagement gap is public |
| Synthesis Tutor | K–5 math specialist, conversational, gamified, neurodiverse-friendly | ~$300–350/yr list (promos ~$99; one roundup cites a ~$95/yr family plan — pricing is inconsistent across sources) | Proof families pay premium prices for a *feel*, not just content |
| Duolingo Max | AI layered on habit machine | ~$30/mo ($168/yr) | The engagement/streak benchmark; ceiling for consumer AI-education pricing |
| IXL / practice engines | Adaptive drill | subscription | Weak on tutoring relationship |
| Photomath / Socratic / Brainly | Answer engines (Photomath Plus $9.99/mo; Brainly 350M+ users) | free–$10/mo | The anti-pattern: direct answers. Reviewers consistently steer families away from these as primary tutors — our productive-struggle policy is a differentiator reviewers already reward |
| MagicSchool / SchoolAI | Teacher-tools wedge (MagicSchool: 6M+ educators) | freemium | Teacher-tools-only is crowded; don't lead with it |
| ChatGPT / Gemini / general AI | Free shadow competitor | free–$20/mo | Why guardrailed, parent-visible, curriculum-anchored tutoring must be the pitch to parents |
| Wyzant / Varsity Tutors / Outschool / Brighterly | Human marketplaces (Wyzant: 65K tutors, 300+ subjects) | $40–100+/hr | Marketplace exists; none owns the AI-between-sessions layer or the tutor's business |

### 2.4 Operations-cloud competitive field (the Noto side)

| Player | Model | Price | Gap we exploit |
|---|---|---|---|
| TutorBird | Solo tutors / tiny teams | from ~$14.95–16.95/mo (+~$4.95/added tutor) | No native mobile app, thin client portal — cited as the reason growing centers leave |
| Teachworks | Small–mid centers, modular (60+ add-ons), multi-location | base + per-lesson fees | Per-lesson pricing scales cost with success; no learning engine |
| TutorCruncher | Agencies at scale, API, ISO 27001 | $30–240/mo + transaction fees | Unpredictable cost is the recurring complaint |
| Teach 'n Go | Flat-fee all-in-one | ~$75–79/mo up to 100 students | Marketed explicitly against per-transaction resentment — confirms flat pricing wins hearts |
| Tutorbase | High-complexity centers (50–10,000+ lessons/wk), AI slot-finding, multi-brand | 1% of invoiced revenue | Their "Find Slot" AI validates our Find-a-Time engine as a selling point |
| Oases Online | Storefront + ops | up to ~$699/mo | Price ceiling reference |
| Noto | Design/UX reference for lesson-business ops | — | Our direct UX benchmark |

**The seam:** every ops platform stops at scheduling/billing/CRM — none has a learning graph, mastery model, or AI tutor. Every AI tutor stops at the student — none runs the tutor's business. The two-cloud product is genuinely unoccupied space; the closest composite (Varsity Tutors: marketplace + some AI) still has no B2B ops layer for independent tutoring companies.

### 2.5 Regulatory landscape (design constraints, not afterthoughts)

- **COPPA amendments:** finalized Jan 16, 2025; effective June 23, 2025; **full-compliance deadline April 22, 2026 — already passed.** Civil penalties up to ~$53,088 per violation. Key changes we must engineer for: (a) biometric identifiers — including voiceprints — are now personal information; (b) **separate** verifiable parental consent before disclosing children's PI to third parties for targeted advertising **or AI training**; (c) written data-retention policy with limits ("no longer than reasonably necessary"); (d) written children's-data security program; (e) sub-processor vetting and accountability for every SDK/service touching child data. The FTC deliberately deferred school-consent edtech provisions pending FERPA rulemaking — the school-official consent path stays governed by existing FTC guidance + FERPA, and a Feb 2026 FTC policy statement created a narrow safe harbor for age-verification-only data collection.
- **Enforcement is live:** Disney $10M (2025, third-party collection from children), Edmodo (2023, edtech ads-without-consent), NGL (2024).
- **Active litigation as cautionary tale:** *M.C. v. Curriculum Associates* (i-Ready, filed Dec 2025) — allegations center on behavioral/performance profiling and third-party transmission. Whatever the outcome, the lesson is architectural: pedagogical signals (mastery, misconceptions, latency) must never be joinable into an identified behavioral profile that leaves our boundary.
- **FERPA** (school-official exception governs district deals), **state student-privacy laws** (SOPIPA-class), and district procurement checklists (NDPA) all reward the three-store separation designed in §5.

### 2.6 Pricing strategy (benchmarked)

| Tier | Price | Benchmark logic |
|---|---|---|
| Ops: Solo tutor | $19/mo flat | Between TutorBird ($14.95) and Teach 'n Go; includes real mobile app (TutorBird's known gap) |
| Ops: Studio (≤15 staff) | $99/mo flat | Undercuts Teachworks/TutorCruncher effective cost; **no per-lesson or revenue fees on the business's own clients** — the #1 stated resentment in this market |
| Ops: Scale | $299/mo flat + volume bands | Below Oases ceiling |
| Marketplace take rate | 10–15% **only on clients we source** | Never tax their existing book — the trust-killer to avoid |
| Family: AI tutor | $15/mo or $144/yr (multi-child included) | Premium to Khanmigo's $4 justified by embodiment, reports, hybrid path; below Duolingo Max's $30 ceiling; Synthesis proves $150–300/yr family willingness |
| Hybrid bundles | human sessions + AI included | Sold by the business through our platform; AI raises perceived value of their $50–100/hr sessions |
| District/institution | $12–18/student/yr | Brackets Khan's $10–15; defer until Phase 4 |

### 2.7 Mistakes we are explicitly not repeating

1. **Passive chat window** (Khanmigo pre-redesign): the tutor is present in the work, proactive on mastery signals — never a side chatbot waiting to be summoned.
2. **Answer engine** (Photomath/Socratic pattern): productive-struggle policy ladder (probe → nudge → hint → scaffold → worked example) is enforced in the pedagogy engine, not prompt-suggested.
3. **Behavioral profiling exposure** (i-Ready allegations): three-store separation, pseudonymous inference, raw-media discard, no ad/analytics SDKs in child surfaces.
4. **Per-transaction pricing on the customer's own revenue** (TutorCruncher/Tutorbase complaint): flat ops pricing; take rate only on marketplace-sourced demand.
5. **No real mobile app** (TutorBird gap): mobile-first ops surfaces are a headline feature, not an afterthought.
6. **AGPL contamination:** Qali is AGPL-3.0 — architecture/UX reference only; zero code copying into this proprietary codebase. PanelUI's copy-source model is the sanctioned path for vendored UI code (verify each component's license header at copy time).
7. **Betting the stack on pre-stable software** (Payload 4 — see ADR-002).

### 2.8 Primary research plan (2-week sprint, user-research skill format)

**Objectives:** validate B2B2C wedge, calendar/Find-a-Time workflow, hybrid willingness-to-pay, parent trust requirements.
**Methods & participants:** semi-structured interviews — 6–8 tutoring-business owners/managers, 6–8 independent tutors, 6–8 paying parents (JTBD framing); 5-user usability tests on the resource-calendar and Find-a-Time prototypes; Van Westendorp pricing survey (n≥100 parents) for the family tier.
**Interview spine (owner segment):** current tools and their monthly cost → walk me through yesterday's scheduling conflicts → how a new client goes from inquiry to first invoice → what you'd pay for AI session-prep per tutor → reaction to hybrid-bundle concept.
**Deliverables (research-synthesis format):** themes with prevalence counts, insight→opportunity matrix (impact/effort), segment cards, prioritized recommendations, open questions.
**Exit criteria for Phase 1 commitment:** ≥5 of 8 owners state intent to switch at target price; Find-a-Time prototype completes in <60s for ≥4 of 5 test users.

---
## 3. Architecture decisions (ADR summaries)

### ADR-001 — Primary data platform: Supabase Postgres (Neon as reversible fallback)
**Status:** Proposed · **Context:** Payload's Postgres adapter (Drizzle-based) runs on either. The platform needs four infrastructure capabilities: relational store, realtime (Tutor Room presence, messaging, live ops dashboards), file/media storage (lesson assets, worksheets, recordings), and vector search (learning-graph embeddings, RAG over curriculum).

| Dimension | Supabase | Neon |
|---|---|---|
| Postgres | Managed, RLS-first | Serverless, scale-to-zero |
| Realtime | Built in (channels, presence, broadcast, private-channel auth) | None — assemble separately |
| Storage | Built in, CDN, signed URLs | None — pair R2/S3 |
| Vector | pgvector supported | pgvector supported |
| Branching/preview DX | Branching available, weaker DX | Best-in-class branching |
| Vendor surface | 4 needs, 1 vendor | 1 need, 3 vendors |

**Decision:** Supabase. One platform covers all four needs. **Portability guardrails:** schema owned by Payload/Drizzle migrations (never Supabase Studio edits); no `supabase-js` data access in application code (see ADR-003 access pattern); storage behind our own signed-URL service module. Under those rules, migrating Postgres to Neon later is a connection-string + storage/realtime substitution, not a rewrite.

### ADR-002 — Payload version: 3.x pinned now; 4.0 at RC, not before
**Status:** Accepted · **Context (verified Aug 2026):** Payload 4.0 is **not stable**. The official June 2026 post targets "a 4.0 beta within the next quarter" with breaking changes expected between beta and stable; the team has explicitly warned against building production projects on the current main branch (described as pre-alpha in their own preview material). Payload 3.x is the maintained stable line (v3.85.x as of June 2026). Headline 4.0 changes are admin UI redesign (post-Figma-acquisition design system), TanStack adoption, native hierarchies, DAM, and MCP/AI workflow support — i.e., mostly the admin layer, not the collections/access-control model.
**Decision:** Build on **Payload 3.x, exact-version pinned**, generated types committed. Isolate every Payload touchpoint behind a `domain-services` layer (repositories calling the Local API) so the 4.0 migration is a dependency bump + admin re-theme, not an application rewrite. Re-evaluate at 4.0-RC. This satisfies the "I know it's in beta" intent without betting the company on pre-beta software.

### ADR-003 — Identity: Better Auth 1.7.x (owns identity; Supabase Auth unused)
**Status:** Accepted · **Context (verified Aug 2026):** Better Auth is mature — 1.4 (Nov 2025) through 1.7 (mid-2026) shipped organization-plugin hardening, per-seat Stripe billing for organizations, secret rotation, Expo cookie fixes, SSO/SAML improvements, and SCIM provisioning (decoupled from the org plugin in 1.7). The organization plugin provides orgs, teams, invitations, dynamic access control, and hooks.
**Mapping:** organization = tutoring company / school / district; teams = locations / departments; member roles = owner, manager, scheduler, tutor, teacher, finance; a user holds multiple memberships → the context switcher is a first-class auth concept, not UI sugar. Stripe plugin's per-seat org billing matches the ops tiers directly. SSO/SAML + SCIM are the Phase-4 institution unlock, already in the library.
**Child accounts (COPPA-safe model):** children are **learner profiles owned by a guardian account**, not independent logins for under-13s. Direct child sign-in (13+, or school-official flows) issues scoped sessions tied to the guardian/org consent record. Parental identity verification uses amended-rule-sanctioned methods (e.g., knowledge-based authentication). Consent records — including the now-mandatory **separate** consent for any third-party AI-training disclosure (which we default to *never requesting* because we don't do it) — are first-class rows, not checkbox booleans.
**Critical integration nuance (this is the mistake to avoid):** Better Auth issues its own sessions; Supabase RLS's `auth.uid()` expects Supabase-minted JWTs. Therefore **no client talks to Postgres directly.** All domain reads/writes go through the server layer (Next.js route handlers / server actions → Payload Local API), where Better Auth session → membership → Payload access control executes. Supabase Realtime private channels are authorized with short-lived tokens minted server-side after the same check; Storage access is via short-lived signed URLs only. RLS remains enabled as defense-in-depth with a deny-all posture for the anon key — an exposed anon key must yield nothing.

### ADR-004 — Payments: Stripe Billing + Connect + Tax
Subscriptions (family + ops seats via Better Auth Stripe plugin), Connect for tutor/business payouts and marketplace splits, Tax for cross-state sales tax. Consumer subscriptions on iOS follow current App Store external-purchase policy at implementation time — verify the then-current rules before building the purchase flow; do not hardcode a policy assumption.

### ADR-005 — AI inference boundary (now legally load-bearing)
Model-agnostic router (frontier reasoning / fast conversational / vision / speech tiers) behind one `inference` service. Hard invariants, each mapped to the amended COPPA rule:
1. **Pseudonymous payloads only** — learner session handle, grade band, concept, mastery, attempt, misconception; never name/DOB/school/contact.
2. **No training on child data** — provider contracts must include no-training + zero/limited-retention terms; any future exception would trigger the rule's separate-consent requirement, so the default is architectural, not policy prose.
3. **Voice = transcribe → derive → discard.** Voiceprints are now COPPA personal information; raw child audio is never persisted beyond processing unless a feature gains explicit separate consent. Same pattern for camera/XR frames: derive the educational observation, discard the frame.
4. **Sub-processor registry** — every model provider, SDK, and service touching child data is enumerated with purpose + retention, satisfying the rule's third-party accountability and district NDPA checklists.

### ADR-006 — Three-store data separation
- **Educational store** (Payload collections): mastery, misconceptions, assignments, session outcomes — keyed to learner profile.
- **Operational analytics**: crash/perf/feature health — **no child identifiers, no general-purpose analytics SDKs in child surfaces at all.**
- **Identity store**: Better Auth tables + consent records + audit log.
Raw AI conversation text/audio is ephemeral processing material: extract the pedagogical result ("understands common denominators; needs practice: fraction addition") into the educational store; expire the raw transcript on a short, documented retention schedule (parent-reviewable, per Khanmigo's parent-moderation precedent — we match that capability with retention limits they don't advertise).

---

## 4. Monorepo & app structure

pnpm + Turborepo. Solito shares screen code between Expo (native) and Next.js (web) — the ops cloud is desktop-heavy, the learner cloud is mobile-heavy, one screen codebase serves both.

```
.
├── apps/
│   ├── expo/                    # Expo SDK (dev client), Expo Router — iOS/Android phone+tablet
│   │   └── app/                 # route groups per shell (see §5)
│   └── web/                     # Next.js App Router — Solito screens + Payload admin mounted at /admin
│       ├── app/(shells)/        # same shell structure as native
│       ├── app/(payload)/       # Payload 3.x admin + REST/GraphQL (server-only)
│       └── payload.config.ts
├── packages/
│   ├── ui/                      # design system: tokens + PanelUI-vendored source + our primitives
│   ├── app/                     # shared feature screens (Solito pattern, navigation-agnostic)
│   ├── domain/                  # zod schemas, types, role/permission maps, event contracts
│   ├── domain-services/         # server-only: repositories over Payload Local API (ADR-002 isolation)
│   ├── api/                     # route/server-action contracts + typed client (no direct DB from clients)
│   ├── scheduling/              # calendar engine: pure TS — events/resources/participants, projections,
│   │                            #   conflict + travel-aware availability, Find-a-Time solver
│   ├── learning/                # student model: mastery estimation, misconception taxonomy,
│   │                            #   productive-struggle policy ladder, next-item-correctness metrics
│   ├── inference/               # model router + privacy boundary (ADR-005)
│   ├── auth/                    # Better Auth server config + Expo/web clients + role-context helpers
│   ├── layout/                  # AdaptiveSplitLayout (Primary/Content/Detail contract)
│   └── config/                  # tsconfig, eslint, tailwind presets
└── prompts/
    └── ROSTER.md                # canonical engineer roster — embedded in every agent prompt (§9)
```

State: Zustand for all shared/app state (per standing standard — no `useState` for business state); TanStack Query for server cache; Payload is the single source of truth for domain data.

**AdaptiveSplitLayout contract** (from the prior design pass, now formalized as a package): every information-dense screen expresses `Primary | Content | Detail`. Native iPad resolves to Expo Router SplitView where available (treated strictly as one backend of the abstraction — it is alpha, iOS-only, root-level only, so no screen imports it directly); Android tablet and web resolve to our own three-pane implementation; phones resolve to a navigation progression (Content → Detail push), never miniaturized columns; XR resolves to spatial panel projection later. Role × breakpoint chooses which panes exist at all (scheduler gets three, student gets one or two — three-column *capable* ≠ three-column *mandatory*).

---
## 5. Navigation: shells, tab bars, drawers

One platform, five purpose-built shells. Role resolution happens at the root layout: Better Auth session → active membership → shell. The **context switcher** (multi-role users: parent-who-tutors, owner-who-teaches) lives in the drawer header on mobile and the sidebar rail header on desktop; switching contexts swaps the entire shell, never merges menus.

### 5.1 Tab bars (phone)

| Shell | Tabs (left → right) | Notes |
|---|---|---|
| **Student** | Home · Learn · **Tutor** · Plan · Me | Tutor is the center signature destination — raised 64pt circular target, tutor-presence avatar as its icon; the only tab with a custom renderer |
| **Family (parent)** | Home · Children · Calendar · Messages · Account | Single-child accounts relabel Children → Progress |
| **Educator — tutor mode** | Today · Calendar · Students · **Tutor Room** · Messages | Today is a session run-list, not a dashboard |
| **Educator — teacher mode** | Home · Classes · Assign · Calendar · AI Tools | Same app binary; mode from membership role |
| **Operations (mobile)** | Today · Schedule · Clients · Inbox · More | Desktop replaces tabs with a grouped sidebar rail |

Scheduler/receptionist role within Operations boots to Schedule with the global **Find a Time** command (⌘K / persistent button) instead of Today. Institution shell is web-first (no phone tab bar in v1).

### 5.2 Drawers (secondary navigation + context)

Common header on every drawer: avatar → active context switcher → notifications.

| Shell | Drawer contents |
|---|---|
| Student | My subjects · Achievements · Settings · Help — deliberately thin; a child's app is tab-first |
| Family | Billing & plans · Payment methods · Permissions & AI controls · Progress reports · Find a tutor · Forms & approvals · Family settings |
| Tutor | Lesson library · Availability · Earnings & payouts · Resources · Credentials & profile · Settings |
| Teacher | Students · Curriculum · Analytics · Office hours · Settings |
| Operations (rail groups) | **Overview** · Operations (Schedule, Students, Families, Tutors, Classes, Enrollments) · Growth (CRM, Forms, Campaigns) · Communication (Inbox, Email, Notifications) · Finance (Invoices, Payments, Plans, Payroll) · Learning (Programs, Curriculum, Outcomes) · Insights (Analytics, Reports) · Settings |
| Institution | Overview · Schools · Academics · People · Calendar · AI policies · Reports · Administration |

### 5.3 Screen inventory (v1 scope; Expo Router route groups)

```
app/
├── (auth)/            sign-in · sign-up · verify · forgot · onboarding/(role-detect,
│                      guardian-consent, child-profiles, org-create-or-join, plan-select)
├── (student)/
│   ├── (tabs)/        home · learn/(subjects, unit/[id], skill/[id]) · tutor · plan · me
│   ├── tutor/         session/[id] (chat|voice|scene modes) · session-summary/[id]
│   ├── assignment/[id]  practice/[skillId]  assessment/[id]
├── (family)/
│   ├── (tabs)/        home · children/(index, child/[id]) · calendar · messages/[threadId] · account
│   ├── child/[id]/    progress · ai-activity (conversation review) · permissions · schedule
│   ├── tutors/        search · tutor/[id] · book/[tutorId] (Find-a-Time flow) · packages
│   ├── billing/       invoices · invoice/[id] · payment-methods · plans
│   └── approvals/[id] (session changes, forms, AI permissions)
├── (tutor)/
│   ├── (tabs)/        today · calendar · students/(index, student/[id]/(profile, prep,
│   │                  notes, history)) · tutor-room/[sessionId] · messages
│   ├── availability   lessons/(library, lesson/[id])  earnings/(index, payout/[id])  profile
├── (teacher)/
│   ├── (tabs)/        home · classes/(index, class/[id]/(roster, mastery)) ·
│   │                  assign/(new, assignment/[id]/results) · calendar · ai-tools
├── (ops)/
│   ├── (tabs)/        today · schedule (resource calendar + inspector) · clients/(families,
│   │                  family/[id], students, student/[id]) · inbox/[threadId] · more
│   ├── find-time      tutors/(index, tutor/[id]/(profile, schedule, pay)) · classes ·
│   │                  enrollments · crm/(pipeline, lead/[id]) · forms · campaigns
│   ├── finance/       invoices · payments · plans · payroll/(runs, run/[id])
│   └── analytics · reports · settings/(org, locations, rooms, services, policies, team)
└── (institution)/     [web-first, Phase 4] overview · schools/[id] · academics · people ·
                       calendar · ai-policies · reports · admin
```

~85 routes in v1 scope. Every `[id]` detail surface renders inside AdaptiveSplitLayout.Detail on tablet/desktop (inspector pattern — selection never navigates away on large screens) and as a pushed route on phones.

---

## 6. Reusable component library

Foundation: **PanelUI vendored via its CLI** (copy-source model — components live in `packages/ui`, fully ownable/customizable, license header verified per component at copy time) on Tailwind v4/NativeWind + Reanimated. Our domain components compose those primitives. Per the design-system skill, each ships with documented variants, states (default/hover/active/disabled/loading/error/empty), and a11y notes; the table below is the build inventory.

| Group | Components | Notes |
|---|---|---|
| Layout | `AdaptiveSplitLayout` (+ `.Primary/.Content/.Detail`) · `RoleShell` · `ContextSwitcher` · `TabBar` (center-action variant) · `RailNav` · `DrawerScaffold` | The layout grammar of the entire product |
| Calendar (the crown jewels) | `CalendarView` (agenda/day/week/month/resource projections) · `TimeGrid` · `ResourceLane` · `EventCard` (session/class/assignment/assessment/availability variants) · `SessionInspector` · `AvailabilityEditor` · `FindTimeCommand` · `ConflictBadge` · `TravelGapIndicator` · `MiniMonth` | One engine (`packages/scheduling`), seven role projections; learner/family interactions borrow the swipeable-agenda + haptics pattern from the RN habit-calendar reference, ops borrows Noto's lane density |
| Learning | `MasteryRing` · `MasteryBar` · `SkillNode` · `StreakChip` · `LessonCard` · `PracticeCard` · `AssignmentRow` · `ProgressReportCard` · `MisconceptionTag` · `NeedsAttentionList` | Mastery visuals shared student↔parent↔tutor so the numbers always look the same |
| Tutor Room | `TutorStage` (2D avatar v1; mount point contracts sized for 3D/XR later) · `LearningCanvas` (whiteboard/equation/graph) · `SessionToolbar` · `TranscriptPane` · `StruggleMeter` (policy-ladder state, tutor-visible) · `SessionPrepCard` (AI prep for humans) | `SessionPrepCard` is the first AI feature businesses see |
| Ops & data | `StatCard` · `DataTable` (sortable/selectable/virtualized) · `PipelineBoard` · `ClientCard` · `InvoiceCard` · `PayoutRow` · `EnrollmentStepper` · `UtilizationHeatmap` | Dense-theme only |
| Messaging | `ThreadList` · `MessageBubble` · `Composer` · `AnnouncementBanner` | Realtime via authorized private channels (ADR-003) |
| Commerce | `PlanPicker` · `CheckoutSheet` · `PaymentMethodRow` · `PriceTag` | Stripe-backed |
| System | `ActionNeededList` (parent home's aggregator) · `PermissionGate` · `ConsentFlow` · `EmptyState` · `ErrorState` · `SkeletonSet` · `Toast` · `ConfirmSheet` · `OmniSearch` | `ConsentFlow` renders from consent-record schema — COPPA flows are data, not one-off screens |

### 6.1 Design direction (frontend-design skill — direction only; full pass is its own workstream)

Two themes, one primitive set:
- **Learner theme** — grounded in the subject's world (graph paper, chalk, geometric manipulatives, growth), warm and high-energy: large type scale, generous targets, motion with restraint. **Signature element:** the tutor-presence avatar — one continuous identity from tab-bar icon → session stage → (later) AR/XR embodiment. Spend the boldness there; keep everything around it quiet.
- **Ops theme** — dense, quiet, data-first: tight type scale, hairline structure, color reserved for status semantics.
- Explicitly rejected: the stock AI-generated look (warm-cream + high-contrast serif + terracotta accent) and its dark/acid-green sibling — the product must not read as templated, per the standing "doesn't look LLM-authored" standard.
- **Accessibility floor (WCAG 2.2 AA, non-negotiable):** contrast ≥4.5:1 text / 3:1 UI, touch targets ≥44pt, full keyboard paths on web/desktop, visible focus, dynamic type without layout breakage, reduced-motion honored (tutor avatar included), screen-reader labels on every calendar cell and mastery visual. Audit gate before each release train per the accessibility-review checklist.

---

## 7. Backend: collections, tenancy, security

### 7.1 Payload collections (initial 24)

`organizations` · `memberships` (user×org×role×teams) · `learners` (guardian-owned profiles) · `guardianships` · `consents` (type, scope, method, evidence, revocation) · `subjects` · `skills` (graph edges: prerequisites) · `masteryStates` (learner×skill: p(mastery), confidence, misconception refs, decay) · `misconceptions` (taxonomy) · `sessions` (human/AI/hybrid; the calendar engine's core event) · `availabilities` · `locations` · `rooms` · `services` (offerings: subject×duration×mode×price) · `enrollments` · `classes` · `assignments` · `assessments` · `tutorProfiles` (credentials, subjects, radius, languages) · `leads` (CRM) · `invoices` · `payouts` · `messagesThreads` · `auditEvents` (append-only)

Every row carries `org` (or `family` scope for consumer records). Access control is defined once in Payload per collection (role × membership × ownership predicates) — the single enforcement point for web, native, and admin.

### 7.2 Security checklist (build-time gates, not launch-week retrofits)

- Deny-by-default: anon key yields zero rows (RLS defense-in-depth behind the server-only access rule from ADR-003); service-role key never leaves server env.
- Tenancy tests: cross-org read/write attempts are CI test cases per collection.
- Signed URLs only for media; uploads virus-scanned; child-generated media segregated bucket with its own retention schedule.
- Webhook signature verification (Stripe, providers); idempotency keys on all payment mutations.
- Rate limiting on auth + inference routes; device/session management surfaced to guardians.
- Append-only `auditEvents` for: consent changes, AI permission changes, data exports, deletions, role grants.
- Deletion pipeline: guardian-initiated erasure cascades educational store + storage + provider-side deletion requests, with completion receipts (amended-rule retention/deletion posture; also the NDPA district checklist).
- Secrets rotation runbook (Better Auth 1.6+ multi-secret support makes session-secret rotation zero-downtime).
- Pre-launch: external pen test + COPPA counsel review of consent flows; SOC 2 Type I on the Phase-3 track.

---

## 8. Phased roadmap

**Phase 0 — Foundations (4–6 wks):** monorepo, CI (`tsc --noEmit` gate, lint, tenancy tests), Better Auth (orgs, memberships, guardian/learner model, consent schema), Payload 3.x collections v1, design tokens + first 12 primitives, AdaptiveSplitLayout on all three targets, Stripe skeleton.
**Phase 1 — Ops + Tutor wedge (8–10 wks):** calendar engine + resource calendar + inspector, Find-a-Time v1 (constraint solver; travel-aware buffers), clients/CRM-lite, invoicing + payouts, tutor Today/prep surfaces, messaging. First AI feature: **SessionPrepCard** for human tutors — adult-facing (soft COPPA surface), immediately differentiating vs every ops competitor. Pilot with 5–10 tutoring businesses from the research sprint.
**Phase 2 — Learner + Family (8–10 wks):** student shell (Home/Learn/Tutor/Plan/Me), AI tutor sessions v1 (chat+voice, productive-struggle ladder, next-item-correctness telemetry), assignments/practice, parent oversight (Action Needed, AI activity review, permissions), hybrid loop (AI works between human sessions; prep reflects it). Distribution: the Phase-1 businesses' existing families — consent flows ride the business relationship.
**Phase 3 — Marketplace + consumer (10–12 wks):** tutor discovery/booking with the full matching model (subject/grade/credentials/mode/radius/language/availability/price/rating/history), take-rate billing on sourced clients only, direct family subscriptions, group classes.
**Phase 4 — Institution + XR:** teacher shell hardening, school/district hierarchy, SSO/SAML + SCIM (already in Better Auth), admin goals/reporting; Tutor Room presentation modes graduate from 2D avatar → 3D scene → tablet AR → Quest MR on the contracts reserved in `TutorStage` since Phase 0. XR ships when the learning loop has retention data, not before.

**North-star metrics from day one:** weekly engaged-learner rate (the anti-15% number), next-item correctness, hybrid attach rate, ops weekly-active-scheduler rate, business logo retention.

---

## 9. Agent prompt header (standing rule — embed in every engineering prompt)

Per the standing roster rule (`prompts/ROSTER.md` is canonical; "senior" banned, "principal" alone below the bar), prompts for this codebase frame the agent at creator/spec-author tier:

> You are operating at the level of the named creator/spec-author tier for each seam you touch: Payload core maintainer (James Mikrut-tier) for collections/access/Local API; Better Auth author-tier for identity, organizations, and session architecture; Supabase/Postgres architect-tier for RLS, realtime authorization, and tenancy; Expo Router creator-tier for navigation and SplitView backends; Marc Rousavy (Nitro/JSI) for any native module seam; TypeScript language-architect tier for types and public APIs; Stripe-API-design tier for billing, Connect, and webhook contracts; Apple visionOS HIG author-tier for spatial/adaptive design decisions; FTC/COPPA privacy-counsel tier for any surface touching child data; intelligent-tutoring-systems researcher tier (knowledge tracing, Bloom two-sigma literature) for the pedagogy engine.

Non-negotiable gates (verbatim from the standing standard): no invented APIs — every seam cited against installed source file and symbol; `tsc --noEmit` as a hard gate; exact-pinned dependencies verified against the registry at prompt time; Zustand only for shared/app state; stop and ask rather than fabricate uncertain API shapes; no slop — no placeholders/stubs, hallucinated APIs or package names, invented data, narrating comments, speculative abstractions, assertion-free tests, or unverified "should work" claims. The artifact must not read as vibe-coded to a skeptical human reviewer.

---

## 10. Source register (key claims)

- Khanmigo ~15% engagement, 108M interactions, 269K/weekday, summer-2026 redesign, next-item correctness: Khan Academy blog "Learning in the Open" (blog.khanacademy.org, Apr 2026); EdTech Innovation Hub (May 2026).
- Khanmigo/Khan pricing ($4/mo, $44/yr, 10 children; free teachers via Microsoft; ~$10–15/student district): edisonos.com, checkthat.ai, nibble-app.com, toolcurrent.com (2026).
- Market sizing: Grand View Research (AI tutors; AI in education), Intel Market Research, tutorbase.com statistics, searchlab.nl (2026).
- Ops competitor pricing: teachngo.com comparisons, wise.live, tutorbase.com, guideflow.com, pinlearn.com (2025–2026).
- Payload 4.0 status (beta targeted "next quarter", pre-alpha main, 3.x stable v3.85.x, Figma acquisition): payloadcms.com 4.0 post (Jun 2026), buildwithmatija.com tracker, beease.fr, GitHub releases.
- Better Auth 1.4→1.7 (org plugin, Stripe per-seat, SCIM decoupling, Expo fixes): better-auth.com blog/changelog, GitHub releases (2025–2026).
- COPPA amendments (effective Jun 23 2025; full compliance Apr 22 2026 — passed; biometrics incl. voiceprints as PI; separate consent for ads/AI-training disclosure; retention/security programs; ~$53K/violation; edtech provisions deferred to FERPA; Feb 2026 age-verification statement): FTC press release (Jan 2025), Latham & Watkins, Davis Wright Tremaine, promise.legal, gopelorus.com, a4l.org/SDPC.
- Enforcement: Disney $10M (2025), Edmodo (2023), NGL (2024): gopelorus.com summary.
- *M.C. v. Curriculum Associates* (filed Dec 22, 2025; active litigation, allegations denied): verified in prior research pass.
- Expo SplitView constraints (alpha, iOS-only, root-level, no nesting), PanelUI copy-source model, Qali AGPL-3.0, RN habit-calendar interaction reference: verified in prior research pass against docs.expo.dev and the respective repos.

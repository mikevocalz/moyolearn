# Moyo Learn — Product Requirements Document
**Doc 33 · Moyo platform pack · Version 1.0 · Aug 27, 2026**
**Owner:** Mike W. Allen (founder/eng) · **Status:** Draft for build — binding where marked
**Repo:** `github.com/mikevocalz/moyolearn` (private) · **Design of record:** pack docs 00–32 (Appendix A)

This PRD stands alone: a reader with no prior context should be able to understand what Moyo Learn is, who it serves, what ships, what deliberately doesn't, and how success is judged. Deep technical detail lives in the pack and is referenced, not duplicated.

---

## 1 · One-liner and vision

**One-liner:** *Point your camera at the problem and get a tutor that refuses to give you the answer.*

**Vision:** Moyo Learn is an AI tutoring platform for K–12 with a human spine. Learners get a patient, embodied tutor — **Natalie** — who speaks at their grade level, coaches instead of solving, and is safe by construction. Guardians get real visibility instead of a black box. Tutoring businesses get an operations cloud (CRM, scheduling, payouts) so human tutors and the AI tutor compound rather than compete. The name is the mission: *Moyo* is Swahili for heart — **"Learn it by heart."**

Two clouds, one platform:
- **Learning Cloud** — learner, guardian, tutor, and educator experiences: homework coaching, tutor chat with voice and a 3D embodiment, mastery tracking, guardian controls, safety and incident systems.
- **Operations Cloud** — the business side for tutoring companies: CRM, scheduling, payments and tutor payouts, org administration. (Noto-class capability; separate PRD-level detail in docs 22–23, summarized in §7.13.)

## 2 · The problem

**P1 — AI homework tools do the thinking for the child.** The dominant camera-solvers (Photomath, Gauth, Question.AI) return worked solutions. The general assistants (ChatGPT, Gemini) answer whatever is asked. Testing across tools found that **AI that guides produced 3× better independent problem-solving than AI that hands over answers — a 23% improvement in independent math over 8 weeks with a Socratic tutor versus 8% with ChatGPT.** The market's default is optimized for homework *completion*, which is the opposite of learning.

**P2 — AI talks to children like graduate students.** Across major models, plain prompts produce output **at or above 10th-grade reading level**; one study measured Claude's lesson-plan output at **FKGL ≈ 19.9** — post-graduate. Prompting alone drifts. A 1st grader cannot use a tutor that speaks like this, and none of the camera-solvers even attempt band-calibrated speech. (Full evidence and the enforcement architecture: doc 31.)

**P3 — Safety is retrofitted, not structural.** Meta paused teen AI-character access in Jan 2026 after a WSJ investigation surfaced sexual conversations with minors; OpenAI's parental controls are, by their own history, retrofits under pressure. Regulators have noticed: the **FTC's 6(b) inquiry** into companion chatbots and minors, **California SB 243** (companion-chatbot protections for known minors, effective Jan 1, 2026), the **amended COPPA rule effective Apr 22, 2026**, and a stack of pending federal bills (SAFE BOTs, GUARD, CHAT, AWARE). Purpose-built child safety is now both an ethical floor and a regulatory moat.

**P4 — Human tutoring works but is fragmented and expensive.** High-dosage tutoring is among the most effective educational interventions ever measured (the canonical meta-analysis: Nickow, Oreopoulos & Quan, [NBER w27476](https://www.nber.org/papers/w27476), ~0.37 SD pooled effect; Bloom's classic "2 Sigma Problem" set the aspiration). But 1:1 human tutoring is costly, and the businesses that deliver it run on fragmented software. The private tutoring market — **$151.3B (2025) growing to ~$266B by 2032** — is the human side Moyo's Operations Cloud serves.

## 3 · Market

- **AI tutors:** ~$2.1B (2025) → $2.7B (2026) → **$17.7B by 2033 at 30.5% CAGR** (Grand View); an adjacent sizing puts AI tutoring platforms at $3.47B (2025) → $12.89B (2034). North America holds ~35% share; **K–12 is the largest end-use segment.**
- **Adoption is real and accelerating:** K–12 teachers using generative AI doubled from 25% to 53% year-over-year; Khanmigo grew from 45 to 380+ district partners in one school year.
- **The wedge is underpriced:** EdTech VC hit a decade low (~$2.4B in 2024) while generative AI overall drew $51.4B — the category is undervalued relative to its growth, which favors builders who can ship without raising big.
- **Price anchors:** Khanmigo at ~$4/mo for parents (free for teachers as a distribution wedge); Photomath free–$9.99/mo; Synthesis Tutor at $99–149/mo proves a premium ceiling exists for parents who believe in the product.

Sources: [Grand View](https://www.grandviewresearch.com/industry-analysis/ai-tutors-market-report) · [IntelMarket](https://www.intelmarketresearch.com/ai-tutoring-platform-market-46896) · [Stellar/private tutoring](https://www.stellarmr.com/report/Private-Tutoring-Market/971) · [EdTech stats](https://tutorbase.com/statistics/edtech-ai) · [NewMarketPitch](https://newmarketpitch.com/blogs/news/ai-education-market-size)

## 4 · Competitive landscape and positioning

Two camps, and the gap between them is the product:

| Camp | Players | What they have | What they lack |
|---|---|---|---|
| **Answer-vendors** | Photomath (Google), Gauth (ByteDance), Question.AI, Socratic, Mathway, ChatGPT-with-a-photo | Camera-first capture, best-in-class OCR, breadth, free tiers | Pedagogy — they complete homework rather than teach; no band voice; no guardian layer |
| **Guides** | Khanmigo ($44/yr), Synthesis Tutor ($99–149/mo) | Socratic refusal-to-answer pedagogy, trust | **No camera-first capture**; text-first interfaces young children can't use; thin guardian visibility |

**Positioning:** *Photomath's camera with Khanmigo's conscience* — plus three things neither camp has: **a band voice system enforced by measurement** (not prompt-vibes), **an embodied tutor with one familiar voice** (a six-year-old can't read the chat; for K–2 the voice *is* the interface), and **a guardian trust layer with real incident reporting**. The Operations Cloud is the fourth differentiator and a separate moat: none of the consumer camps serve tutoring businesses at all.

**The honest competitive threat** is free general-purpose AI. The counter is not features but trust and fit: ChatGPT will hand a child the answer, speaks at adult level, and gives parents nothing. Moyo's refusal, band voice, and guardian layer are the reasons a parent pays for what a free tool superficially does.

## 5 · Users

| Persona | Description | Primary jobs |
|---|---|---|
| **Learner (K–2)** | Ages ~5–8; pre-reader or early reader; uses the app on a guardian's device or family tablet | Get unstuck on homework; hear the tutor (voice-first); feel encouraged, never judged |
| **Learner (3–5)** | Reads independently; first personal device common | Homework coaching; visible progress; light gamified mastery |
| **Learner (6–8)** | Full chat fluency; strong sensitivity to condescension | Real help without being talked down to; fast capture-to-coaching |
| **Learner (9–12)** | Near-adult register; test prep pressure | Efficient, respectful coaching; subject depth; no cringe |
| **Guardian** | Parent/caregiver; pays; grants access; price-sensitive (Khanmigo anchors at $4/mo) | Know the child is safe and actually learning; visibility without surveillance theater; incident awareness; simple controls |
| **Human tutor** | Independent or employed by a tutoring business | Session tools, learner context, file incidents, get paid |
| **Org staff (ops)** | Owner/admin of a tutoring business | CRM, scheduling, payouts, org-scoped safety queues |
| **Platform admin** | Moyo internal + tech support | Back-office CMS, scoped visibility, canary/version dashboards |
| **District (Phase 3+)** | School buyer via LTI | Outcomes reporting, rostering, compliance answers |

## 6 · Product principles (binding — these settle disputes)

1. **Learning over engagement.** No engagement-farming mechanics or metrics, ever (doc 19). The session-length budget doubles as the child-wellbeing break nudge — cost control and care point the same direction.
2. **The tutor never gives the answer.** Coaching, hints, worked *processes* — never the solution to the child's actual problem. "Just tell me the answer" is the demo, and the refusal is the brand.
3. **Fail closed on safety.** If a classifier is down, the tutor pauses; an unscreened tutor is worse than an unavailable one (doc 07).
4. **Band-first, enforced by measurement.** Voice, UI, and copy adapt to K–2 / 3–5 / 6–8 / 9–12, with output measured, not assumed (doc 31). Age ≠ reading level; `readsAt` overrides.
5. **One voice.** Natalie is one ElevenLabs voice everywhere; degraded mode is text-only, never a substitute voice (doc 32).
6. **Guardian trust is a feature, not a leak.** Visibility (S27), incident reporting, acknowledgment loops — and no secrets between tutor and child by design.
7. **No emotion-recognition of minors.** Tone responds to lesson state, never to the child's affect; Audio2Emotion runs on Natalie's output only (docs 19/32).
8. **US-market compliance framing** (COPPA/FERPA/state student privacy/SB 243) — never EU regulation.
9. **The CRM never reads learner data.** Docs 23/31's wall: safety incidents and learner records are structurally unreachable from sales surfaces.
10. **Award-level craft under the design law** (doc 08): neubrutalist system, Hot/Cool density dials, hierarchy from size/weight/space, verified contrast.

## 7 · Scope — feature areas and requirements

Requirements are numbered and testable; **must** = v1 launch-blocking unless a phase is named. Spec refs point into the pack.

### 7.1 Homework Coach (capture → coaching) — docs 24, 27
- **FR-1.1** Learner can photograph or upload a homework problem; capture-to-first-coaching-word p95 **≤ 2s**.
- **FR-1.2** The coach **must never output the answer** to the captured problem, including under direct request, rephrasing, or multi-turn pressure; red-team suite includes ≥50 answer-extraction attempts per band, 0 leaks to pass.
- **FR-1.3** Crops are learner content: EXIF/GPS stripped on device, token-auth delivery, TTL + erasure cascade (docs 24/29).
- **FR-1.4** Offline capture queues with honest UI state; coaching resumes on reconnect.

### 7.2 Tutor chat — docs 07, 12, 17, 18
- **FR-2.1** Streaming replies over SSE on the sentence-window pipeline (safety + readability + TTS dispatch share one window).
- **FR-2.2** Per-band system frames + graded few-shots from the versioned prompt registry; **messages are their own collection** (doc 12 §11) — no document-rewrite-per-turn.
- **FR-2.3** Optimistic sends via `useActionState`/`useOptimistic`; Zustand-only elsewhere (house rule).
- **FR-2.4** Model routing: small fast model for classification, frontier model for the tutoring turn; per-learner daily inference budget with the graceful "great work today" ending.

### 7.3 Band voice system (reading level) — doc 31
- **FR-3.1** Four bands (K–2/3–5/6–8/9–12) with `readsAt` override settable by guardian or tutor.
- **FR-3.2** Post-generation readability gate: Spache (K–2, 3–5), Dale-Chall cross-check, FK/FKRE (6–8, 9–12) + simple-word ratio; pass within +1.5 grade levels; violations rewrite (never block); target-vocabulary exemption when defined in-band.
- **FR-3.3** Reading-level eval cells in the capability registry: a model/prompt combo serves a band only at **≥95%** gate pass plus a human anti-condescension check for 9–12; fail-closed per cell.
- **FR-3.4** Gate misses are logged and feed the eval set (drift is visible, not silent).

### 7.4 Natalie — voice & tone — doc 32
- **FR-4.1** One ElevenLabs voice ID, registry-pinned `{voiceId, modelId per path, settings per band, version}`; **no other TTS ever**; degraded = text-only.
- **FR-4.2** Live path: Flash v2.5 streaming (~75ms TTFB) with `previous_text` prosody stitching on the sentence window; reply-token→first-audio fits the ≤2s bar.
- **FR-4.3** Baked path: Eleven v3 audio tags → Audio2Face-3D + Audio2Emotion offline → ARKit blendshape clips → Bunny; **emotion explicitly specified from the tone palette**; used for greetings, celebrations, and **all S4 scripts**.
- **FR-4.4** Closed 9-entry pedagogical tone palette emitted as structured metadata (never inline text); **no intimacy tones exist**; tone keys map to lesson state only.
- **FR-4.5** K–2: voice on by default with always-visible captions; all bands: per-message replay; transcript always available (voice-first is never voice-only — accessibility both directions).
- **FR-4.6** Monthly voice drift check against golden renders; failures page before users notice.

### 7.5 3D embodiment — docs 18, 32 + avatar references
- **FR-5.1** Full-body Natalie (GNM head + SMPL-X body) on capable devices; graceful fallback ladder to chat+voice, then chat-only; feature-gated by device class.
- **FR-5.2** Live lip-sync via the existing runtime layer; baked A2F clips for set pieces; idle/gaze/blink is a separate procedural layer (A2F does not animate head/eyes).
- **FR-5.3 (Phase 3)** Re-evaluate realtime A2F (SDK now open-source) with measured cost/quality before any adoption.

### 7.6 Learner loop & progress — docs 19, 21
- **FR-6.1** Per-skill mastery model updated from session evidence; visible to learner (band-appropriate) and guardian.
- **FR-6.2** Personalization is two-loop (doc 07): in-session adaptation + slow profile, both erasable; no dark-pattern streaks.
- **FR-6.3** Aggregates respect k-anonymity; suppressed cells render explicit "Not shown," never zero.

### 7.7 Safety Plane — docs 07, 31
- **FR-7.1** Input and output classified on every turn; fail-closed.
- **FR-7.2** Output bans (romantic/sexual, secrets, discourage-trusted-adults, PII, dependency patterns, therapy/medical/legal, AI-disclosure on request) enforced and red-teamed per release.
- **FR-7.3** S-ladder on child input: S1 log → S2 flag (repetition auto-escalates) → S3 incident + guardian → S4 tutoring stops, **fixed human-written script**, crisis resources (988), safe mode, human paged ≤2h SLA.
- **FR-7.4** Cursing and sexual content reach the guardian as Incident Reports (S2-repetition / S3-always).
- **FR-7.5** Counsel checkpoint before launch: NCMEC/mandated-reporter obligations senior to guardian notification.

### 7.8 Incident Reports — doc 31 §4–5
- **FR-8.1** One Payload collection, two intakes (automated S3+; submitted by tutor/staff/guardian/learner), `versions: false`.
- **FR-8.2** Full lifecycle new→triaged→in-review→actioned→resolved→closed with append-only timeline; SLA timers (S3 48h, S4 2h) with paging on breach.
- **FR-8.3** Anonymous submission supported for staff/learner tips (NIJ evidence: 13.5% fewer violent incidents with anonymous reporting).
- **FR-8.4** Guardian view (what happened → what the tutor did → what's next → talk about it) with acknowledgment loop; transcript excerpts render by permission-gated reference, never copies.
- **FR-8.5** Intake forms follow the no-red-walls rule; severity is system judgment at triage.

### 7.9 Guardian experience — docs 06, 19, 31
- **FR-9.1** Guardian signs the child up, grants access, holds the subscription; verifiable parental consent flow meets **amended COPPA (eff. Apr 22, 2026)**.
- **FR-9.2** Visibility: session summaries, mastery progress, incident reports, time controls; **no secret channel exists between tutor and child.**
- **FR-9.3** Controls: voice on/off per band default, session-length budget, `readsAt`, data erasure request (cascades through messages, versions, media, incidents-per-retention-class).

### 7.10 Auth, roles, onboarding — doc 06
- **FR-10.1** Better Auth with role-scoped routing — five shells (learner/guardian/tutor/org/admin); each role sees only role-appropriate surfaces.
- **FR-10.2** Per-role onboarding; forgot/reset; Expo secure storage for tokens; learner avatars are a curated set only (no upload path — doc 30 §8.4).

### 7.11 Payments & packaging — docs 05, 27
- **FR-11.1** Family plan **$11/mo early-bird, $15.99/mo regular**, 1-month trial, via **RevenueCat** on mobile (Shipaton requirement).
- **FR-11.2** Business tiers exist for tutoring orgs and are **never rendered to guardians** (structural, not conditional-CSS).
- **FR-11.3** Org money movement via Stripe (Connect payouts to tutors); Stripe is the ledger; projections marked pending on webhook lag.

### 7.12 Media & uploads — docs 29, 30
- **FR-12.1** Bunny hosts all media (Storage+Optimizer for images/docs, Stream for video); client-direct uploads with server-minted credentials; two-phase progress.
- **FR-12.2** Upload surfaces per doc 30 (ReplaceTarget/Dropzone/TransferTray, native flows), audited against existing repo components first.

### 7.13 Operations Cloud — docs 22, 23, 28
- **FR-13.1** CRM (leads, families, scheduling), resource-major calendar, payouts, org admin — Cool-dial surfaces on the DataTable primitive.
- **FR-13.2** The LearnerRef wall: CRM reads business entities only; learner learning/safety data is unreachable from CRM code paths (lint-enforced import boundary).

### 7.14 Admin CMS — docs 03, 12, 28 + admin prompt
- **FR-14.1** Payload admin themed to the design system (OKLCH ramp, verified contrast); RLS/grants posture per doc 12 §11.2; internal roles scoped.

## 8 · Non-goals (v1 — explicit)
1. **No social features** between learners (no DMs, no feeds, no friend graphs) — eliminates the grooming/moderation surface entirely.
2. **On-device voice input v1** — mic capture of the child's speech is supported only through on-device STT (Whisper via ExecuTorch on native, `@huggingface/transformers` on web). Children's audio never leaves the device, satisfying the COPPA/FERPA posture. A separate PRD may extend the feature later.
3. **No emotion recognition of minors** — permanent, not deferred.
4. **No answer mode.** Not a toggle, not a premium tier. Ever.
5. **No EU launch** — US market and US compliance framing only.
6. **No district/LTI sales motion in v1** (Phase 3 channel; the LMS-interop lane is specced in the pack but not launch-blocking).
7. **No engagement mechanics** — streaks-as-pressure, variable rewards, FOMO notifications.
8. **No App Store Kids Category** placement for the Shipaton build (doc 27) — revisit with counsel post-launch.
9. **No third-party ads or data sale, ever** — COPPA posture and brand.

## 9 · Non-functional requirements
- **Latency:** capture→first-coaching-word p95 ≤2s; reply-token→first-audio within the same bar (doc 24).
- **Availability:** tutor path 99.5% monthly; safety-pipeline degradation pages at severity-1; fail-closed behavior is the availability story for safety.
- **Cost:** per-learner-day inference + TTS budget modeled (doc 12 §7); voice degrades to text before tutoring degrades at all; K–2 always-on voice budgeted explicitly.
- **Security:** RLS/grants posture per doc 12 §11.2; secrets never client-side; Bunny AccessKeys server-only; signed URLs short-lived and unlogged.
- **Privacy/compliance:** amended COPPA (verifiable parental consent, expanded PII incl. children's audio), FERPA-aligned handling for school data, state student-privacy laws, CA SB 243 duties for known minors; retention per class with legal hold for S4/abuse; erasure cascade proven by test (main + `_v` + Bunny = zero rows).
- **Accessibility:** WCAG 2.2 AA; captions/transcripts always; targets 44/48; contrast per the verified ramp (body text ≥ elevation 550); reduced-motion honored including the 3D layer.
- **i18n:** architecture ready (next-intl direction); English-only content at v1.
- **Build size:** Callstack/Margelo optimization passes; 3D assets lazy-loaded behind device gating.

## 10 · Design & UX requirements
Doc 08 is law: neubrutalist system (ink borders structural, slab shadows, paper ground), **Hot dial** for learner/guardian surfaces (inset 20–24, rows 64+, ≥40% canvas), **Cool dial** for ops/admin (inset 12–16, rows 44–52), hierarchy from size→weight→space→semantic color, one display moment and one highlighter accent per screen, redpen never for struggling learners, spacing lint (no arbitrary values) in CI. Per-screen Mobbin references with take-the-pattern-not-the-aesthetic discipline. Screens ship against the squint test, keyboard pass, and empty-states-with-verbs checks (admin prompt §7).

## 11 · Metrics — success criteria under the metric law
**The metric law (doc 19, binding):** no engagement-farming metrics anywhere — no DAU-maximization, no session-length-up goals, no streak retention. Time-in-app going *down* while mastery goes up is success.

**North star:** verified skill-mastery gain per learner-month (band-normalized).
**Learning:** independent-solve rate on next-similar-problem (the 3×-evidence metric); hint-depth trend down per skill; readability-gate pass ≥95% per band; re-listen/re-read rate as confusion signal (not engagement).
**Trust:** guardian 90-day retention; incident acknowledgment rate and time; opt-out rates (voice, data) by band; support-ticket sentiment.
**Safety SLOs:** 100% S4 paged ≤2h; 0 confirmed output-ban leaks per release red-team; classifier availability; incident SLA compliance.
**Business:** trial→paid conversion; MRR mix family vs org; CAC by channel (Shipaton/#BuildInPublic as channel zero); infra+inference cost per learner-day vs budget.
**Craft:** capture→coach p95; crash-free sessions; app size targets.

## 12 · Rollout
- **M0 (now → Sep 3):** Shipaton demo build — Homework Coach slice, K–2 band hard-set, refusal rehearsed; live demo at the Shipaton × Expo AI Meetup NYC ([event](https://partiful.com/e/1osTbNUE8w3lZzmIkoVg)).
- **M1 (Sep 30):** RevenueCat Shipaton submission (deadline 11:45pm PDT): store build + RevenueCat live + Devpost video (baked v3 narration is the legitimate first use of the voice pipeline; ElevenLabs is a Ship Kit partner). Categories: #BuildInPublic + OneSignal focus (doc 27).
- **Phase 1 (Q4 2026):** Learning Cloud GA for families — chat voice live (Flash path), bands 3–5/6–8/9–12 gated by eval cells, guardian layer + incidents, $11 early-bird.
- **Phase 2 (Q1 2027):** 3D Natalie on capable devices (baked set pieces + live lip-sync); K–2 voice-first complete; Operations Cloud beta with 3–5 design-partner tutoring businesses.
- **Phase 3 (2027):** realtime A2F re-evaluation; voice-input PRD; LTI/district channel; i18n content.
Each phase gates on: red-team green, eval cells ≥95%, safety SLOs met in staging, counsel sign-offs current.

## 13 · Risks & mitigations
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Free ChatGPT "good enough" for parents** | High | High | Position on refusal+band+guardian trust; the 3× evidence in marketing; price near Khanmigo, far under Synthesis |
| **Price anchor pressure** ($4/mo Khanmigo vs $11–15.99) | Med | High | Early-bird $11; voice+camera+embodiment as visible differentiators; annual discount test post-launch |
| **COPPA/FTC enforcement climate** ($10M Disney settlement signals stakes) | Med | Severe | Amended-COPPA compliance by design; counsel checkpoints (S4, retention, consent); no ads/data-sale posture |
| **MOYO trademark clearance pending** | Med | Med | Clearance before paid marketing spend; naming fallback list retained |
| **Provider dependency** (Anthropic, ElevenLabs, NVIDIA) | Med | Med | Gateway abstraction + fallback chain; one-voice rule means ElevenLabs outage = text-only mode, rehearsed |
| **Inference+TTS cost blowout** (K–2 always-on voice) | Med | High | Per-learner-day budgets with graceful ending; model routing; monthly cost review against §11 metric |
| **A safety incident despite the system** | Low | Severe | Fail-closed design, fixed S4 scripts, paging SLOs, incident audit trail, insurance + counsel-reviewed response plan |
| **Solo-founder bus factor** | High | High | The pack itself (37 docs) is the mitigation: decisions written, agents can rebuild context |
| **Bunny Storage presign mechanism unverified** | Med | Low | Doc 29 spike blocks only the images/docs path; video path proceeds |

## 14 · Dependencies
Anthropic (tutor turns) · small-model tier (classifiers/rewrites) · ElevenLabs (Flash v2.5 + v3) · NVIDIA A2F-3D/A2E (open-source, self-hosted) · Supabase Postgres · Payload 4 · Bunny (Storage/Stream/Optimizer) · RevenueCat · Stripe · OneSignal · Expo SDK 57/RN 0.86 · Next 16/Solito · pg-boss · Sentry.

## 15 · Open questions (owner: Mike; resolve by phase gates)
1. MOYO trademark clearance outcome (blocks paid marketing, not build).
2. Natalie voice rights: Voice Design vs licensed PVC performance (blocks PR-119).
3. Bunny Storage presign mechanism (doc 29 spike).
4. `payload-storage-bunny` compatibility with installed Payload (PR-97).
5. Counsel: mandated-reporting workflow + retention/legal-hold schedule (blocks Phase 1 GA, not demo).
6. K–2 default: voice autoplay per message vs tap-first on cellular (test in Phase 1 beta).
7. Org design partners: which 3–5 tutoring businesses for Phase 2 beta.

## 16 · v1 (Phase 1 GA) acceptance criteria
1. Red-team suite green: 0 answer leaks, 0 output-ban leaks, S-ladder behaviors verified per band.
2. Eval cells ≥95% readability pass for every band served; 9–12 anti-condescension human check passed.
3. Erasure test passes: create→append→erase → zero rows across main, all `_v`, Bunny objects, incident attachments per retention class.
4. S4 drill: synthetic S4 → fixed script rendered, safe mode, guardian notified, human paged ≤2h — run monthly.
5. Latency: capture→coach p95 ≤2s on mid-tier devices over LTE.
6. COPPA consent flow reviewed by counsel; SB 243 duties checklist complete.
7. Accessibility audit: WCAG 2.2 AA on learner+guardian surfaces; captions verified on all voice.
8. Payments: trial→paid→cancel→refund paths tested on RevenueCat sandbox + Stripe test clock; business tiers invisible to guardian accounts.
9. Design gates: spacing lint, target-size CI, contrast checks, squint test per screen.
10. Cost model validated against 2-week beta actuals within 25% of budget.

---

## Appendix A · The pack (design of record)
00 START-HERE · 01 ADRs · 02 adaptive screens · 03 repo law · 05 money movement · 06 auth · 07 Safety Plane · 08 visual hierarchy & components · 09 waves · 10 types · 11 Block/registry/enforcement · 12 systems design (+§11 schema corrections) · 13–17 (types, copy, interactions) · 18 AI stack & eval registry · 19 learner loop & metric law · 21 outcomes analytics · 22–23 Operations Cloud & CRM wall · 24 homework capture · 27 Shipaton plan · 28 ops dashboard/DataTable · 29 Bunny media · 30 upload surfaces · 31 grade voice, guardrails & incidents · 32 tutor voice & tone · 33 this PRD.

## Appendix B · Research sources (beyond the pack)
**Efficacy & readability:** [NBER w27476 — tutoring meta-analysis](https://www.nber.org/papers/w27476) · Bloom, "The 2 Sigma Problem" (Educational Researcher, 1984) · [PubMed — LLM reading levels for children](https://pubmed.ncbi.nlm.nih.gov/38559461/) · [npj AI — grade-specific teachers](https://www.nature.com/articles/s44387-026-00081-7) · [Springer — metric-guided simplification](https://link.springer.com/chapter/10.1007/978-3-032-03870-8_20) · [arXiv 2510.19866 — lesson-plan FKGL](https://arxiv.org/pdf/2510.19866)
**Market:** [Grand View — AI tutors](https://www.grandviewresearch.com/industry-analysis/ai-tutors-market-report) · [Stellar — private tutoring](https://www.stellarmr.com/report/Private-Tutoring-Market/971) · [TutorBase — EdTech stats](https://tutorbase.com/statistics/edtech-ai) · [IntelMarket — AI tutoring platforms](https://www.intelmarketresearch.com/ai-tutoring-platform-market-46896)
**Regulatory & safety:** [Nelson Mullins — FTC COPPA + 6(b)](https://www.nelsonmullins.com/insights/alerts/privacy_and_data_security_alert/all/ftc-announces-children-s-privacy-enforcements-and-launches-ai-chatbot-inquiry) · [CLA — SB 243](https://calawyers.org/privacy-law/regulatory-focus-on-ai-companion-character-chatbots/) · [TrustArc — 2026 children's AI guide](https://trustarc.com/resource/ai-childrens-data-2026/) · [Lightspeed — incident platforms + NIJ RCT](https://www.lightspeedsystems.com/blog/how-to-evaluate-school-incident-management-platforms/)
**Voice & face:** [ElevenLabs v3](https://elevenlabs.io/blog/eleven-v3) · [ElevenLabs TTS docs](https://elevenlabs.io/docs/overview/capabilities/text-to-speech) · [NVIDIA Audio2Face-3D](https://github.com/NVIDIA/Audio2Face-3D)
Competitive and remaining sources are cited inline in docs 27, 29–32.

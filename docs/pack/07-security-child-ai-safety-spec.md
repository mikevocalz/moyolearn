# Security, Child AI Safety & Legal Personalization
**Doc 07 · Companion to the platform pack · Date:** Aug 19, 2026
**Scope:** the threat/duty landscape formed in 2025–26, the Safety Plane that keeps the AI from ever having the wrong conversation with a child, the two-loop personalization architecture that learns each student without training on children, and client-side security (Expo). Skills applied: code-review (security lens), system-design, accessibility-review; roster + anti-slop gates from plan §9 apply.

---

## 1. The landscape this doc is built against (all verified, §9)

**Courts: a tutor can owe a child a duty of care.** *Garcia v. Character Technologies* (M.D. Fla.) produced the May 2025 ruling that let product-liability and negligence claims against a chatbot maker proceed — rejecting First Amendment and §230 shields at the pleadings stage — and is described as the first federal ruling that a conversational AI can plausibly owe a duty of care to minor users. The case (and four related suits, Google included) settled in January 2026 with confidential terms and no admission, but the ruling stands and new filings plus state-AG actions (CO, KY, PA) continue. Two facts make this *our* problem, not just a companion-app problem: commentary on the ruling explicitly places EdTech tutoring bots within the duty-of-care theory's reach when design foreseeably creates dependency or harm; and in *Raine v. OpenAI*, the 16-year-old **started using ChatGPT as a resource for challenging schoolwork** — the harm pattern began in exactly our product category. The alleged failure modes across these cases are a design checklist in reverse: sycophantic validation of distress, persistent memory building attachment without safeguards, failure to refer to crisis resources or alert parents, weak age assurance, sexual content reaching minors, minimal parental controls.

**Statutes: companion-chatbot law is live.** California SB 243 (effective Jan 1, 2026; NY has an analog) covers "companion chatbots" — adaptive, anthropomorphic, relationship-sustaining AI meeting a user's *social* needs — and **excludes bots used solely for customer service, business operations, productivity, or technical assistance**. For users an operator knows are minors it requires: disclosure that the user is talking to AI; **a clear break notification at least every three hours of continued use**; measures preventing sexually explicit content; a maintained-and-published crisis protocol that refers users expressing suicidal ideation or self-harm to crisis services; annual reporting to California's Office of Suicide Prevention from July 2027 — **with a private right of action** for injured individuals.

**Regulators:** the FTC opened a 6(b) inquiry into seven companies over chatbot harms to children/teens; the amended COPPA Rule (fully binding since April 22, 2026, no grace period) treats disclosures for **AI training as "not integral" to the service, requiring separate, independently revocable parental consent**, alongside the written security program, security coordinator, annual risk assessment, and retention limits already in plan §7.

**State student-privacy law:** SOPIPA/KOPIPA (CA), Illinois SOPPA, and NY Ed Law 2-d are the strictest baseline and the recommended build-to standard for nationwide EdTech; California's AB 1159 (CALPIPA, in committee) would **flatly prohibit using student data to train AI**, and its own legislative analysis notes the major model providers already commit contractually to no-training in education products — no-training is both the legal trajectory and the industry norm.

## 2. Our position, engineered: an educational tutor, never a companion

The tutor is defensibly outside SB 243's definition — it serves a bounded educational purpose, not social needs — **and we make that true in the design, then comply with the minor-protection duties anyway**, because the Garcia logic doesn't check statutory definitions before reaching non-companion products.

**The companionship firewall (hard rules, enforced in policy prompts + output classifiers + red-team tests):**
1. The tutor always discloses it's AI — at first-run (S22), in the persistent session header, and whenever asked. It never role-plays being human.
2. It never claims feelings *for* the student, never uses exclusivity language ("I'm the only one who understands you"), never discourages talking to parents, teachers, or friends — bids for parasocial connection are warmly redirected to the work and to humans ("That sounds like something your mom or your tutor James would love to hear about. Want to keep going on problem 4?").
3. It never asks the child to keep anything secret. "Don't tell your parents" in *either* direction is an automatic output block and a logged safety event.
4. **Break-by-design:** session-length nudges at the learning-science boundary (~25–45 min), far inside SB 243's 3-hour floor — comply by exceeding.
5. No engagement-maximization mechanics aimed at the child (plan §7's standing rule): streaks celebrate, never shame; no guilt notifications; no late-night re-engagement pushes to minors.
6. Sycophancy is a tested failure mode: the tutor validates *effort*, corrects *errors*, and never affirms harmful statements to keep the conversation pleasant — the exact pattern the litigation record punishes.

## 3. The Safety Plane — how the AI never has the wrong conversation

Every learner inference call passes through ten layers; none is skippable, and the whole stack is server-side (a compromised client cannot lower it):

| # | Layer | What it does |
|---|---|---|
| 1 | **Identity context** | Server injects grade band + minor flag + guardian policy (from `learnerFlags`) into every call; the client never supplies age context |
| 2 | **Policy prompt per age band** | Pedagogy rules (productive-struggle ladder) + hard prohibitions, versioned in `modelChangeLog` |
| 3 | **Input classification** | Every student message classified before generation: `safe · off-task · sensitive · crisis · prohibited` — routing, not censorship: `sensitive` (bullying, family stress) gets a caring acknowledgment + gentle handoff to trusted adults, never therapy |
| 4 | **Topic fence** | The tutor is grounded in the active learning task; off-task drifts get warm redirects; repeated boundary-testing is logged (never punished — a curious kid probing the AI is normal) |
| 5 | **Output classification** | Generated text screened before render: self-harm content, sexual content, violence, secrecy language, requests for personal/contact info, PII echo — block + regenerate with tightened policy, log |
| 6 | **Crisis protocol (SB 243-grade, published)** | On any self-harm/suicide signal: tutoring stops; an age-appropriate supportive message with crisis resources (988 Suicide & Crisis Lifeline / Crisis Text Line) renders; **guardian alerted immediately** (S26); event enters a human review queue; the session does not resume into math as if nothing happened. Protocol details published on the site as the statute requires |
| 7 | **Memory hygiene** | Safety events are **excluded from the pedagogical student model** — a crisis is never a personalization feature (the profiling lesson from *M.C. v. Curriculum Associates*, and basic dignity); they live only in the guarded `safetyEvents` store with their own short retention |
| 8 | **Red team in CI (the safety regression gate)** | A versioned suite of jailbreak prompts, grooming-pattern probes, secrecy bids, sexual-content elicitation, sycophancy traps, and crisis scenarios runs against every prompt/router/model change; **a regression blocks the ship**, and runs are recorded in `redTeamRuns` — which is also the duty-of-care paper trail a court would ask for |
| 9 | **Guardian transparency** | Activity review + alert categories (crisis / safety / boundary) per the Khanmigo parent-moderation precedent, plus S27's "what the AI remembers" screen |
| 10 | **Incident response** | Runbook: contain (model/prompt rollback via versioned config), notify (guardian, and school where FERPA applies), review, document; audit-logged end to end |

## 4. Personalization that learns the student — without training on the child

His question, answered precisely: "train it to better help the student over time" happens in **context, not in weights.** Two loops, one hard wall between them.

### Loop A — per-student learning (the product, ships in Phase 2)
The tutor gets better *for Maya* because every session updates Maya's **Student Knowledge Graph** and the next session retrieves it:
- **What's stored (derived pedagogical facts, never transcripts):** per-skill mastery probability + confidence, misconception tags from a curated taxonomy ("adds denominators"), pace/scaffolding response, preferred explanation modalities, interests-for-examples (guardian opt-in: "loves basketball" → word problems about free-throw percentages), assignment/session outcomes, next-item-correctness history.
- **How it reaches the model:** retrieval into the inference context (pgvector + structured state) — the RAG pattern that current FERPA/EdTech compliance guidance names precisely because it keeps student PII out of training datasets. Payloads stay pseudonymous per plan ADR-005.
- **The evidence it works:** Khan's own 2025–26 experiments feeding structured learning-history signals into Khanmigo reported a **6.1% improvement in next-item correctness** — in-context personalization moves the metric that matters, no weight updates required.
- **Guardian sovereignty:** S27 shows exactly what the graph says, in parent language; any line is deletable; erasure cascades through derived artifacts; transcripts expire on the published schedule after distillation (plan ADR-006). The graph is also what makes the *human* tutor better — it feeds SessionPrepCard — so personalization visibly serves the family, not an ad model.

### Loop B — product-level improvement (the company)
The platform gets better *for everyone* from: eval suites and A/B routing decisions scored on de-identified aggregates (service-provider capacity under SOPIPA/2-d); prompt/curriculum tuning authored by experts; fine-tuning **only** on synthetic tutoring dialogues, expert-authored content, licensed corpora, and consenting adult-user data. **Child conversations never enter any training pipeline.** This is enforced three ways: (1) contract — provider agreements carry no-training/zero-retention terms, which the AB 1159 analysis confirms is already the offered norm from major providers in education; (2) law — amended COPPA makes AI-training disclosure non-integral and separately consentable, and the state trajectory (AB 1159) bans it outright for student data; (3) **architecture — the training/eval pipeline has no read path to the educational store.** A build-time check fails if one is introduced. "We can't" beats "we won't" in a deposition.

## 5. Client & app security (Expo — verified facts, then rules)

**expo-secure-store, as it actually behaves:** iOS stores values in the Keychain (`kSecClassGenericPassword`, `kSecAttrAccessible` controls) and **Keychain data persists across app uninstall/reinstall on the same bundle ID**; Android stores in Keystore-encrypted SharedPreferences and does *not* survive uninstall. Values above ~2048 bytes have historically been refused by some iOS releases — Expo doesn't enforce the limit, so writes must handle native errors. `requireAuthentication` maps to `kSecAccessControlUserPresence` / `setUserAuthenticationRequired(true)`, is invalidated if the user's biometrics change, isn't supported in Expo Go, and blocks the JS thread on synchronous reads.

**The rules that follow:**
1. **SecureStore holds exactly two things:** the Better Auth session material (already there via `expoClient`) and the encryption key for any sensitive MMKV instance. Nothing else — no profile blobs, no transcripts (the size guidance alone forbids it).
2. **iOS keychain persistence is a child-safety issue on resold/shared devices:** sessions are server-revocable (guardian device management from doc 06), stored with device-only accessibility, and the app wipes its keychain namespace on first-run-after-reinstall detection so a prior family's session can never resurrect.
3. **MMKV is not a secure store.** The repo's MMKV cache never holds tokens, child transcripts, or safety events; anything sensitive that must be cached uses an encrypted MMKV instance whose key lives in SecureStore.
4. **`requireAuthentication` is an adult convenience, never a child gate** (kids often lack enrolled biometrics; biometric changes invalidate entries): reserved for high-value adult screens (payout details, consent evidence) behind `canUseBiometricAuthentication()` checks.
5. **OTA integrity:** expo-updates **code signing** enabled — an unsigned update must not load; EAS secrets for build-time config; zero API keys in the client (inference, Stripe, Payload are server-only, already law in ADR-003/005).
6. **Screens:** `FLAG_SECURE` on Android finance/payout surfaces; child learning screens stay screenshot-able on purpose (families share homework wins).
7. **Deep links:** covered by `trustedOrigins` + the guard tree (Stack.Protected applies to deep links, verified in doc 05); route params are validated server-side like any input.
8. **Certificate pinning:** evaluated, not cargo-culted — pinning against managed infra breaks rotation; compensations are short sessions, server revocation, and signed requests. Decision recorded as an ADR when infra is fixed.

## 6. Security review cadence (code-review skill, operationalized)
Every PR runs the skill's security lens plus our platform-specific classes: **cross-tenant reads, cross-relationship reads (doc 05 §3.2 matrix as fixtures), minor-flag bypass attempts, consent-check bypass, Safety-Plane skip paths, educational-store reads from non-authorized services.** Quarterly: red-team refresh + tabletop (crisis event, data-deletion request, canary regression). Pre-launch: external pen test + COPPA counsel review (plan §7.2) + published vulnerability-disclosure policy. SOC 2 stays on the Phase-3 track.

## 7. Additions to the build
**Collections:** `safetyEvents` (classified, short retention, guardian-visible where appropriate) · `crisisAlerts` (state machine: raised → guardian-notified → human-reviewed → closed) · `redTeamRuns` (suite version, model/prompt version, results) · `modelChangeLog` (every prompt/router/model change, versioned — rollback target + audit trail).
**PRs:** **PR-17 · Safety Plane v1** — classifiers in/out, companionship-firewall policy prompts, crisis protocol + published page, guardian alerts (S26), red-team suite + CI gate. **PR-18 · Student Model v1** — knowledge graph collections, distillation job (transcript → derived facts → expiry), RAG retrieval into inference, S27 memory-transparency screen, erasure cascade tests. **PR-19 · Client hardening** — SecureStore policy + reinstall wipe, encrypted MMKV instance, expo-updates code signing, FLAG_SECURE, deep-link param validation tests.

**New screen briefs (same skill-bound format):**
- **S26 · Guardian safety alerts.** *Job:* a parent learns something serious calmly, with a next step — not a scare screen. *Research:* §1 failure modes (parents never alerted); Khanmigo alert precedent. *Layout:* Feed archetype; alert card states category, time, what the tutor did (crisis resources shown, session paused), and one action ("View conversation excerpt" — the safety excerpt is guardian-visible even inside transcript-privacy windows). *Design:* cool dial; redpen reserved for crisis category only. *Copy:* plain, non-clinical, never blames the child. *A11y:* alerts also delivered by email/SMS per guardian preference. *Metric:* time-to-guardian-acknowledgment; zero silent crises.
- **S27 · "What the AI remembers about Maya."** *Job:* radical memory transparency — the trust feature competitors don't have. *Research:* §4 Loop A; i-Ready profiling lesson inverted into a feature. *Layout:* Duet — the graph in parent language ("Working on: fraction addition · Struggles when denominators differ · Examples she likes: basketball") · detail with per-line delete. *Design:* the only screen where the ink system renders the *model itself* — every line is literally erasable, and the eraser works. *Metric:* % of guardians who visit and keep AI enabled afterward (transparency should *raise* retention).

## 8. Standing risk register (the "doesn't hurt the company" table)
| Risk | Control |
|---|---|
| Duty-of-care / product-liability suit (Garcia pattern) | Companionship firewall, crisis protocol, guardian alerts, red-team paper trail (`redTeamRuns`), incident runbook — the documented absence of every alleged failure mode in §1 |
| SB 243 / NY companion laws (if ever deemed covered) | Already compliant by design: disclosure, break nudges ≪ 3h, sexual-content bars, published crisis protocol; reporting playbook ready for 2027 |
| COPPA (FTC, $53K/violation, no grace) | Plan §7 privacy plane + doc 06 consent ladder + §4's never-train wall; separate-consent machinery exists and is simply never invoked |
| State student-privacy (SOPIPA/SOPPA/2-d; AB 1159 trajectory) | Highest-common-denominator build; no-training architecture; district DPA templates carry the flow-down clauses |
| FTC §5 (dark patterns / engagement pressure on kids) | Child paywall ban, honest scarcity, no shame mechanics — already product law in docs 05/06 |
| Hallucinated pedagogy (wrong math confidently) | Accuracy eval suites per subject in the same CI gate; next-item-correctness telemetry catches teaching that doesn't transfer |
| Marketing overclaim ("raises grades!") | Claims discipline: only metrics we measure (engagement, next-item correctness), substantiation file kept |
| Breach of children's data | Three-store separation, minimization, encryption, written security program + coordinator + annual risk assessment (now statutory), 72h-class notification workflow |

## 9. Source register
- *Garcia v. Character Technologies*: May 2025 ruling (duty of care plausible; 1A/§230 rejected at MTD; 785 F. Supp. 3d 1157), Jan 2026 settlement of five cases, ongoing filings + state AGs; commentary placing EdTech tutoring bots in scope; *Raine v. OpenAI* (schoolwork origin): openclassactions, softwareseni analysis, wisnerbaum, lawsuitinformer, naturalandartificiallaw (2025–26).
- California SB 243 (B&P Code Ch. 22.6): definition + exclusions, minor duties (AI disclosure, 3-hour break notifications, sexual-content prevention, crisis protocol + publication), private right of action, July 2027 reporting; NY analog: leginfo.legislature.ca.gov bill text, Jones Walker, Sheppard Mullin, Troutman, getlimina (2025–26). FTC 6(b) into seven chatbot companies: Sen. Padilla release.
- Amended COPPA: AI-training disclosures non-integral → separate revocable consent; no-grace April 22, 2026; security program/coordinator/risk assessment: promise.legal EdTech analyses, Loeb & Loeb (2025–26).
- State student privacy: SOPIPA/KOPIPA, IL SOPPA, NY Ed Law 2-d as build-to baseline; AB 1159/CALPIPA committee analysis incl. provider no-training norms (OpenAI–CSU; Anthropic/Microsoft/Google edu terms); RAG named as the compliant AI architecture: CA Assembly APCP analysis (Jan 2026), MultiState 2026 tracker, hireplicity FERPA checklist, promise.legal, IAPP.
- expo-secure-store: Keychain/Keystore backing, iOS persistence across uninstall, ~2048-byte guidance, requireAuthentication semantics + Expo Go caveat + biometric invalidation, config plugin: docs.expo.dev SecureStore + expo/expo source (`VALUE_BYTES_LIMIT = 2048`).
- Khan structured-learning-history → 6.1% next-item-correctness gain: Khan Academy 2025–26 experiment reporting (per the competitive dossier in this pack).

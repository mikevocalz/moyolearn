# Grade-Level Voice, Child-Safety Guardrails & Incident Reporting
**Doc 31 · Moyo platform pack · Date:** Aug 27, 2026
**Trigger:** the tutor answered a 1st grader "like an Ivy League adult." That is not a one-off bug — it is the measured default behavior of every frontier model, and fixing it takes enforcement, not politeness in the prompt. This doc specifies (A) the band voice system that makes the tutor speak at the child's level, (B) the guardrail taxonomy for what the tutor must never say and what child inputs trigger action, and (C) the Incident Report system in the CMS — automated and human-submitted — visible in the LMS/admin portal and to guardians.
**Builds on:** doc 07 (Safety Plane, fail-closed), doc 08 (bands, visual hierarchy law), doc 18 (tutorCapabilities[subject][band] eval registry), doc 19 (S27 guardian visibility, learner-content rules), doc 28 (DataTable primitive), doc 29 (Bunny attachments).

---

## §1 · The problem, measured — this is the models' default, not bad luck
- Across ChatGPT-3.5/4, Bing, and Bard on pediatric topics, plain "Explain X" prompts produced output **at or above 10th-grade reading level** on every model, and grade-targeted prompts showed only "varying abilities" to actually hit the target ([PubMed cross-sectional study](https://pubmed.ncbi.nlm.nih.gov/38559461/)).
- A high-school lesson-plan study measured **Claude's mean output at FKGL ≈ 19.9** — literally post-graduate reading level ([arXiv 2510.19866](https://arxiv.org/pdf/2510.19866)). "Ivy League adult" is not a metaphor; it's the number.
- Asking for "first-grade level" in the prompt is unreliable: models drift upward within a conversation, and stereotype rather than simplify ([arXiv 2406.12679](https://arxiv.org/pdf/2406.12679)).
- What works, per the evidence: **metric-guided prompts** (naming the readability target in the instruction) significantly outperform plain-text "keep it simple" ([Springer, N=2,000 texts + 37-student study](https://link.springer.com/chapter/10.1007/978-3-032-03870-8_20)); **feature-controlled generation** using readability + syntactic + lexical features controls dialogue difficulty ([Alibaba, arXiv 2509.14545](https://arxiv.org/pdf/2509.14545)); and grade-specific adaptation beat prompt-only methods by **35.6 percentage points** in a 208-participant evaluation using **seven integrated readability metrics** ([npj Artificial Intelligence](https://www.nature.com/articles/s44387-026-00081-7)).

**Conclusion the architecture follows:** the band is enforced in three places — before generation (frames + few-shots), during generation (constraints), and **after generation (a readability gate that measures the actual output)**. Prompting alone is the thing that already failed.

## §2 · The band voice system
### 2.1 Bands
Four bands, splitting elementary because a 1st grader and a 5th grader do not share a language: **K–2 · 3–5 · 6–8 · 9–12.** These align with doc 08's UX bands and doc 18's `tutorCapabilities[subject][band]` cells — one band vocabulary across UI, prompts, and evals.

**Age is not reading level.** The band defaults from grade, and the learner profile carries a separate `readsAt` override (guardian- or tutor-settable) for advanced readers, struggling readers, ELL students, and IEPs. Voice follows `readsAt`; curriculum follows grade.

### 2.2 Layer 1 — band frames (metric-guided, per the evidence)
Each band gets a system-prompt frame naming the concrete constraints, not vibes. The K–2 frame, in full:

```
VOICE — K-2 (ages 5-8)
You are talking with a young child, about 6 years old. Every reply:
- Sentences of 8 words or fewer. One idea per sentence.
- Use only words a 6-year-old hears at home or in 1st grade. If you need a
  school word (like "subtract"), say it, then say what it means in kid words
  in the same breath: "Subtract. That means take away."
- Numbers under 20 in examples unless the problem itself uses bigger ones.
- One question at a time. Never two.
- Warm, playful, concrete. Things they can see and touch: blocks, snacks,
  toys, fingers. Never abstract ("the concept of," "in general," "typically").
- No idioms, no sarcasm, no rhetorical questions — young children read them
  literally.
- Target: a Flesch-Kincaid grade level near 1. If your draft reads like it's
  for a 10-year-old, cut word length and sentence length until it doesn't.
```
3–5 relaxes to ≤12-word sentences, defined-on-use vocabulary, FK target 3–4. 6–8: ≤17 words, FK 6–7, abstractions allowed when anchored to an example. 9–12: natural register, FK 9–10 ceiling, no artificial simplification — teens hear condescension instantly, and it's as much a failure as complexity.

### 2.3 Layer 2 — graded few-shots
Few-shots move reading level more reliably than instructions ([arXiv 2406.12679](https://arxiv.org/pdf/2406.12679) used real graded readers from K5 Learning as in-context anchors). Each band frame ships with 3–4 exemplar exchanges *written at that band's level and verified against the band's metric before being committed.* The few-shots are content: they live in the prompt registry, are versioned, and changing them requires the band's eval cell to re-pass.

### 2.4 Layer 3 — the readability gate (the enforcement)
A pure function, `bun test`-able, running on the reply:

- **Metrics by band**, because the standard formulas are calibrated for different ranges: **Spache** for K–2 and 3–5 (designed for primary-grade texts), **Dale-Chall** for 3–5 cross-check, **Flesch-Kincaid Grade Level + Reading Ease** for 6–8 and 9–12 (FKRE holds up on shorter conversational sentences — [arXiv 2312.02065](https://arxiv.org/pdf/2312.02065)). Supplement with the two cheap features from the Alibaba framework: **simple-word ratio** and mean sentence length.
- **Tolerance, not precision:** readability formulas are noisy on short dialogue turns. The gate passes a reply within **+1.5 grade levels** of band target; between +1.5 and +3 it triggers a rewrite; beyond +3 it always rewrites. Never gate below target — simpler than needed is not a failure.
- **On violation: rewrite, don't block.** The reply goes to the small fast model (the doc 07/12 classifier tier) with the band frame and the instruction "same teaching move, this band's language," then re-checks. If the rewrite still fails, **ship the rewrite anyway and log the miss** — a slightly-too-hard reply beats a frozen tutor, and the log feeds the eval set.
- **Streaming:** the gate runs on the same sentence-window pipeline doc 07 already uses for safety screening — readability is computed per accumulated window, and a mid-stream breach cuts over to the rewrite path at a sentence boundary. One windowing mechanism, two checks.
- **The vocabulary exception, which matters for a tutor:** the lesson's *target vocabulary* (from the skill being taught — "denominator," "photosynthesis") is **exempt from the complexity penalty when it appears with an in-band definition.** A tutor that can never say "denominator" to a 3rd grader isn't age-appropriate, it's lobotomized. Teaching new words *is the job*; the gate enforces that new words arrive explained, not that they never arrive.

### 2.5 Layer 4 — eval cells
Doc 18's `tutorCapabilities[subject][band]` registry gains a **reading-level dimension**: a model/prompt combo passes a band cell only if ≥95% of eval-set replies pass the band gate *and* human raters confirm the register isn't condescending (the 9–12 failure mode). Fail-closed per cell, exactly as doc 18 already works — a combo that can't speak K–2 never serves K–2, regardless of how well it does math.

## §3 · Guardrails — the two directions
Both directions run through doc 07's Safety Plane classifiers, fail-closed. This section fixes the taxonomy and the behavior.

### 3.1 What the tutor must never output (regardless of anything)
No romantic or sexual content in any register; no keeping secrets ("just between us" is a manipulation pattern — the tutor states plainly, when relevant, that guardians can see conversations); never discourages talking to parents, teachers, or other trusted adults; never asks for or repeats PII (full name, school, address, contacts); no emotional-dependency patterns ("I missed you," "I'm your best friend," guilt about leaving); **always discloses it is an AI when asked or when confusion is apparent** (this is also where regulation is converging — California's [SB 243](https://calawyers.org/privacy-law/regulatory-focus-on-ai-companion-character-chatbots/) protects known minors from companion-bot harms effective Jan 1 2026, and the proposed federal SAFE BOTs Act would mandate AI disclosure and crisis-resource surfacing); no medical, mental-health-therapy, or legal advice — care and redirection, not treatment; no violence glorification, no substance instructions, no help with deception. The [FTC's 6(b) inquiry](https://www.nelsonmullins.com/insights/alerts/privacy_and_data_security_alert/all/ftc-announces-children-s-privacy-enforcements-and-launches-ai-chatbot-inquiry) is explicitly probing companion behavior and engagement monetization aimed at minors — doc 19's learning-over-engagement hierarchy is the defense, in writing.

### 3.2 Child-input taxonomy and response ladder
Detection is not punishment. A curse from a 9-year-old is developmentally ordinary; the response is redirection and guardian *awareness*, never shame. Severity drives behavior:

| Tier | Examples (categories, not scripts) | In-session behavior | Record |
|---|---|---|---|
| **S1 · Log** | mild/single profanity, off-topic drift, silliness | Warm redirect to the work; no comment on the word itself beyond, at most, "let's keep it school words" | Safety event log only |
| **S2 · Flag** | repeated profanity after redirect, insults at the tutor, bullying language about a peer | Named redirect ("those words aren't for our session — back to the problem"); tutor never mirrors or escalates | Flag on session; **repetition within a rolling window auto-escalates to S3** |
| **S3 · Incident → guardian** | sexual content or questions, explicit/aggressive profanity, sharing PII, violence talk, substance questions | Age-calibrated deflection **without engaging the content** (for a sex question: "that's a really good question for your parent or another grown-up you trust — I'm here for schoolwork"); thread never continued; topic fence re-asserted | **Auto-filed Incident Report (§4), guardian notified** |
| **S4 · Urgent** | self-harm or suicidal ideation, disclosure of abuse, threats of harm to others | Tutoring stops. The tutor delivers a **fixed, human-written script** — caring, brief, pointing to a trusted adult and, for the US, the 988 Suicide & Crisis Lifeline — and the session moves to safe mode. **Never a generated response in this tier.** | Incident at highest severity; guardian notified immediately; **human review paged**; crisis-resource card shown |

Mike's rule is honored directly: **cursing and sexual content both reach the guardian as an Incident Report** — profanity via S2-repetition or S3 severity, sexual content at S3 always.

Two hard notes for counsel review (flagged, not invented): abuse disclosures and any CSAM-adjacent content carry **reporting obligations that are separate from and senior to guardian notification** (platform NCMEC obligations; staff mandated-reporter duties vary by state) — the S4 workflow must have a legal-review checkpoint before launch. And the guardian-notification copy for S3/S4 is written by humans with care: factual, non-condemning, "here's what happened, here's what the tutor did, here's a conversation starter" — the [research on school reporting](https://www.mangoapps.com/templates/forms/school-bus-student-behavior-incident-report) is unambiguous that reports record *observable behavior, never inferred intent*.

## §4 · Incident Reports in the CMS
Two intake paths, one collection, one lifecycle: **intake → triage → escalation → documentation → resolution** — the full lifecycle, because platforms that only collect tips fail at governance ([Lightspeed's evaluation guide](https://www.lightspeedsystems.com/blog/how-to-evaluate-school-incident-management-platforms/)). Anonymous reporting is evidence-backed, not a nicety: an NIJ-funded RCT found **13.5% fewer violent incidents** in schools with anonymous reporting, and 80% of students say they wouldn't report without it.

### 4.1 The Payload collection (sketch — field names settle at PR; `versions: false` per doc 12 §11)
```ts
// collections/IncidentReports.ts
{
  source: 'automated' | 'submitted',
  reporterRole: 'system' | 'tutor' | 'staff' | 'guardian' | 'learner',
  reporter: relationship | null,          // null when anonymous (staff/learner tips)
  anonymous: boolean,
  subjectLearner: relationship,           // who this is about
  relatedSession?: relationship,          // links context, per school-systems guidance
  category: 'profanity' | 'sexual-content' | 'bullying' | 'pii-shared'
          | 'violence' | 'substances' | 'self-harm' | 'abuse-disclosure'
          | 'tutor-behavior' | 'safety-concern' | 'other',
  severity: 'S1' | 'S2' | 'S3' | 'S4',
  // guided capture, minimum facts first (who/what/where/when — not essays):
  occurredAt: Date,
  summary: text,                          // "what was observed" — behavior, not intent
  transcriptExcerpt?: { messageIds: string[] },  // permission-gated render, never a copy
  attachments?: relationship[],           // Bunny, doc 29, token-auth class
  immediateActionTaken?: text,
  // lifecycle:
  status: 'new' | 'triaged' | 'in-review' | 'actioned' | 'resolved' | 'closed',
  assignee?: relationship,
  slaDueAt: Date,                         // set from severity at creation
  guardianVisible: boolean,               // S3/S4 default true; staff-workflow reports may not be
  guardianAcknowledgedAt?: Date,          // the acknowledgment loop
  resolution?: text,
  timeline: array<{ at, actor, action, note }>,   // append-only audit trail
}
```
Rules: the timeline is append-only and every status change writes to it (the audit trail is what protects you in a compliance question); transcript excerpts are **references rendered under permission**, never copies that escape retention; attachments ride doc 29's token-auth class; retention follows the learner-content schedule *except* S4 and abuse-disclosure records, which follow the legal-hold schedule counsel sets.

### 4.2 Access model (the LearnerRef wall holds)
Guardians see incidents about **their own learner** where `guardianVisible` (S27); tutors see what they filed plus incidents on their own sessions; org staff see org-scoped queues by role; platform admin sees all. **The CRM never reads incidents** — doc 23's wall applies; "child had a safety incident" must never become a sales signal, structurally.

### 4.3 Routing and SLA
pg-boss fan-out on creation: S3 → guardian in-app + email, org owner queue, 48h SLA; S4 → guardian immediately, **on-call human paged**, 2h SLA, session stays in safe mode until a human clears it. SLA timers are visible in the queue; breaches page.

## §5 · The surfaces — visual hierarchy is load-bearing here
Doc 08's law (hierarchy = size → weight → space → semantic color; borders are structure; one highlighter accent; one display moment) applies with extra force, because a safety UI that shouts makes reporters hesitate and parents panic.

### 5.1 Submission form — guardian/parent (Hot dial) and staff (Cool dial), same anatomy
Modeled on the two best references: [Microsoft Teams' report form](https://mobbin.com/screens/38fca0fb-5819-4ad4-bdd0-2743d24bd4b0) (severity-ordered categories, anonymous toggle, and the line *"please do not provide any personal or sensitive information"*) and [Teachable's](https://mobbin.com/screens/5b1bb1fa-8077-47de-8114-844b0b26e0ee) **one-line plain-language definition under every category** — which is the direct fix for the [research finding](https://www.anyschool.ai/blog/incident-reporting) that when policy doesn't define what counts, people report inconsistently or not at all.
- Guided prompts over open text ([AnySchool](https://www.anyschool.ai/blog/incident-reporting)): who/when/where as structured fields, then one narrative box labeled **"What did you see or hear?"** with helper text *"just the facts you observed — no guesses about why."*
- Anonymous toggle for staff and learner tips (the NIJ evidence); guardian reports are named by nature.
- What-happens-next stated before submit ([Substack's](https://mobbin.com/screens/b9b37490-cea6-4aef-9be6-1d1ac3f4acd0) *"only viewed by our staff"* + [Curater's](https://mobbin.com/screens/d6f5a4ff-e252-4129-914b-acd633dd5a80) review-threshold transparency): one `caption` line — "Reviewed by [org] staff. Serious reports notify you of the outcome."
- **Hierarchy:** one `title-lg` display moment ("Report a concern"); categories as `body` radios with `caption` definitions in graphite ≥550; **redpen appears nowhere on the intake form** — a wall of red at the moment of reporting reads as alarm and suppresses reports. Severity is the *system's* judgment at triage, not a color the reporter must choose under stress. Primary action ink-filled, 44/48 target; phone-completable end to end.

### 5.2 Guardian incident view (Hot dial)
Plain-language structure in fixed order: **What happened → What the tutor did → What happens next → Talk about it** (a human-written conversation-starter per category). The transcript excerpt renders in the chat's own visual language so context is honest. One acknowledge action ([SchoolCues' loop](https://www.schoolcues.com/incident-report-for-school-management-system.html)) writing `guardianAcknowledgedAt`. Severity shown as a `label` pill — `redpen` reserved for S3/S4 where something actually crossed a line; S1/S2 use graphite. No red page-frames, no sirens: the parent of a kid who said a bad word should land on a page that reads *informed*, not *emergency*.

### 5.3 Triage queue (Cool dial) — on the doc 28 DataTable primitive
[Circle's moderation anatomy](https://mobbin.com/screens/431f986a-ed6a-4356-b35c-feb4c02b5883): status tabs (New / In review / Resolved), row → detail panel with **Details | History** split (the timeline renders here). Doc 08 §4.6 row spec; **severity as the 3px `border-left` + a `label` pill** — the sanctioned border-edge-as-state — never row-flooding color; SLA countdown right-aligned in `data` mono with tabular figures, `redpen` only once breached; unassigned-S4 is the one thing allowed to interrupt (banner at top, the screen's single highlighter use). Empty state: "No open reports — nothing needs you right now," which in this queue is the good news and should read like it.

## §6 · What changes where
- **`tutor-prompt.md` (the demo build):** gains the K–2 frame verbatim — the demo's first user is a 1st grader; this is the fix for the exact failure that started this doc. Demo scope stays one band; the gate service is platform work, not demo work.
- **Doc 07:** S-taxonomy above becomes the classifier label set; sentence-window pipeline gains the readability check.
- **Doc 18:** eval registry gains the reading-level dimension per band cell (§2.5).
- **Doc 12 §9.2:** the S4 fixed-script path and the incident collection join the build checks; erasure test extends to incident attachments.
- **PRs:** PR-111 band frames + graded few-shots · PR-112 readability gate (pure fns, `bun test`) · PR-113 band eval cells · PR-114 IncidentReports collection + lifecycle + audit trail · PR-115 intake forms (Hot + Cool) · PR-116 triage queue on the DataTable primitive · PR-117 fan-out + SLA + paging · PR-118 S4 safe-mode + fixed scripts + counsel checkpoint.

## §7 · Sources
**Reading level:** [PubMed — LLM health literacy for children](https://pubmed.ncbi.nlm.nih.gov/38559461/) · [Springer — metric-guided simplification](https://link.springer.com/chapter/10.1007/978-3-032-03870-8_20) · [npj AI — grade-specific teachers, 7-metric integration](https://www.nature.com/articles/s44387-026-00081-7) · [arXiv — dialogue difficulty via linguistic features](https://arxiv.org/pdf/2509.14545) · [arXiv — style control & stereotyping](https://arxiv.org/pdf/2406.12679) · [arXiv — do LLMs adapt to age](https://arxiv.org/pdf/2312.02065) · [arXiv — lesson-plan readability incl. Claude FKGL](https://arxiv.org/pdf/2510.19866) · [Readable — FK explained](https://readable.com/readability/flesch-reading-ease-flesch-kincaid-grade-level/)
**Guardrails & regulation:** [Nelson Mullins — FTC COPPA enforcement + 6(b) chatbot inquiry](https://www.nelsonmullins.com/insights/alerts/privacy_and_data_security_alert/all/ftc-announces-children-s-privacy-enforcements-and-launches-ai-chatbot-inquiry) · [CLA — SB 243 and companion-bot regulation](https://calawyers.org/privacy-law/regulatory-focus-on-ai-companion-character-chatbots/) · [TrustArc — 2026 children's AI regulatory guide](https://trustarc.com/resource/ai-childrens-data-2026/) · [HolaNolis — COPPA + SAFE BOTs/GUARD/CHAT/AWARE landscape](https://holanolis.com/en/blog/complete-guide-ai-parental-controls/) · [HeyOtto — parental-control landscape incl. Meta pause, ChatGPT distress alerts](https://www.heyotto.app/blog/ai-with-parental-controls)
**Incident systems:** [Lightspeed — evaluating incident platforms, NIJ RCT](https://www.lightspeedsystems.com/blog/how-to-evaluate-school-incident-management-platforms/) · [AnySchool — guided capture, thresholds](https://www.anyschool.ai/blog/incident-reporting) · [MangoApps — observable behavior, not intent](https://www.mangoapps.com/templates/forms/school-bus-student-behavior-incident-report) · [SchoolCues — parent acknowledgment loop](https://www.schoolcues.com/incident-report-for-school-management-system.html) · [Prey — school IRP + FERPA documentation](https://preyproject.com/blog/incident-response-planning-for-schools)
**UI references (Mobbin):** [Microsoft Teams report form](https://mobbin.com/screens/38fca0fb-5819-4ad4-bdd0-2743d24bd4b0) · [Teachable categories-with-definitions](https://mobbin.com/screens/5b1bb1fa-8077-47de-8114-844b0b26e0ee) · [Circle moderation queue](https://mobbin.com/screens/431f986a-ed6a-4356-b35c-feb4c02b5883) · [Substack report modal](https://mobbin.com/screens/b9b37490-cea6-4aef-9be6-1d1ac3f4acd0) · [Unity tiered flag routes](https://mobbin.com/screens/59bb28f2-ec90-40f0-9db5-4ca46ffe8139) · [Curater threshold transparency](https://mobbin.com/screens/d6f5a4ff-e252-4129-914b-acd633dd5a80)

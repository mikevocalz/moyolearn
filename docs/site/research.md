# Site research — the Moyo marketing site

<!--
Phase 1 foundation research for the public marketing site. Written to the
`user-research` skill's format: Mode A research notes, one per landing chapter,
plus the JTBD and objection work the chapters have to serve.
Docs only. No product claim in here is invented — every line is either cited to
a pack doc or explicitly labelled an assumption to test.
SOT: this file · docs/pack/33 (PRD) · docs/pack/05 (pricing law) ·
docs/pack/31 (bands + safety) · docs/pack/34 (session reports) ·
docs/38-front-door-and-flow.md §6 (voice + glossary) · docs/site/mobbin/*
SOT-KEYWORDS: site research jtbd objections landing chapters marketing evidence
-->

**Owner:** research + copy lane · **Status:** foundation, pre-build
**Companion:** `docs/site/copy-deck.md` (every string), `docs/site/mobbin/*.md` (structural patterns)

---

## §0 · What this document is

The landing page is nine chapters. Each chapter gets a research note in the
`user-research` Mode A format — job, evidence, pattern, unsupported elements,
likely failure — plus **the one message that chapter must land**, because a
chapter that lands two messages lands none.

Three rules govern everything below.

1. **No invented claims and no invented statistics.** Where the pack has a
   number, it is cited. Where it does not, the line is marked
   `[ASSUMPTION — test]` and must not reach production copy unverified.
2. **Phase honesty.** Several headline capabilities are real in the pack but
   **not shipping at Phase 1 GA**. Those are inventoried in §1 and every chapter
   note that touches one says so. Marketing a Phase 2 capability in the present
   tense is the single largest correctness risk on this site.
3. **US framing only.** COPPA / FERPA / state student-privacy / CA SB 243.
   No EU regulation is cited anywhere on this site (doc 33 §6.8, §8.5).

---

## §1 · Product-truth ledger — what the site may claim, and in which tense

This is the ledger the copy deck is checked against. Everything the site says
must appear in the left column with a matching tense in the right.

| Capability | Pack citation | Ships when | Site may say |
| --- | --- | --- | --- |
| Photograph a homework problem, get coached on it | doc 33 §7.1 FR-1.1; doc 24 §1 | v1 (M0/M1 slice, Phase 1 GA) | Present tense |
| **Never outputs the answer**, incl. under pressure | doc 33 §6.2, §7.1 FR-1.2 (0 leaks to pass) | v1 | Present tense — this is the brand |
| Grade-band voice (K–2 / 3–5 / 6–8 / 9–12), measured | doc 31 §2; doc 33 §7.3 | Phase 1 GA, per-band eval gate ≥95% | Present tense, no band-count boast beyond the four |
| Natalie — one voice, everywhere, no substitute | doc 33 §6.5, §7.4 FR-4.1; doc 32 | v1 (degraded = text-only) | Present tense |
| Session summary reports to the guardian | doc 34 §2 (eight blocks) | Phase 1 GA | Present tense |
| Incident reports to the guardian (S3 always, S2-repeat) | doc 31 §3.2, §4 | Phase 1 GA | Present tense |
| Persistent learner profile / adapts over time | doc 19 (mastery + learner brief); doc 33 §7.6 | Phase 1 GA | Present tense |
| Guardian controls: voice, session length, `readsAt`, erasure | doc 33 §7.9 FR-9.3 | Phase 1 GA | Present tense |
| Family plan $11 early bird / $15.99 regular, all children | doc 05 §2.2; doc 33 §7.11 FR-11.1 | v1 | Present tense, exactly these numbers |
| 30-day trial, **card required** on the family plan | doc 05 §2.2 (`trial_period_days: 30`) | v1 | Present tense — and the card condition must be stated |
| **3D embodied Natalie** (full body, device-gated) | doc 33 §7.5 FR-5.1; §12 Phase 2 (Q1 2027) | **Phase 2**, capable devices only | Future/qualified tense only |
| **Human tutoring inside Moyo for families** | doc 33 §12 Phase 2 (Ops Cloud beta, 3–5 design partners); doc 26 §2 | **Phase 2** | Future/qualified tense only |
| **Shared whiteboard / homework annotation** | doc 26 §1, §3 (Yjs state plane) | Pack-specced; **not in doc 33 §7's v1 FR list** | Qualified tense; verify before present tense |
| **Operations Cloud: CRM, scheduling** | doc 33 §7.13; doc 05 §5.2 M1 | Phase 2 beta | Future/qualified tense |
| **Automated tutor payouts** | doc 05 §5.3 M2, gated at Studio tier | **Phase M2** — v1 *calculates* pay, moves no money | Never present tense; "payroll" ≠ "payouts" at v1 |
| **LMS / LTI embedding** | doc 25; doc 33 §8.6 explicitly a **v1 non-goal** | Phase 3/4, Institution tier | Roadmap/"talk to us" tense only |
| **Languages beyond English** | doc 16 §3; doc 33 §9 (English-only content v1) | `es` next, then `sw`/`fr`, each gated on per-language safety evals | Roadmap tense, with the safety gate stated |
| **Availability outside the US** | doc 33 §8.5 (no EU launch) | Not planned for v1 | Never claim global availability |

**Hard nevers (doc 33 §8, copy law):** no social features between learners; no
voice input from the child in v1; no "answer mode"; no emotion recognition of
minors; no ads or data sale.

### 1.1 · One contradiction inside the pack, surfaced not resolved
Doc 24 §1 lists **"Say it" (doc-15 STT)** as a homework-capture entry method,
while doc 33 §8.2 makes **"no voice input v1"** an explicit non-goal. The site
must follow the PRD (no voice input), but the conflict is worth an owner
decision because a screenshot of the capture screen could show a mic affordance
that the copy is forbidden to describe. **Flagged for Mike; not a site problem
to solve.**

---

## §2 · Jobs to be done

### 2.1 · Parent / guardian — the primary audience

| # | Job (in their words) | Grounding |
| --- | --- | --- |
| P1 | "My kid is stuck on homework right now and I can't help with the way they teach it today." | doc 33 §5 learner jobs "get unstuck"; doc 24 §1 the capture flow exists for exactly this moment |
| P2 | "I want help that makes them *do* the work, not a robot that finishes it." | doc 33 §1 one-liner; §6.2 the refusal principle; §4 the answer-vendor vs guide split |
| P3 | "I want to know whether they're actually learning — not just that they used an app." | doc 34 §1 the perception gap is the doc's central design constraint; doc 33 §7.9 FR-9.2 |
| P4 | "I need to be sure nothing bad happens to my child inside an AI." | doc 33 §6.3 fail-closed; doc 31 §3 the two-direction guardrails and S-ladder |
| P5 | "I need it to speak to *my* child — a 1st grader, not a grad student." | doc 31 §1 (the measured failure that triggered the doc), §2.2 the band frames |
| P6 | "It has to be affordable and I have more than one kid." | doc 05 §2.2 (family plan, all children included; Khanmigo $4 anchor named in doc 33 §5) |
| P7 | "I don't want to be locked in or tricked into a renewal." | doc 05 §1.2 the ROSCA/state-ARL floor; §2.3 trial-conversion hygiene |

**The parent's real decision** is not "which AI tutor" — it is *"is handing my
child to an AI a good parenting decision?"* The page has to win that before it
wins a feature comparison.

### 2.2 · Tutor / tutoring business

| # | Job | Grounding |
| --- | --- | --- |
| T1 | "Run the business — scheduling, families, invoices — without five tools." | doc 33 §7.13 FR-13.1; doc 05 §2.1 the three revenue lines |
| T2 | "Pay my tutors correctly and quickly." | doc 05 §5.2 payroll v1 (calculation) → §5.3 M2 (execution). **Two different promises** |
| T3 | "Let the AI compound my tutors instead of replacing them." | doc 33 §1 "human tutors and the AI tutor compound rather than compete" |
| T4 | "Prove value to the families paying me." | doc 34 §5 the per-learner report trail; §1 practitioner evidence that the trail drives renewals |
| T5 | "Don't put my learners' private data anywhere my sales tools can reach." | doc 33 §7.13 FR-13.2 the LearnerRef wall; doc 31 §4.2 |

### 2.3 · School / district

| # | Job | Grounding |
| --- | --- | --- |
| S1 | "Fit into the LMS we already run — no second login for teachers." | doc 25 §1 lane 1 (LTI 1.3 / Advantage, NRPS, deep-linking) |
| S2 | "Answer our privacy and compliance review." | doc 33 §9 (FERPA-aligned, state student-privacy, SB 243); doc 31 §4 the audit trail |
| S3 | "Show outcomes we can defend to a board." | doc 19 §growth reporting; the ESSA tier ladder (Tier 4 at launch — **a modest claim, and the site must not inflate it**) |
| S4 | "Never let an AI hand a student an answer key." | doc 25 §2.1 the answer-key index boundary; `guided-only` is not a district-configurable setting |

**Note on S3:** doc 19 states the evidence program starts at **ESSA Tier 4 (a
published logic model)**, with Tier 3 as a standing commitment. The site may say
Moyo publishes its logic model. The site may **not** imply proven efficacy of
Moyo itself — the 3× and 0.37 SD figures in doc 33 §2 are *category* evidence
about guided tutoring, not measurements of this product.

---

## §3 · Objections — and what must answer each

Ranked by how often they kill the decision, per the personas and risks in doc 33
§13. Each row names the chapter that owns the answer.

| # | Objection | Who raises it | What actually answers it | Owning chapter |
| --- | --- | --- | --- | --- |
| **O1** | **"Won't it just do the homework for them?"** — the decisive one | Parent, school | Not a reassurance but a **demonstrated refusal**: show the tutor declining and teaching the next step. The pack makes this testable (0 answer leaks across ≥50 extraction attempts per band, doc 33 §7.1 FR-1.2) and permanent (§8.4 "not a toggle, not a premium tier. Ever.") | 03 THE CONVERSATION (primary); echoed in 01 HERO |
| **O2** | "Is an AI safe to leave alone with my child?" | Parent | Named, plain-language guardrails: what it will never say, what happens when something goes wrong, and that **you** are told (doc 31 §3.1 output bans; §3.2 S-ladder; §4.3 the 2h/48h SLAs). Concrete beats badges | 06 FOR PARENTS (primary); 03 |
| **O3** | "More screen time." | Parent | Moyo's own metric law is the answer: **time-in-app going down while mastery goes up is success** (doc 33 §11), session-length budget doubles as a wellbeing break (§6.1), no streaks or engagement mechanics (§8.7). This is a real differentiator and currently under-used | 06 FOR PARENTS |
| **O4** | "$15.99 when Khanmigo is $4 and ChatGPT is free." | Parent | Don't argue price — change the unit. One price, **every child in the family**, and the things the free tool cannot do: refusal, band voice, reports, guardrails (doc 33 §13 risk row 1; doc 05 §2.2 "why $15 can hold") | 08 START (primary); 06 |
| **O5** | "Will it talk to my 6-year-old like a 6-year-old?" | Parent | The band system, stated plainly — and the honest origin: this was a measured failure that got engineered out (doc 31 §1) | 03; 06 |
| **O6** | "Is this another black box where I see nothing?" | Parent | The session report, shown as an artifact rather than described (doc 34 §2's eight blocks) | 02 THE DESK; 06 |
| **O7** | "Am I signing up for something I can't cancel?" | Parent | Trial length, the card condition, the renewal, and one-tap in-app cancel, stated at the point of decision (doc 05 §1.2, §2.3) | 08 START |
| **O8** | "Are you selling my child's data?" | Parent, school | "No ads, no data sale, ever" is an existing product posture, not a marketing line (doc 33 §8.9) | 09 FOOTER; 06 |
| **O9** | "We already have an LMS / SIS." | School | LTI + roster interop as a first-class line — in **roadmap tense** (doc 25; doc 33 §8.6) | 07 FOR SCHOOLS |
| **O10** | "Is this a real business or a side project?" | Tutoring business, school | Operations depth: CRM, scheduling, payroll, org admin, audit trails, SLAs (doc 33 §7.13; doc 31 §4) | 07 FOR SCHOOLS |
| **O11** | "Will the sales team see my kid's safety incident?" | Business, school | Structurally impossible — the CRM cannot read learner or incident data (doc 33 §6.9; doc 31 §4.2). A rare objection *nobody thinks to raise*, which makes stating it unusually persuasive | 07 FOR SCHOOLS |

**The parent-passing-through test (chapter 07):** a parent scrolling past the
schools chapter must read "serious infrastructure", never "am I supposed to buy
this tier?". This is why the chapter carries **no prices at all** (doc 05 §2.2:
"A parent never sees these numbers") and why its only action is *Talk to us*.

---

## §4 · Chapter research notes

Format per the `user-research` skill: job · evidence · pattern · unsupported
elements · likely failure and prevention. Plus the one message.

---

### 4.1 · Research note: `chapter-01-hero`

**The one message:** *Moyo is a tutor with a heart — and it teaches, it doesn't answer.*

1. **Job:** "In four seconds, tell me what this is and whether it's for my kid."
2. **Evidence:** doc 33 §1 (one-liner, vision, the name = heart) · doc 38 §10
   (NN/g: an unqualified "Get started" stops users, so the CTA is qualified by
   the eyebrow and body line) · doc 38 §6 (voice: warm, plain, specific).
3. **Pattern adopted:** [SSENSE](https://mobbin.com/sites/sections/4de98a06-dbff-4e54-83c6-a301c519bba0)
   — headline set so large the control is ~1/8 its height, so the *sentence* is
   the hero, not the button; [MasterClass](https://mobbin.com/sites/sections/8d2a4681-cdad-4b4b-bc6e-83fd0be35983)
   for slotting the photograph into the notch left by the shorter headline line.
   Full set: `docs/site/mobbin/hero.md`.
4. **Unsupported elements:** none, provided the hero avoids naming 3D Natalie or
   human tutoring in the present tense (§1 ledger). The handwritten annotation
   ("fractions, Tuesday") is a *specificity device*, not a claim — it must read
   as a note a parent wrote, never as product data.
5. **Likely failure & prevention:** a parent reads "AI tutor" and mentally files
   it with the camera-solvers (doc 33 §4's answer-vendor camp) — the exact thing
   Moyo isn't. Prevention: the refusal idea must be inside the hero's body copy,
   not deferred to chapter 03.

---

### 4.2 · Research note: `chapter-02-desk`

**The one message:** *This is what you actually get — real work, real evidence, from a real week.*

1. **Job:** "Show me the product, not an illustration of the product."
2. **Evidence:** doc 34 §2 (the report's eight blocks — headline accomplishment,
   the problems accordion with the child's own answer, mastery movement, the
   facts strip) · doc 24 §1 (capture → crop → coach, the crop is the artifact) ·
   doc 33 §7.6 FR-6.1 (per-skill mastery, visible to guardian).
3. **Pattern adopted:** [Robot.com](https://mobbin.com/sites/sections/f85060f2-e490-4793-b11f-86d41a6a2cd0)
   — deliberately unequal cells, one loud, several quiet, one silent — and
   [Spade](https://mobbin.com/sites/sections/34a2151f-c9b2-4121-b790-8e85202fe9ca)
   for corner crop marks instead of card chrome so a figure reads as printed on
   the page. Full set: `docs/site/mobbin/bento.md`.
4. **Unsupported elements — two, and they matter:**
   - **`Fractions ↑ 18% this week`.** A mastery estimate per skill node is real
     (doc 19), and a guardian mastery-growth line over time is a specced surface
     (doc 27 §guardians). A **weekly percentage delta** is therefore derivable
     but is *not* how doc 34 §2.4 renders movement to a parent — that block uses
     a before→after MasteryBar with words (`Practicing → Getting it`).
     **Decision: the cell must match whatever the guardian surface actually
     renders.** If the product shows words, the cell shows words. Sample data on
     a marketing page that no screen in the product can produce is a defect.
   - **`3:30 PM — MATH WITH NATALIE`.** Scheduling is real on the Operations
     Cloud (doc 33 §7.13) and *Today's Path* is the real family-facing daily
     plan noun (doc 19). A clock-timed AI session in the family shell needs
     verification before it appears as product truth. `[ASSUMPTION — test]`
     Safer equivalent that is certainly true: `TODAY'S PATH · MATH`.
   - The oversized mastery numeral (`87%`) is supportable — mastery estimates are
     numbers on skill nodes (doc 19 §43) — provided it is labelled as mastery of
     a named skill and not as a grade or a score.
5. **Likely failure & prevention:** a bento of six equally-weighted cells reads
   as a feature grid and the parent skims it. Prevention: one cell is the
   annotated homework sheet at large scale (it carries O1 visually), the rest
   are quiet.

---

### 4.3 · Research note: `chapter-03-conversation`

**The one message:** *Moyo never just gives the answer — it teaches the next step.*

1. **Job:** "Prove the thing you claim: show me it refusing."
2. **Evidence:** doc 33 §6.2 (the principle — *"'Just tell me the answer' is the
   demo, and the refusal is the brand"*) · §7.1 FR-1.2 (0 leaks across ≥50
   extraction attempts per band, per release) · §8.4 (no answer mode, ever) ·
   doc 31 §3.1 (output bans) · doc 19 (the learner brief is why she remembers) ·
   doc 33 §7.9 FR-9.2 (no secret channel between tutor and child).
3. **Pattern adopted:** [OpenAI](https://mobbin.com/sites/sections/88a31de0-8431-4a5e-a8df-8761600e6676)
   — two results flush side by side with the *same* input printed verbatim under
   both, which is what makes a comparison honest rather than promotional; and
   [Grammarly](https://mobbin.com/sites/sections/1b0448c5-83f8-4044-a403-e54f30ce316c)
   — the guidance is a second card physically attached to the learner's own
   work. Full set: `docs/site/mobbin/conversation.md`.
4. **Unsupported elements:** the three supporting claims are all supported —
   *knows your child over time* (doc 19 learner brief + mastery store),
   *guardrailed for kids* (doc 31 §3), *every session visible to you* (doc 34).
   One precision note: guardian access to **transcripts** is bounded by the
   retention window (doc 05 §3.2, doc 34 §3). "Every session is visible to you"
   is true at the *session-report* level and must not be written so it promises
   a permanent transcript archive.
5. **Likely failure & prevention:** showing a refusal reads as *withholding* —
   "so it's less useful than ChatGPT." Prevention: the exchange must show the
   refusal **and the teaching move in the same breath**, because the product's
   claim is not "won't answer", it's "teaches the next step instead".

---

### 4.4 · Research note: `chapter-04-world`

**The one message:** *Learning is one human thing — and the name says what we're building for.*

1. **Job:** "Tell me what kind of company this is." (Brand chapter, not a
   feature chapter.)
2. **Evidence:** doc 33 §1 (*Moyo* is Swahili for heart; "Learn it by heart") ·
   doc 16 §3 (rollout `en` → `es` → `sw` → `fr`; **`aiTutorLocales` is a
   separate, safety-gated list — a language ships for learner AI only when its
   classifiers and red-team suite pass**) · doc 33 §9 (English-only content at
   v1) · doc 33 §8.5 (**no EU launch; US market only**).
3. **Pattern adopted:** [Klarna](https://mobbin.com/sites/sections/b8f5cf82-321d-4067-9e21-138351e4c1f3)
   — the map lives in a contained panel with the headline and the *qualifying
   sentence* set outside and above it, so the map is a figure with a caption
   rather than decoration; [Dub](https://mobbin.com/sites/sections/c9831c1e-e14f-4ba8-9f87-c9bafeaddf2b)
   — a card floated over the globe carries the explanation and the only CTA, so
   the globe is a backdrop and not a toy without an exit. Full set:
   `docs/site/mobbin/globe.md`.
4. **Unsupported elements — this is the highest-risk chapter on the page:**
   - ❌ **"Learn Swahili with a conversational tutor" is not defensible and must
     not ship.** Swahili is third in the *UI* rollout queue (doc 16 §3) and
     tutoring in any non-English language is gated behind a per-language safety
     eval that does not exist yet. It is a false product claim.
   - ❌ A globe implying **worldwide availability** contradicts doc 33 §8.5.
   - ✅ What *is* defensible, and is the better chapter anyway: the **name**
     (Swahili for heart), the **language roadmap with its safety gate stated**
     (which converts a limitation into a trust proof), and the **US-at-launch**
     fact stated plainly. Replacement cards are written in the copy deck.
   - The back-layer type `LEARNING HAS NO BORDERS` is acceptable as brand type
     **only** with the availability line in the same viewport. Alone, it reads as
     an availability claim.
5. **Likely failure & prevention:** a parent in Ohio reads a globe as "this
   isn't for me," or a parent abroad reads it as "I can sign up." Prevention:
   the qualifying sentence sits *outside and above* the globe (the Klarna move),
   and the globe never carries a pin the copy can't support.

---

### 4.5 · Research note: `chapter-05-tutor-room`

**The one message:** *You're not talking to a chat box — you're in a room with a tutor who has a name.*

1. **Job:** "Who is actually teaching my child?"
2. **Evidence:** doc 33 §6.5 + §7.4 FR-4.1 (**one voice, everywhere; degraded
   mode is text-only, never a substitute voice**) · FR-4.5 (voice-first is never
   voice-only — captions always on for K–2, replay per message, transcript always
   available) · §7.5 FR-5.1 (full-body Natalie on capable devices with a
   fallback ladder — **Phase 2**) · doc 26 §3–4 (the shared canvas; Natalie
   annotates as a server-authored collaborator, and a highlight is a hint under
   `guided-only`) · doc 19 (progress locks into the learner's path).
3. **Pattern adopted:** [Daylight](https://mobbin.com/sites/sections/b9729ea8-5d0f-4cd1-bd67-77d6f9d835e0)
   — a full-bleed photograph of the thing *in a real hand* with the claim docked
   to the bottom edge of the evidence rather than floated over its middle; and
   [Miro](https://mobbin.com/sites/sections/c759aef1-12cc-4e2e-a1a5-8914ef8732e3)
   — progress as a route with a "you are here", not a percentage. Full set:
   `docs/site/mobbin/tutor-room.md`.
4. **Unsupported elements — three:**
   - **3D embodiment in the present tense.** Phase 2, device-gated, with a
     documented fallback ladder (doc 33 §7.5). Copy must qualify.
   - **Whiteboard collaboration in the present tense.** Specced in doc 26 but
     absent from doc 33 §7's v1 FR list. Qualify or verify.
   - **"Voice that teaches" must never imply the child speaks.** Voice *out* is
     real; voice *in* is a v1 non-goal (doc 33 §8.2). Any phrasing like "talk to
     Natalie" or "just ask out loud" is banned.
   - The bridge line to human tutoring (*real tutors, same room, same heart*) is
     **Phase 2** (doc 33 §12) and must be written as direction, not availability.
5. **Likely failure & prevention:** the chapter oversells a face and the parent
   arrives at an app that (correctly) falls back to chat on their device.
   Prevention: lead with the **voice and the room**, which are v1 truths, and let
   the embodiment be the qualified line rather than the headline.

---

### 4.6 · Research note: `chapter-06-for-parents`

**The one message:** *You will know exactly what happened, in plain words, after every session.*

1. **Job:** "Show me my side of this. What do I actually receive?"
2. **Evidence:** doc 34 §1 (**the perception gap is the design constraint**:
   ~88–91% of parents believe their child is at or above grade level against a
   national proficiency benchmark near 30% at 8th grade — *cite as the reason
   reports are honest, never as a Moyo claim*) · doc 34 §2 (the eight blocks;
   the two never-conflated axes, movement and position; the banned content —
   ability praise, grade predictions, comparisons to other children, and
   **safety content, which travels its own channel**) · doc 31 §3.1 and §5.2
   (the guardian incident view: what happened → what the tutor did → what's next
   → talk about it) · doc 33 §7.9 FR-9.3 (controls) · §11 (the metric law) ·
   doc 05 §2.2 (pricing).
3. **Pattern adopted:** [The New Yorker](https://mobbin.com/sites/sections/7b8ee3c6-6b9d-4058-a654-295734f0233a)
   — a full-bleed photograph carrying an inset kicker/headline/deck stack placed
   low where the image is quietest, so the photo is never cropped for text; and
   [Shop](https://mobbin.com/sites/sections/581a9bd7-9e53-487a-a8ad-1f63b99768d1)
   — four trust claims in a 2×2 with hairline rules, each linking to the actual
   policy, **no shields and no badges**, so the claim is checkable. Full set:
   `docs/site/mobbin/parents.md`.
4. **Unsupported elements:** none, with three constraints. (a) The perception-gap
   statistic belongs to Learning Heroes/Gallup and may only be used with
   attribution, or — better on a landing page — paraphrased without a number.
   (b) Safety copy must not promise that nothing will ever go wrong; the
   product's actual promise is *fail-closed, and you are told* (doc 33 §6.3,
   doc 31 §4.3). (c) Price copy must carry the trial's card condition.
5. **Likely failure & prevention:** the chapter turns into a wall of reassurance
   adjectives ("safe, trusted, secure") which reads as exactly the thing it is
   trying to disprove. Prevention: **show the report**. One real artifact
   outperforms every adjective, and the checkable-link discipline from the Shop
   pattern keeps the trust block honest.

---

### 4.7 · Research note: `chapter-07-for-schools`

**The one message:** *There is a serious operations platform under this — let's talk.*

1. **Job (business):** "Can this run my business and make my tutors better?"
   **Job (school):** "Will this fit our LMS and survive our privacy review?"
2. **Evidence:** doc 33 §7.13 (CRM, resource-major calendar, payouts, org admin)
   · §7.13 FR-13.2 + §6.9 + doc 31 §4.2 (**the CRM never reads learner or
   incident data — lint-enforced import boundary**) · doc 25 §1–2 (LTI 1.3 /
   Advantage, NRPS, deep-linking, AGS passback; the answer-key index boundary;
   AI scores non-authoritative by default) · doc 05 §5.2–5.3 (payroll v1
   calculates, M2 executes) · doc 33 §8.6 (**LTI is a v1 non-goal**) · doc 05
   §2.2 (**business prices live only in the Ops shell and on business-facing
   surfaces — a parent never sees them**).
3. **Pattern adopted:** [ElevenLabs](https://mobbin.com/sites/sections/b8117dc7-f766-4526-85df-309d2197c918)
   — one kicker, one three-line sentence, one button occupying the top half with
   nothing else; **refusing to list features at all is what makes it read as
   infrastructure rather than a plan tier**, which is precisely the
   parent-passing-through requirement. [Aside](https://mobbin.com/sites/sections/c603fba7-9f62-4666-9109-26f84f912d90)
   supplies the ordering: kicker → promise → qualifier → contact button → *then*
   the capability list. Full set: `docs/site/mobbin/schools.md`.
4. **Unsupported elements — two:**
   - **"Automated tutor payouts" in the present tense.** v1 computes pay runs and
     produces statements; money movement to tutors is M2 (doc 05 §5.3). Write
     the capability as *payroll*, or qualify.
   - **LMS/LTI in the present tense.** Doc 33 §8.6 makes it a v1 non-goal.
     Roadmap tense, and it belongs in a "talk to us" conversation.
   - **No price may appear in this chapter**, including "from $19/mo" or a
     "starting at" line. This is a structural rule, not a styling preference.
5. **Likely failure & prevention:** the chapter becomes a second pricing section
   and a browsing parent bounces off tier anxiety. Prevention: the ElevenLabs
   move — one sentence, one button, no grid — and the O11 line (the CRM cannot
   read learner data) as the memorable proof point.

---

### 4.8 · Research note: `chapter-08-start`

**The one message:** *One price, every child, thirty days to decide.*

1. **Job:** "Tell me what it costs and what happens at the end of the trial —
   without making me hunt."
2. **Evidence:** doc 05 §2.2 (**$11/mo early bird, $15.99/mo regular, all
   children included; 30-day trial, card-required**) · §1.2 (ROSCA + state
   auto-renewal law: full terms at the point of decision, affirmative consent,
   in-app cancel as easy as signup, reminder before the charge — **build to the
   California standard everywhere**) · §2.3 (reminder ≥3 days before first
   charge; in-app cancel one tap from Billing) · §2.2 (**early-bird eligibility
   must be a real, stated limit — first N founding families or a hard printed
   date — never a fake countdown**) · doc 33 §7.11 FR-11.2 (business tiers
   structurally invisible to guardians) · CLAUDE.md (no price on a learner
   surface, ever).
3. **Pattern adopted:** [Reflect](https://mobbin.com/sites/sections/e42c8789-8709-4d25-8778-8f18b6cb3719)
   — model stated in plain words *before* the number, billing condition small and
   immediately beside the figure, short two-column inclusion list, trial button
   last; [Craft](https://mobbin.com/sites/sections/1d233811-a8c1-46dc-9b29-eb4c12feba62)
   for the strikethrough geometry only — struck price immediately left of the new
   price, same baseline, same size class, so the comparison is one eye stop;
   [Squarespace](https://mobbin.com/sites/sections/e19368ea-a33a-4b0a-8490-79c227a9c5ad)
   — the trial condition as one small unboxed line between headline and button.
   Full set: `docs/site/mobbin/pricing.md`.
4. **Unsupported elements — the early-bird terms, and this is a blocker:**
   - The Mobbin pass returned **no honest early-bird pattern in the entire
     index** — every discount found was either a manufactured deadline (Craft's
     "Limited Time Only") or an eligibility programme (Greptile's "apply because
     you qualify"). Only the eligibility framing survives doc 05's ban list.
   - **Doc 05 does not decide the actual N or the actual date.** So the copy deck
     ships the early-bird line with an explicit placeholder token and this note:
     **the site cannot launch the early-bird card until an owner fills in a real
     cap or a real end date.** Inventing either would itself be the dark pattern
     doc 05 §2.2 refuses.
   - **"Up to 4 learners" or any learner cap is wrong** — doc 05 §2.2 says *all
     children included* on both family plans.
   - **No comparison table, no annual/monthly toggle above the fold, no
     pre-selected larger commitment** (all three refused in the Mobbin pass;
     Headspace's pre-checked annual is the named anti-pattern).
5. **Likely failure & prevention:** the parent starts a trial without
   understanding that a card is required and that it renews — which is both the
   ROSCA exposure and, worse, a trust break in a product whose entire thesis is
   trust. Prevention: the card condition and the renewal sit in body-size text
   directly above the button (the Squarespace placement, the ClassPass
   *refusal* — never the palest type on the page).

---

### 4.9 · Research note: `chapter-09-footer`

**The one message:** *Real company, US rules, reachable humans.*

1. **Job:** "Find the legal answer, the other audience's page, or a person."
2. **Evidence:** doc 33 §9 (amended COPPA eff. Apr 22 2026 — verifiable parental
   consent, expanded PII; FERPA-aligned handling for school data; state
   student-privacy law; CA SB 243 duties for known minors) · §6.8 (**US framing,
   never EU**) · §8.9 (no third-party ads or data sale, ever) · doc 16 (i18n
   architecture ready, English at v1 — so the footer is locale-ready but shows no
   language switcher until a locale ships).
3. **Pattern adopted:** [In Common With](https://mobbin.com/sites/sections/f1844604-7696-4970-b30e-43a7669e9ee1)
   — lead the footer with a way to reach a human *before* the sitemap;
   [Mixpanel](https://mobbin.com/sites/sections/1d050a7d-840b-4110-bb1b-303ae9fd76e8)
   — a "prefers reduced motion" control living in the footer as an available
   control rather than an accessibility claim on a policy page (doc 33 §9 already
   requires reduced-motion be honored including the 3D layer). Full set:
   `docs/site/mobbin/footer.md`.
4. **Unsupported elements:** any "GDPR compliant" or EU-privacy line is banned
   outright. A "COPPA certified" claim would be false — the posture is
   *compliance by design plus counsel checkpoints* (doc 33 §16.6: the consent
   flow is reviewed by counsel), not a certification.
5. **Likely failure & prevention:** compliance theatre — badges and seals that a
   school's reviewer will ask us to substantiate. Prevention: the Shop/Grain
   discipline from the parents chapter applies here too — every trust line links
   to the actual policy, and a real contact address is part of the trust
   statement.

---

## §5 · Assumptions to test

Everything here is a **claim the site would like to make that the pack does not
yet establish**. None may reach production copy until closed.

| # | Assumption | How to close it |
| --- | --- | --- |
| A1 | The family shell shows a clock-timed scheduled AI session (`3:30 PM — MATH WITH NATALIE`) | Check the family-shell surface inventory; otherwise use `TODAY'S PATH` (doc 19) |
| A2 | The guardian surface renders mastery movement as a weekly percentage delta | Check doc 34 §2.4's MasteryBar render against doc 27's guardian growth line; the bento must mirror whichever it is |
| A3 | Shared whiteboard / annotation is in the Phase 1 GA scope | Doc 26 is specced but absent from doc 33 §7's FR list — owner decision |
| A4 | The early-bird cap (N founding families) or the hard end date | **Owner input required.** Blocks the chapter-08 card |
| A5 | Human tutoring is bookable by a family at Phase 1 | Doc 33 §12 puts Ops Cloud beta at Phase 2 — if so, chapter 05's bridge line stays directional |
| A6 | "Every session visible to you" survives the transcript retention window | Confirm what a guardian sees after TTL (doc 34 §3 `evidenceRefs` degrade to "source expired") |
| A7 | Which trial CTA converts: "Start learning" vs "Start your 30-day trial" | Post-launch test; doc 05 §1.1 ranks trial *structure* as the #2 LTV lever and price changes last |

---

## §6 · The test before launch

Reuse the doc 38 §10 protocol, retargeted from the app front door to the site.
Moderated, 5 guardians of K–8 learners (2 of them the "I hate signing up for
things" segment), remote, 30 minutes, their own phone — the smallest study that
reliably finds the big problems.

- **Tasks (think-aloud, no help):** (1) "Scroll this page and tell me what Moyo
  does." (2) "Would it do your child's homework for them? How do you know?"
  (3) "What will you pay, and when?" (4) "What would you receive as a parent?"
  (5) Show chapter 07 alone: "Is this page for you?"
- **Measures:** unprompted mention of *guides / doesn't give answers* after task
  1 (target ≥ 4/5); price **and** trial terms stated correctly (target 5/5 —
  same bar doc 38 §10 sets for FD-13); chapter 07 correctly identified as *not
  for me, and that's fine* (target 5/5 — this is the O-test for the
  parent-passing-through rule); scroll depth to chapter 08.
- **Synthesis:** affinity-map per chapter ID; anything that fails for 2+
  participants is a P1 against that chapter before launch.

---

## §7 · Evidence register

**Pack (binding):** doc 33 PRD §1 vision · §2 problem · §4 positioning · §5
personas · §6 principles · §7 scope/FRs · §8 non-goals · §9 NFRs · §11 metric
law · §12 rollout · §13 risks · §16 acceptance · doc 05 §1.1 trial research,
§1.2 the ROSCA/ARL floor, §2.2 pricing and the two-audience wall, §2.3 paywall
rules, §5 money movement phasing · doc 31 §1 the measured reading-level failure,
§2 the band system, §3 guardrails and the S-ladder, §4 incident lifecycle and
SLAs, §5 the guardian view · doc 34 §1 the perception gap, §2 the eight blocks
and the never-contains list, §4 the evidence-first pipeline, §5 surfaces · doc
38 §6 voice, glossary, error taxonomy, §7 accessibility law, §10 the research
base and the 5-guardian test · doc 19 metric hierarchy, mastery model, ESSA tier
ladder · doc 24 capture flow · doc 25 LMS interop · doc 26 the room's three
planes · doc 27 chart surfaces · doc 16 the locale model and the
safety-gated `aiTutorLocales`.

**External, via the pack only (never restated as a Moyo measurement):** the
guided-vs-answer tutoring evidence and the tutoring meta-analysis (doc 33 §2);
the LLM reading-level studies (doc 31 §1); the Learning Heroes/Gallup perception
gap (doc 34 §1); RevenueCat/Adapty subscription benchmarks (doc 05 §1.1); NN/g
onboarding findings (doc 38 §10).

**Structural patterns:** `docs/site/mobbin/{hero,bento,conversation,globe,tutor-room,parents,schools,pricing,footer}.md`
— adopted and refused moves, with the refusal reasoning that keeps the pricing
chapter clean.

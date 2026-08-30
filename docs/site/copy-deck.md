# Copy deck — the Moyo marketing site (`/`)

<!--
Every string on the landing page, plus nav, meta and the alt-text register.
Written to the `ux-copy` skill: doc 38 §6 voice, glossary and error taxonomy
govern; sentence case; buttons start with a verb.
Strings are keyed for `packages/i18n` (namespace `site.*`) — no string is typed
inline in a component. Keys here are the contract; the catalog file is owned by
the build lane, not this doc.
SOT: this file · docs/site/research.md · docs/38-front-door-and-flow.md §6 ·
docs/pack/05 §2.2 (pricing law) · docs/pack/33 §8 (non-goals = copy law)
SOT-KEYWORDS: site copy deck landing strings marketing hero pricing footer meta alt-text
-->

**Owner:** copy lane · **Status:** foundation, pre-build
**Reads with:** `docs/site/research.md` (why each chapter says what it says)

---

## §0 · How to read this deck

Every row is **key · final string · surface · voice/register**.

- **Sentence case everywhere.** Display-caps are a *typographic* treatment applied
  by the design lane to a sentence-case source string — the string itself is
  never authored in caps, or it breaks translation and screen readers.
- **Buttons start with a verb** and name the outcome. ≤ 20 characters in English.
- **Register column** uses: `display` (the one big line), `deck` (standfirst),
  `body`, `caption`, `label`, `button`, `legal`, `annotation` (the handwritten
  layer), `alt`.
- 🚩 in a row means the string is on the flag list in **§12** and needs an
  owner decision before it ships. `{TOKEN}` means a real value must be supplied —
  never invented here.

### 0.1 · Copy law for this site (from doc 33 §8 and doc 05 §2.2)

Never write, in any variant, anything that implies:
**answers** given rather than taught · **social features** between learners ·
**voice input** from the child · **emotion recognition** ·
**EU/GDPR** compliance · **worldwide availability** ·
**business or school prices** anywhere a parent reads ·
**ads or data sale** in any form.

### 0.2 · Glossary compliance (doc 38 §6)

Applied as written: **Log in** (never Sign in) · **Learner** (product UI) ·
**Guardian** (adult product UI; "parent or guardian" in legal copy) ·
**Session** (never lesson or chat) · **Natalie** (never "the AI") ·
**Grown-up** (learner-band copy only — no learner-band copy exists on this site).

**One documented deviation, requiring sign-off (see §12 F-11):** marketing copy
addressed to a parent says **"your child"**, not "your learner". Doc 38 §6
reserves *child* for legal and consent copy because the product UI must be
neutral across home and school. A landing page speaking to a parent about their
own kid is a different speech act, and "your learner" reads as institutional
where warmth is the entire proposition. `Learner` is retained wherever the site
refers to the role rather than to the reader's own child.

---

## §1 · Navigation, global CTA, and meta

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.nav.skip` | Skip to main content | Skip link, first focusable element | `label` |
| `site.nav.brand` | Moyo AI | Wordmark lockup, links to `/` | `label` |
| `site.nav.brand.aria` | Moyo AI — home | Accessible name for the wordmark link | `label` |
| `site.nav.how` | How it works | Nav, anchors to chapter 03 | `label` |
| `site.nav.parents` | For parents | Nav, anchors to chapter 06 | `label` |
| `site.nav.schools` | For schools | Nav, anchors to chapter 07 | `label` |
| `site.nav.pricing` | Pricing | Nav, anchors to chapter 08 | `label` |
| `site.nav.login` | Log in | Nav, secondary action | `button` |
| `site.nav.cta` | Start learning | Nav, the one primary CTA (14 chars) | `button` |
| `site.nav.menu.open` | Open menu | Mobile nav trigger | `button` |
| `site.nav.menu.close` | Close menu | Mobile nav dismiss | `button` |

**The one CTA.** `Start learning` is the only primary action on the page and it
carries the same label in the nav, the hero and chapter 08. Doc 38 §6's rule —
*the same action keeps the same name through the whole flow* — extends to the
handoff: the screen it lands on is the front door (FD-01), so the site's verb and
the app's first screen must not disagree. `Talk to us` (chapter 07) is a
different action for a different audience and is never styled as the primary.

### 1.1 · Meta and Open Graph for `/`

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.meta.title` | Moyo AI — a tutor that won't give your child the answer | `<title>`, 55 chars | `label` |
| `site.meta.description` | Moyo is an AI tutor for K–12. Your child photographs the homework and gets coached to the next step — never handed the answer. You get a plain report after every session. | `<meta name="description">`, 165 chars | `body` |
| `site.og.title` | Learning has a heart | OG/Twitter title — the brand line, not the SEO line | `display` |
| `site.og.description` | An AI tutor for K–12 that coaches instead of answering, speaks at your child's grade level, and writes you a report after every session. | OG/Twitter description, 137 chars | `body` |
| `site.og.image.alt` | A child's handwritten subtraction homework on a kitchen table, with a note in the margin reading "You're close. Look at this part again." | OG image alt | `alt` |
| `site.meta.locale` | en_US | `og:locale` — single locale until a second ships (doc 16) | — |

---

## §2 · Chapter 01 · HERO

> **The one message:** Moyo is a tutor with a heart — and it teaches, it doesn't answer.

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.hero.eyebrow` | An AI tutor for kindergarten through 12th grade | Above the headline; qualifies the CTA per NN/g (doc 38 §10) | `label` |
| `site.hero.headline` | Learning has a heart. | The page's single display moment; set in caps by treatment | `display` |
| `site.hero.body` | Moyo coaches your child through the work instead of doing it for them. Point the camera at the homework and Natalie teaches the next step — at your child's grade level, in one familiar voice, with every session written up for you. | Hero body, 2 sentences | `deck` |
| `site.hero.cta.primary` | Start learning | Primary button | `button` |
| `site.hero.cta.secondary` | See how Moyo teaches | Text link, anchors to chapter 03 | `button` |
| `site.hero.annotation` | fractions, Tuesday | Shantell handwritten annotation on the photograph | `annotation` |
| `site.hero.annotation.aria` | Handwritten note: fractions, Tuesday | Accessible name; the annotation is content, not decoration | `alt` |
| `site.hero.trust` | One plan. Every child in your family. | Optional quiet line under the CTAs | `caption` |
| `site.hero.scroll` | Scroll to see a real week | Scroll affordance label | `caption` |

**Alternative considered and rejected for `site.hero.body`:** *"Homework help
that doesn't do the homework."* — sharper, but it defines Moyo by a negative and
a parent's first read becomes "so it does less." The shipped line leads with the
positive verb (*coaches*) and puts the refusal second, which is the same ordering
chapter 03 uses.

**Register note:** no exclamation marks. Doc 38 §6 permits them in learner-band
copy only, and this site has no learner-band surface.

---

## §3 · Chapter 02 · THE DESK (the bento)

> **The one message:** This is what you actually get — real work, real evidence, from a real week.

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.desk.eyebrow` | The desk | Section kicker | `label` |
| `site.desk.headline` | A week, as your child actually lived it. | Section headline | `display` |
| `site.desk.body` | Every cell here is something Moyo shows you for real: the problem your child photographed, the answer they gave, and where the skill moved. | Section body | `deck` |
| `site.desk.disclaimer` | Example report. Real reports are built from your child's own work. | One caption line at the foot of the grid | `caption` |
| `site.desk.cell.mastery.value` | 87% | Oversized numeral cell | `display` |
| `site.desk.cell.mastery.label` | Reading for meaning · mastery | Label beneath the numeral | `label` |
| `site.desk.cell.movement` | Sentence structure — practicing → getting it | Movement cell (**recommended**; mirrors doc 34 §2.4's MasteryBar words) | `label` |
| `site.desk.cell.movement.caption` | This week | Caption under the movement cell | `caption` |
| `site.desk.cell.movement.numeric` 🚩 | Sentence structure ↑ 18% this week | Movement cell, **conditional variant** — ships only if the guardian surface really renders a weekly percentage delta (F-02) | `label` |
| `site.desk.cell.homework.annotation` | You're close. Look at this part again ↑ | Annotation over the photographed homework sheet | `annotation` |
| `site.desk.cell.homework.caption` | Photographed on the kitchen table, then worked through step by step. | Caption for the homework cell | `caption` |
| `site.desk.cell.path` | Today's path · Reading, then math | Schedule cell (**recommended**; `Today's Path` is the real family-facing noun, doc 19) | `label` |
| `site.desk.cell.path.timed` 🚩 | 3:30 PM — Reading with Natalie | Schedule cell, **conditional variant** — ships only if a clock-timed family session surface exists (F-03) | `label` |
| `site.desk.cell.report.headline` | Maya solved 4 two-digit subtraction problems on her own — including one she'd missed twice before. | The report's headline block, quoted from doc 34 §2.1 | `body` |
| `site.desk.cell.effort` | She tried three strategies on the hardest one and stuck with it after two misses. | The effort-moment block, quoted from doc 34 §2.5 | `body` |
| `site.desk.cell.status.independent` | Solved on their own | Status pill — verbatim from doc 34 §2.3 | `label` |
| `site.desk.cell.status.helped` | Solved with help | Status pill — verbatim from doc 34 §2.3 | `label` |
| `site.desk.cell.status.working` | Still working on it | Status pill — verbatim from doc 34 §2.3 | `label` |
| `site.desk.cell.next` | Next: regrouping with three digits | The what's-next block | `label` |
| `site.desk.cell.home` | Ask her to show you the borrowing trick with coins. | The help-at-home block, quoted from doc 34 §2.7 | `body` |
| `site.desk.cell.facts` | 22 min · 6 problems · 4 on their own | The facts strip — de-emphasised by law (doc 34 §2.8: minutes are context, never an achievement) | `caption` |

**Pattern note for the build:** the sample child is **Maya** throughout, because
doc 34 uses that name in its own examples. Do not invent a second sample family,
and never present sample content as a testimonial or a named customer.

---

## §4 · Chapter 03 · THE CONVERSATION

> **The one message:** Moyo never just gives the answer — it teaches the next step.

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.conversation.eyebrow` | The conversation | Section kicker | `label` |
| `site.conversation.headline` | Moyo never just gives the answer. It teaches the next step. | Section headline — the binding law, stated verbatim | `display` |
| `site.conversation.body` | Ask outright and it still won't. The refusal is the product, so it's tested before every release — at least fifty attempts to extract an answer in each grade band, and one leak fails the release. | Section body | `deck` |
| `site.conversation.body.alt` 🚩 | Ask outright and it still won't. The refusal is the product, so it's red-teamed before every release — and a single leak fails the release. | Alternative without the numeral, if publishing the test count is unwanted (F-04) | `deck` |
| `site.conversation.demo.label` | A 3rd-grade session | Label above the exchange | `label` |
| `site.conversation.demo.learner` | just tell me the answer | The learner's turn, set as typed | `body` |
| `site.conversation.demo.natalie` | I won't give you that one. But I'll get you there. Look at 47 minus 19. Can you take 9 away from 7? | Natalie's turn — written to the 3–5 band frame (≤ 12-word sentences, concrete, one question) | `body` |
| `site.conversation.demo.caption` | Same problem, same child. Moyo hands back the step, not the answer. | Caption printed under the exchange | `caption` |
| `site.conversation.claim.1.title` | Natalie remembers | Claim 1 | `label` |
| `site.conversation.claim.1.body` | Every session updates what Moyo knows about your child's skills, so tomorrow starts where today stopped. | Claim 1 body | `body` |
| `site.conversation.claim.1.arrow` | not from scratch | Hand-drawn arrow annotation | `annotation` |
| `site.conversation.claim.2.title` | Guardrailed for kids | Claim 2 | `label` |
| `site.conversation.claim.2.body` | Natalie won't keep secrets, won't steer your child away from talking to you, and won't play doctor or therapist. If something serious comes up, tutoring stops. | Claim 2 body (doc 31 §3.1, §3.2 S4) | `body` |
| `site.conversation.claim.2.arrow` | and you're told | Hand-drawn arrow annotation | `annotation` |
| `site.conversation.claim.3.title` | Every session comes back to you | Claim 3 | `label` |
| `site.conversation.claim.3.body` | After each session you get a short written report: what your child worked on, what they answered, and where the skill moved. | Claim 3 body | `body` |
| `site.conversation.claim.3.arrow` | in plain words | Hand-drawn arrow annotation | `annotation` |

**Why the demo shows the teaching move.** Research §4.3: a refusal shown alone
reads as withholding. The exchange must contain the refusal *and* the next step
in the same reply, because the claim isn't "won't answer", it's "teaches
instead". Any shortened variant that drops Natalie's second and third sentences
is a regression.

**Banned variants for this chapter:** anything of the form "get the answer,
explained", "answers with working", "shows you how to get there **and** what it
is". All three imply an answer arrives eventually. It doesn't.

---

## §5 · Chapter 04 · A WORLD OF LEARNING

> **The one message:** Learning is one human thing — and the name says what we're building for.

**This chapter carries the page's biggest correctness risk.** Region cards may
claim only what §1 of the research doc supports. The Swahili-tutoring card in the
original brief is not shippable (§12 F-01); defensible replacements are below.

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.world.backtype` | Learning has no borders | Back-layer display type; set in caps by treatment | `display` |
| `site.world.headline` | Wherever curiosity begins. | Section headline over the globe | `display` |
| `site.world.body` | Moyo means heart in Swahili. That's not decoration — the thing that keeps a child going isn't a subject and it isn't a country. | Section body, set outside and above the globe (the Klarna caption move) | `deck` |
| `site.world.availability` | Moyo is available in the United States, in English, today. | The qualifying sentence — **must sit in the same viewport as the back-layer type** | `caption` |
| `site.world.card.name.title` | The name | Card 1 | `label` |
| `site.world.card.name.body` | Moyo is Swahili for heart. "Learn it by heart" is the whole product in four words. | Card 1 body | `body` |
| `site.world.card.language.title` | English today. Spanish next. | Card 2 | `label` |
| `site.world.card.language.body` | A language becomes a tutoring language only when Moyo's safety checks pass in that language — not when the translation is finished. | Card 2 body (doc 16 §3: `aiTutorLocales` is gated separately from `uiLocales`) | `body` |
| `site.world.card.bands.title` | Four ways of speaking | Card 3 | `label` |
| `site.world.card.bands.body` | K–2, 3–5, 6–8, 9–12. A first grader and a fifth grader don't share a language, so Moyo doesn't hand them one. | Card 3 body (doc 31 §2.1) | `body` |
| `site.world.card.us.title` | Built to US rules | Card 4 | `label` |
| `site.world.card.us.body` | COPPA, FERPA and state student-privacy law shape how a child's data is handled here. That's the market Moyo serves first. | Card 4 body | `body` |

**Rejected — do not ship, in any variant:**

| Rejected string | Why |
| --- | --- |
| Learn Swahili with a conversational tutor | False. Swahili is third in the *interface* locale queue (doc 16 §3) and tutoring in any non-English language is gated behind per-language safety evals that do not exist. |
| Tutoring in every language, everywhere | Contradicts doc 33 §9 (English-only content at v1) and §8.5 (US market only). |
| Millions of learners worldwide / any learner count | No such figure exists in the pack. Inventing one is out of bounds. |
| Learning has no borders — *as the only line in the viewport* | Alone it reads as an availability claim. It ships only alongside `site.world.availability`. |

---

## §6 · Chapter 05 · THE TUTOR ROOM

> **The one message:** You're not talking to a chat box — you're in a room with a tutor who has a name.

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.room.eyebrow` | The tutor room | Section kicker | `label` |
| `site.room.headline` | Meet Natalie. | Section headline | `display` |
| `site.room.body` | Natalie is the tutor your child works with. One voice, always the same one — and if that voice can't run, the session continues in text. Moyo never swaps in a stranger. | Section body (doc 33 §6.5, §7.4 FR-4.1) | `deck` |
| `site.room.voice.title` | A voice that teaches, and captions that keep up | Feature 1 | `label` |
| `site.room.voice.body` | Natalie speaks at your child's grade level. Captions are on by default for the youngest learners, any line can be replayed, and the transcript is always there. | Feature 1 body (doc 33 §7.4 FR-4.5) | `body` |
| `site.room.canvas.title` | You work on the same page | Feature 2 | `label` |
| `site.room.canvas.body` 🚩 | Your child's homework sits on a shared canvas. Natalie can point at a step, highlight the part worth another look, and mark what's done — a hint, never a solution. | Feature 2 body — **present tense pending F-05** | `body` |
| `site.room.canvas.body.safe` | Moyo is built around your child's own work: the page they photographed is the page the session happens on. | Feature 2 body, the variant that is true today regardless of F-05 | `body` |
| `site.room.progress.title` | Progress locks into the path | Feature 3 | `label` |
| `site.room.progress.body` | What happens in a session updates your child's skills map, and tomorrow's path is built from it. | Feature 3 body (doc 19) | `body` |
| `site.room.embodiment.title` | A tutor with a face | Feature 4 — **future tense by law** | `label` |
| `site.room.embodiment.body` | Natalie is being built as a full 3D tutor — head, body, expression — arriving first on devices that can carry her. Where a device can't, the session steps down to voice, then to text. Nothing breaks. | Feature 4 body (doc 33 §7.5 FR-5.1, Phase 2) | `body` |
| `site.room.bridge.title` | Real tutors, same room, same heart. | The human-tutoring bridge line | `display` |
| `site.room.bridge.body` | Human tutors are coming into the same room Natalie works in — the same page, the same reports, the same rules. | Bridge body — **future tense by law** (doc 33 §12, Phase 2) | `body` |
| `site.room.clip.play` | Play with sound | Control on a baked Natalie clip | `button` |
| `site.room.clip.muted` | Muted until you tap. | Caption beside the clip (doc 38 §7: no autoplay audio) | `caption` |
| `site.room.clip.pause` | Pause | Control on a playing clip | `button` |
| `site.room.clip.reduced` | Motion is reduced, so this is a still. | Shown in place of the loop when the OS requests reduced motion | `caption` |

**Voice-input guard.** Every string in this chapter describes Natalie *speaking*.
Nothing here — and nothing anywhere on the site — may suggest the child speaks
back. Banned phrasings, checked at review: "talk to Natalie", "just ask out
loud", "say it and she'll help", "hands-free", "voice chat".

**One-voice guard.** The site plays real baked Natalie audio or it plays nothing.
There is no stand-in voice, no text-to-speech placeholder, and no "voice coming
soon" audio mock. Silent loops are the correct fallback.

---

## §7 · Chapter 06 · FOR PARENTS

> **The one message:** You will know exactly what happened, in plain words, after every session.

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.parents.eyebrow` | For parents | Section kicker | `label` |
| `site.parents.headline` | You'll actually know how it went. | Section headline | `display` |
| `site.parents.deck` | Most homework apps hand you a streak and a smiley face. Moyo writes you a short, honest note after every session: what your child worked on, what they answered, what moved, and one thing to try at the table tonight. | Magazine standfirst | `deck` |
| `site.parents.report.label` | What's in a session report | Label over the report artifact | `label` |
| `site.parents.report.block.1` | What we worked on | Report block label, from doc 34 §2 | `label` |
| `site.parents.report.block.2` | The problems | Report block label | `label` |
| `site.parents.report.block.3` | How it went | Report block label | `label` |
| `site.parents.report.block.4` | A moment of effort | Report block label | `label` |
| `site.parents.report.block.5` | What's next | Report block label | `label` |
| `site.parents.report.block.6` | How to help at home | Report block label | `label` |
| `site.parents.honesty.title` | Honest, not flattering | Trust cell 1 | `label` |
| `site.parents.honesty.body` | Moyo won't tell you your child is doing great when they aren't. How far they came and where that sits against their grade are two separate lines, never blended into one comfortable number. | Trust cell 1 body (doc 34 §2.4 — the two axes are never conflated) | `body` |
| `site.parents.safety.title` | Safety, in plain language | Trust cell 2 | `label` |
| `site.parents.safety.body` | Natalie won't keep secrets from you, won't ask your child for personal details, and won't give medical, therapy or legal advice. If a safety check goes down, tutoring pauses instead of guessing. If something serious comes up, tutoring stops, your child sees words written by people rather than by a model, and you're told — with a person on it within two hours for the most urgent cases. | Trust cell 2 body (doc 31 §3.1, §3.2 S4, §4.3; doc 33 §6.3) | `body` |
| `site.parents.safety.link` | Read the safety policy | Link out of the trust cell — the claim stays checkable | `button` |
| `site.parents.screentime.title` | Less time, not more | Trust cell 3 | `label` |
| `site.parents.screentime.body` | There are no streaks and no nudges to come back. Time in the app going down while your child's skills go up is what Moyo counts as working. | Trust cell 3 body (doc 33 §11 metric law, §8.7) | `body` |
| `site.parents.controls.title` | The controls are yours | Trust cell 4 | `label` |
| `site.parents.controls.body` | Turn the voice off. Cap how long a session runs. Set the reading level if grade isn't the right fit. Ask for your child's data to be deleted, and it goes. | Trust cell 4 body (doc 33 §7.9 FR-9.3) | `body` |
| `site.parents.controls.link` | Read the privacy policy | Link out of the trust cell | `button` |
| `site.parents.price.title` | One price, every child | Price honesty block inside the parents chapter | `label` |
| `site.parents.price.body` | $11 a month as an early-bird family, $15.99 a month at the regular price. One family plan, every one of your children included. No ads. Nothing about your child sold, ever. | Price honesty body (doc 05 §2.2; doc 33 §8.9) | `body` |
| `site.parents.price.link` | See what's included | Text link to chapter 08 | `button` |

**Rejected — do not ship:**

| Rejected string | Why |
| --- | --- |
| 9 in 10 parents think their child is on grade level. Only 3 in 10 are. | The perception-gap finding belongs to Learning Heroes/Gallup (doc 34 §1). It may be cited with attribution in long-form content; on a landing page an unattributed statistic reads as a Moyo measurement. `site.parents.deck` carries the same idea without a number. |
| Your child is completely safe with Moyo. | Unfalsifiable, and it contradicts the product's actual promise, which is *fail-closed, and you are told*. |
| See every message your child ever sends. | Overstates guardian visibility: transcript access is bounded by the retention window (doc 05 §3.2, doc 34 §3). The report-level promise is the honest one. |

---

## §8 · Chapter 07 · FOR SCHOOLS & TUTORING BUSINESSES

> **The one message:** There is a serious operations platform under this — let's talk.

**No price appears in this chapter.** Not a tier, not a "from", not a range.
Doc 05 §2.2: *a parent never sees these numbers.* This is structural.

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.schools.eyebrow` | For schools and tutoring businesses | Section kicker | `label` |
| `site.schools.headline` | The operations cloud under the tutoring. | Section headline | `display` |
| `site.schools.body` | Moyo runs the business, not only the lesson: families and leads, scheduling, tutor pay, org administration — with the learning platform your tutors and students already use sitting on top of it. | The three-line sentence that carries the whole offer (the ElevenLabs move) | `deck` |
| `site.schools.cta` | Talk to us | Primary action for this audience; never styled as the page's primary | `button` |
| `site.schools.cta.caption` | We'll ask what you run today and what's breaking. | Caption under the CTA | `caption` |
| `site.schools.capability.crm` | CRM — leads, families and enrolments in one place | Capability list, placed *after* the CTA (the Aside ordering) | `label` |
| `site.schools.capability.scheduling` | Scheduling — a calendar built around tutors, rooms and sessions | Capability list | `label` |
| `site.schools.capability.payroll` | Payroll — pay rules per tutor and per service, computed from completed sessions, with statements and export | Capability list (doc 05 §5.2: v1 **computes**) | `label` |
| `site.schools.capability.admin` | Org administration — roles, scoped queues, and an append-only audit trail on every incident | Capability list (doc 31 §4.1) | `label` |
| `site.schools.capability.lms` | LMS and LTI — launch from the LMS you already run, sync rosters, pass grades back | Capability list — **roadmap tense required, see `site.schools.roadmap`** | `label` |
| `site.schools.wall.title` | Your sales tools can't read a child's session | The O11 proof point — the strongest line in this chapter | `label` |
| `site.schools.wall.body` | The CRM and the learning record are separated in the code, not by policy. A safety incident can never become a sales signal. | Proof body (doc 33 §6.9, §7.13 FR-13.2; doc 31 §4.2) | `body` |
| `site.schools.pedagogy.title` | Guided-only isn't a setting | Second proof point, aimed at the district reviewer | `label` |
| `site.schools.pedagogy.body` | No district, school or teacher can switch Moyo into answering mode, because there isn't one. Teacher material and answer keys never enter the index the student tutor can read. | Proof body (doc 25 §2.1, §2.2) | `body` |
| `site.schools.roadmap` | LMS and LTI integration and automated tutor payouts are on the roadmap — talk to us about timing. | Roadmap line, placed with the capability list | `caption` |
| `site.schools.contact.name` | Your name | Contact form field label | `label` |
| `site.schools.contact.email` | Work email | Contact form field label | `label` |
| `site.schools.contact.org` | School, district or business | Contact form field label | `label` |
| `site.schools.contact.role` | What you do there | Contact form field label | `label` |
| `site.schools.contact.message` | What are you trying to solve? | Contact form field label | `label` |
| `site.schools.contact.submit` | Send message | Contact form submit | `button` |
| `site.schools.contact.success` | Message sent. We'll reply within two business days. | Success state (doc 38 §6: name the state) | `body` |
| `site.schools.contact.error.email` | Enter a valid email, like name@example.com. | Validation error — verbatim from doc 38 §6's error taxonomy | `body` |
| `site.schools.contact.error.server` | Something went wrong on our side. Nothing was lost — try again in a moment. | Server error — verbatim from doc 38 §6's error taxonomy | `body` |

**Rejected — do not ship:**

| Rejected string | Why |
| --- | --- |
| Plans from $19/mo · Studio · Scale | Business pricing on a surface a parent reads. Doc 05 §2.2 and doc 33 §7.11 FR-11.2 make this structural, not cosmetic. |
| Automated payouts to your tutors | Present tense for a Phase M2 capability (doc 05 §5.3). "Payroll" is the v1-true noun; payouts belong in `site.schools.roadmap`. |
| Trusted by schools across the country | No customer names, no counts, no testimonials exist. Fabricating social proof is out of bounds. |
| LTI-certified | 1EdTech certification is pursued *after* launch + AGS are solid (doc 25 §2.6). Claiming it now would be false. |

---

## §9 · Chapter 08 · START (pricing and the CTA)

> **The one message:** One plan, every child, thirty days to decide.

**Structure (from `docs/site/mobbin/pricing.md`):** model in plain words →
the number with its condition attached → short inclusion list → trial terms →
button. One card. No comparison table, no monthly/annual toggle above the fold,
nothing pre-selected.

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.start.eyebrow` | Start | Section kicker | `label` |
| `site.start.headline` | One plan. Every child. | Section headline | `display` |
| `site.start.model` | Moyo has one family plan, and it covers every child in your family. | The plain-words model line, printed *before* the number (the Reflect move) | `deck` |
| `site.start.plan.name` | Family plan | Card title | `label` |
| `site.start.price.badge` | Early bird | Badge on the card | `label` |
| `site.start.price.struck` | $15.99 | Struck price, same baseline and size class as the live price (the Craft geometry) | `display` |
| `site.start.price.current` | $11 | Live price | `display` |
| `site.start.price.period` | /mo | Qualifier, attached to the numeral on the same baseline — never a separate line of small print | `label` |
| `site.start.price.eligibility` ✅ | Founding-family price, open until 1 November 2026. | **RESOLVED 2026-08-28** — Mike set a hard date, which is what doc 05 §2.2 requires ("a real, stated limit … or a hard date printed on the paywall — never a fake countdown"). A date and not a countdown: the Mobbin pass found no honest early-bird pattern in the index, every one being a manufactured deadline. When the date passes the offer is gone. | `body` |
| `site.start.price.lock` | Your price stays $11 a month for as long as you stay subscribed. | Grandfathering, stated plainly (doc 05 §2.2) | `body` |
| `site.start.price.regular` | Regular price is $15.99 a month. | The un-discounted price, stated at the same level as the offer | `body` |
| `site.start.included.title` | What's included | Inclusion list heading | `label` |
| `site.start.included.1` | Every child in your family — 3, 4, or more, one price | Inclusion item (doc 05 §2.2: all children included; the `3, 4, or more` wording makes the one-price model concrete without capping the family) | `label` |
| `site.start.included.2` | Homework help from a photo — coached, never answered | Inclusion item | `label` |
| `site.start.included.3` | Natalie, one voice, speaking at your child's grade level | Inclusion item | `label` |
| `site.start.included.4` | A written report after every session | Inclusion item | `label` |
| `site.start.included.5` | Safety guardrails, and you're told when something happens | Inclusion item | `label` |
| `site.start.included.6` | No ads, and nothing about your child sold | Inclusion item | `label` |
| `site.start.trial` | 30 days free. A card is required to start, we'll email you before the first charge, and you can cancel anytime in the app. | The trial line — body-size text directly above the button (the Squarespace placement) | `body` |
| `site.start.cta` | Start learning | Primary button | `button` |
| `site.start.secondary` | Run a school or a tutoring business? Talk to us. | Secondary text link to chapter 07 — a link, never a second card | `button` |
| `site.start.legal` | After the 30-day free trial, the family plan renews monthly at $11 (early bird) or $15.99 (regular) until you cancel. Cancel anytime in the app. | The auto-renewal disclosure, at AA contrast in real text — never the faintest type on the page | `legal` |
| `site.start.learner.note` | Prices and plans live with the grown-ups. Your child never sees a price in Moyo. | One caption, doubling as a differentiator (CLAUDE.md: no paywall on a learner surface, ever) | `caption` |

**Rejected — do not ship:**

| Rejected string | Why |
| --- | --- |
| Offer ends in 04:12:39 | A countdown. Doc 05 §2.2 names manufactured scarcity as the dark pattern this product refuses, and the Mobbin pass refused Craft's version of it for the same reason. |
| Limited time only | Same, without even a real deadline behind it. |
| Up to 4 learners included | Contradicts doc 05 §2.2 — both family plans include **all** children. Any learner cap is a pricing error, not a copy choice. |
| Best value · Most popular | Ranking labels need a comparison, and there is exactly one plan. |
| Start your free trial — no credit card needed | False for the family plan (doc 05 §2.2: card required). |
| Cancel anytime, no questions asked | "No questions asked" implies a refund posture nobody has agreed to. `site.start.trial` states the real mechanism. |

---

## §10 · Chapter 09 · FOOTER

> **The one message:** Real company, US rules, reachable humans.

| Key | String | Surface | Register |
| --- | --- | --- | --- |
| `site.footer.contact.title` | Talk to a person | Contact band, placed *above* the sitemap (the In Common With move) | `label` |
| `site.footer.contact.email` | info@moyolearn.com | Real address required — none is invented here | `label` |
| `site.footer.col.product` | Product | Column heading | `label` |
| `site.footer.link.how` | How it works | Sitemap link | `label` |
| `site.footer.link.parents` | For parents | Sitemap link | `label` |
| `site.footer.link.schools` | For schools | Sitemap link | `label` |
| `site.footer.link.pricing` | Pricing | Sitemap link | `label` |
| `site.footer.col.trust` | Trust | Column heading | `label` |
| `site.footer.link.safety` | Safety | Sitemap link | `label` |
| `site.footer.link.privacy` | Privacy | Sitemap link | `label` |
| `site.footer.link.childrens` | Children's privacy | Sitemap link | `label` |
| `site.footer.link.terms` | Terms | Sitemap link | `label` |
| `site.footer.col.company` | Company | Column heading | `label` |
| `site.footer.link.about` | About | Sitemap link | `label` |
| `site.footer.link.contact` | Contact | Sitemap link | `label` |
| `site.footer.link.login` | Log in | Sitemap link — glossary-bound (doc 38 §6) | `label` |
| `site.footer.compliance` | Moyo is built for families and schools in the United States. Children's privacy follows COPPA, school data is handled on a FERPA-aligned basis, and state student-privacy requirements apply. | Compliance line — **US framing only** (doc 33 §6.8) | `legal` |
| `site.footer.consent` | A parent or guardian creates every learner account and gives consent before a child uses Moyo. | Consent posture (doc 33 §7.9 FR-9.1); "parent or guardian" is the legal-copy form per doc 38 §6 | `legal` |
| `site.footer.noads` | No ads. No data sold. Not now, not later. | The posture line (doc 33 §8.9) | `legal` |
| `site.footer.motion` | Reduce motion | A real toggle in the footer, not a claim on a policy page (the Mixpanel move) | `button` |
| `site.footer.locale` | English (US) | Locale control — **rendered only once a second locale ships** (doc 16) | `label` |
| `site.footer.tagline` | Learn it by heart. | Tagline beside the lockup | `display` |
| `site.footer.legal` | © {YEAR} Moyo AI. | Copyright line | `legal` |

**Rejected — do not ship:** `GDPR compliant` · `EU privacy` · any EU regulation
(doc 33 §6.8 and §8.5 make this a hard never) · `COPPA certified` or any
certification seal (the posture is compliance by design plus counsel review —
doc 33 §16.6 — not a certification) · trust badges and shield icons of any kind
(the Shop/Campsite discipline: a claim that links to the real policy beats a
badge that links nowhere).

---

## §11 · Alt-text register (photography)

The photography is **real families in real homes**. The alt-text register has to
match, or the alt text will quietly reintroduce the stock-photo register the
art direction is refusing.

**Rules.**
1. Describe **what is happening**, not what it is meant to make you feel. No
   "happy", "excited", "smiling", "engaged".
2. Name the **work**: the sheet, the pencil, the tablet propped against the
   cereal box. The homework is the subject; the child is in the room with it.
3. **Never** "a child smiling at a laptop", "family using technology together",
   "student learning online", or any variant.
4. Age is described only when it carries meaning ("a first grader", not "a cute
   6-year-old"). No adjectives about appearance.
5. Purely decorative texture gets `alt=""` and is removed from the accessibility
   tree. Handwritten annotations are **content**, never decoration — they get
   real alt text (see `site.hero.annotation.aria`).
6. Length ≤ 125 characters. If a photo needs more, it is doing a caption's job
   and should have a caption.

| Key | Alt string | Surface |
| --- | --- | --- |
| `site.alt.hero` | A subtraction worksheet on a kitchen table, pencil resting across it, a phone held above to photograph one problem. | Hero photograph |
| `site.alt.desk.sheet` | A photographed homework page with one problem circled and a note pointing at the second step. | Bento homework cell |
| `site.alt.desk.hands` | A child's hand writing the second line of a long-division problem, the first line already crossed out. | Bento detail cell |
| `site.alt.conversation` | A tablet propped against a stack of books on a dining table, homework page beside it. | Conversation chapter |
| `site.alt.room.natalie` | Natalie, Moyo's tutor, mid-sentence, turned toward the work rather than the camera. | Tutor-room still or clip poster |
| `site.alt.room.together` | A parent and a child sitting on the same side of a table, both looking at the same page. | Tutor-room secondary |
| `site.alt.parents.report` | A session report on a phone: a headline sentence, a list of problems, and a short note about what to try at home. | Parents chapter |
| `site.alt.parents.evening` | A parent reading a phone at a kitchen counter while a child works at the table behind them. | Parents chapter secondary |
| `site.alt.schools.desk` | A tutoring centre's front desk with a paper schedule taped beside a monitor. | Schools chapter |
| `site.alt.start` | A worksheet, a pencil and a phone side by side on a table, nothing else in frame. | Start chapter |

**Also banned in alt text:** brand names of devices, "AI", "app", and any word
the visible copy is forbidden from using (`answer`, `voice chat`, `worldwide`).

---

## §12 · Flags — strings I believe carry overpromise or correctness risk

Flagging is a required output. Every row needs an owner decision before launch;
🚩 rows in the tables above map to these IDs.

| ID | String / claim | Risk | Recommendation |
| --- | --- | --- | --- |
| **F-01** | "Learn Swahili with a conversational tutor" (chapter 04, from the brief) | **False claim.** Swahili is third in the *interface* locale queue (doc 16 §3); tutoring in any non-English language is gated behind per-language safety evals that don't exist. Content is English-only at v1 (doc 33 §9) | **Do not ship.** Replaced by `site.world.card.name` + `site.world.card.language`, which turn the same idea into a trust proof |
| **F-02** | `site.desk.cell.movement.numeric` — "Fractions ↑ 18% this week" | Doc 34 §2.4 renders movement to a guardian as a before→after MasteryBar with words, not a weekly percentage. Sample data no product screen can produce is a defect | Ship `site.desk.cell.movement` (words). Use the numeric variant only if the guardian surface genuinely renders a weekly delta |
| **F-03** | `site.desk.cell.path.timed` — "3:30 PM — Math with Natalie" | Scheduling is real on the ops side (doc 33 §7.13); a clock-timed **family-side** AI session is unverified. *Today's Path* (doc 19) is the confirmed noun | Ship `site.desk.cell.path` unless the family shell is confirmed to schedule sessions |
| **F-04** | `site.conversation.body` — "at least fifty attempts to extract an answer in each grade band" | True today (doc 33 §7.1 FR-1.2) but it publishes a test threshold. Once printed, lowering it becomes a public regression | Ship it — it is the most credible sentence on the page — but log it as a public commitment. `site.conversation.body.alt` is the numeral-free fallback |
| **F-05** | `site.room.canvas.body` — shared canvas in the present tense | Doc 26 specs the shared canvas, but it is **absent from doc 33 §7's v1 FR list**. Present tense may outrun the build | Use `site.room.canvas.body.safe` until the canvas is confirmed in Phase 1 scope |
| **F-06** | `site.start.price.eligibility` — `{EARLY_BIRD_LIMIT}` | **Blocker.** Doc 05 §2.2 requires honest scarcity — a real cap ("first N founding families") or a hard printed date — and explicitly refuses a "limited" price that never ends. **Doc 05 does not decide N or the date.** The Mobbin pass found *no honest early-bird pattern in the entire index* — every returned discount was a manufactured countdown or an eligibility programme | **Owner input required before this card can launch.** Do not invent a number or a date. If neither is decided, ship the regular price alone rather than an unbounded "early bird" |
| **F-07** | `site.room.embodiment.*` and `site.room.bridge.*` | 3D Natalie and human tutoring are **Phase 2** (doc 33 §12) | Keep both in future tense exactly as written. Any edit into the present tense is a regression |
| **F-08** | `site.schools.capability.lms` | LTI is an explicit **v1 non-goal** (doc 33 §8.6) | Only ships adjacent to `site.schools.roadmap`. Never as a present-tense capability, never as "certified" |
| **F-09** | `site.conversation.claim.3.body` / `site.parents.report.*` — "every session comes back to you" | True at the *report* level; guardian access to raw transcripts is bounded by the retention window (doc 05 §3.2, doc 34 §3) | Copy as written is safe. Watch for drift into "see every message" — already rejected in §7 |
| **F-10** | `site.parents.safety.body` — "a person on it within two hours" | Real (doc 31 §4.3: S4 → 2h SLA, on-call paged) but it publishes an operational SLA to consumers | Ship, and make sure support/ops know the number is public. Consider "within hours, not days" if ops won't stand behind the figure publicly |
| **F-11** | Site-wide use of **"your child"** rather than "your learner" | Deliberate deviation from doc 38 §6's glossary, which reserves *child* for legal and consent copy | Requested as a **scoped exception for parent-addressed marketing copy**, documented in §0.2. `Learner` retained for the role. Needs an owner's yes |
| **F-12** | Sample content (`Maya`, `87%`, `22 min · 6 problems · 4 on their own`) | Illustrative data can read as a customer result or a benchmark | `site.desk.disclaimer` must render inside the same section. Never attribute sample content to a named real family, and never phrase it as a testimonial |
| **F-13** | `site.parents.deck` — "Most homework apps hand you a streak and a smiley face." | A comparative claim about competitors, unnamed and uncited | Defensible as characterisation of a category doc 33 §4 describes, but it is the one competitive jab on the page. Cut it if legal prefers zero comparative claims |

---

## §13 · Localization notes (doc 38 §6, doc 16)

- **Buttons ≤ 20 characters in English.** German runs ~30% longer.
  `Start learning` (14) and `Talk to us` (10) both hold.
- **Never concatenate.** `site.footer.legal` interpolates `{YEAR}`;
  `site.start.price.eligibility` interpolates `{EARLY_BIRD_LIMIT}`;
  `site.footer.contact.email` interpolates `info@moyolearn.com`. Any possessive
  built from a name goes through ICU, never string addition.
- **Prices are formatted, not typed.** `$11` and `$15.99` render through
  `useFormatter` with the currency from the catalog (doc 16 §4) — the literal
  glyphs above are the English-US rendering, not the stored value.
- **Grade bands don't translate.** `K–2 / 3–5 / 6–8 / 9–12` are US grade
  structures; a second locale needs a mapping decision, not a translation.
- **Display strings are authored in sentence case.** `Learning has a heart.`,
  `Learning has no borders` and `Moyo AI` are set in caps by *treatment*. A
  locale whose script has no case must still receive a readable string.
- **The handwritten layer needs a fallback.** Shantell annotations
  (`site.hero.annotation`, the chapter-03 arrows) must degrade to the body face
  in any locale the handwritten font does not cover — and they carry real
  accessible names, because they are content.
- **Compliance copy is not translated, it is rewritten.** `site.footer.compliance`
  names US law. A future locale needs its own legal review, never a machine pass.
- **No language switcher renders until a second locale ships** (doc 16 §3, doc 33
  §9). `site.footer.locale` stays behind that gate.

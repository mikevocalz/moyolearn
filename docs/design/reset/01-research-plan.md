# Design reset — usability research plan

<!--
The study that decides whether the six flagship compositions ship. Its
hypotheses are not invented here: each one is an open question already recorded
in docs/design/mobbin/<screen-id>.md, where the reference pass could not settle
it from precedent.

SOT: docs/design/mobbin/*.md (open questions) · docs/design/moyo-design-reset-v2-brief.md §7 and §12 ·
     docs/design/reset/00-repo-baseline.md · docs/pack/33-moyo-learn-prd.md (non-goals) ·
     docs/pack/34-session-summary-reports.md (movement vs position) ·
     docs/pack/31-grade-voice-safety-incidents.md (voice gate)
SOT-KEYWORDS: research plan usability children bands protocol first-click completion
              comprehension coppa ferpa consent moderation
-->

Status: draft · Date: 2026-09-05 · Branch: `design/reset-v2`

## 1 What this study decides

Six compositions go to observation. Each carries one question the Mobbin pass could not answer from precedent, because no shipped app in the reference set had solved it under Moyo's constraints. The study answers those; it does not re-litigate the art direction or the nav law.

| Composition | Hypothesis under test | Where the question came from |
|---|---|---|
| Learner Today K–2 (Scene) | A 5–7 year old can identify and start the day's work from artwork alone, without reading, and can tell afterwards that something changed | `mobbin/learner-today-k2.md` Q1, Q2 — whether in-scene labels are discoverable or read as scenery, and whether one scene change registers as a consequence |
| Learner Today 6–12 (Invitation) | An 11–18 year old chooses to start from the hero rather than the due list, and reads the time cost before the topic | `mobbin/learner-today-6-12.md` — the cost line is the highest-value element, untested |
| Tutor Room + Reveal (Focus) | A child accepts a proactive nudge as help rather than interruption, and the completion sentence is understood as evidence of what they did | `mobbin/tutor-room.md` Q1, Q3, Q4 — Natalie's presence during work has no precedent in the reference set at all |
| Parent Home + child detail | A parent reads the status band as movement ("she got further") and not as rank ("she is behind"), and can name the child's next step | `mobbin/parent-home.md` Q2, Q5, Q6 — multi-child homes, trajectory bar vs counts, and the nothing-happened week |
| Teacher class workspace | A teacher can find the student who needs attention in one pass, and can say what evidence the suggested intervention rests on | `mobbin/teacher-class.md` — the headline pill carries a claim, and a claim has to survive being questioned |
| Tutor Today | A tutor can prepare for the next session without leaving the day view, and knows which sessions still need a summary | `mobbin/tutor-today.md` — whether the segmented day shrinks visibly as work completes |

Two questions cut across every composition and are asked in every session:

- **Where am I / what matters now / what can I do / what changed after I acted.** A composition that cannot be answered on all four in a five-second look has failed its own contract, regardless of task completion.
- **Does anything here feel like pressure?** Asked of children in their own words at the end. `docs/pack/33-moyo-learn-prd.md` bans engagement-pressure mechanics; this is the check that the ban held in practice rather than only in the component list.

## 2 Sample

| Audience | n | Recruitment constraint |
|---|---|---|
| Learners K–2 (ages 5–7) | 5 | Mixed reading ability. At least two who cannot yet read a full sentence unaided — the K–2 composition claims to work without reading, and a sample of confident readers cannot test that claim |
| Learners 3–5 (ages 8–10) | 5 | At least two who have used a tablet learning app before and two who have not |
| Learners 6–8 (ages 11–13) | 5 | — |
| Learners 9–12 (ages 14–18) | 5 | At least two who study on a phone rather than a tablet |
| Guardians | 5 | At least two with more than one child in the household. The multi-child status band is an open question and a single-child sample cannot answer it |
| Teachers | 3 | At least one teaching a class of 25+ |
| Tutors | 3 | At least one who tutors across more than one subject |
| School representatives | 2 | One operations, one instructional leadership |

Guardians are recruited independently of the children, not as their parents. A parent watching their own child fail a task changes both sessions.

## 3 Protocol

### 3.1 Consent and safeguarding — minors

US framing only: COPPA and FERPA, plus applicable state student-privacy law.

- Written parental consent before scheduling, covering what is recorded, who sees it, and how long it is kept. A separate line for each recording type; consent to audio is not consent to video.
- **No video of a child's face is recorded by default.** The default capture is screen plus audio plus a moderator tally sheet. A face recording requires a specific opt-in and a stated purpose, and is not needed for any measure in §5.
- Verbal assent from the child at the start, in their own words, and again if they seem uncomfortable. A child may stop without giving a reason and without the session being described as incomplete to them.
- A parent or guardian is present or immediately reachable for every session with a child under 13.
- Retention: raw recordings deleted 30 days after the findings are written up. Tally sheets and anonymised quotes are kept; names are not.
- No live account data. Every session runs on a seeded account whose data is fictional.

### 3.2 Per-audience session shape

| Audience | Length | Setting | Device |
|---|---|---|---|
| K–2 | 20 min, hard stop | Home or familiar room, parent in the room | Tablet, held or on a table as the child prefers |
| 3–5 | 25 min | Home or school | Tablet |
| 6–8 | 30 min | Home or school | Phone, and tablet for one task |
| 9–12 | 30 min | Wherever they normally study | Their own phone size class |
| Guardians | 45 min | Remote acceptable | Phone, plus web for the child-detail task |
| Teachers | 45 min | Remote acceptable | Web, plus phone for one task |
| Tutors | 45 min | Remote acceptable | Web |
| School reps | 45 min | Remote | Web |

Every session runs the same shape: warm-up, tasks in fixed order, comprehension probe, closing question. Task order is fixed rather than randomised because the compositions are sequential in real use and an out-of-order start would test a flow nobody has.

### 3.3 Task prompts

Prompts are spoken to children and never shown as text. K–2 wording is separated because the composition's whole claim is that reading is not required, and a written prompt would hand the child the reading the screen avoids.

**K–2 (spoken, one sentence, no nouns from the UI):**
1. "Have a look at this. What do you think is here?" *(orientation — no task)*
2. "Show me what you would do first."
3. "Can you find where you take a picture of your homework?"
4. *(after the activity completes)* "Is anything different now? Show me."
5. "If you wanted to stop, what would you do?"

**3–5 (spoken):**
1. "Take a look. What is this screen for?"
2. "Show me what you are supposed to do today."
3. "How long do you think that will take?"
4. "Find something you finished already."
5. "Show me where you would go to see everything in maths."

**6–12 (spoken or shown, learner's choice):**
1. "What is this screen telling you?"
2. "Start whatever you would actually start right now, and tell me why that one."
3. "How much time is this asking of you?"
4. "What is coming after this one?"
5. "Something on here is due. Find it."

**Guardians:**
1. "This is your home screen. What has happened with your child this week?"
2. "Is that better or worse than last week? How can you tell?"
3. "What does the app want you to do about it?"
4. "Show me the actual work she did."
5. *(multi-child accounts)* "Which of your children needs you most right now?"
6. "It says she is still working on unlike denominators. How would you check that is true?"

**Teachers:**
1. "This is your class. Who needs you today?"
2. "Why that student?"
3. "The app is suggesting something for them. What is it basing that on?"
4. "Assign it. Then tell me what happens next for that student."
5. "One of your students' families asks why their child was flagged. Show me what you would show them."

**Tutors:**
1. "What does your day look like?"
2. "Get ready for your next session."
3. "Which of today's sessions still needs something from you?"
4. "Session's over. Finish it off."

**School representatives:**
1. "Where is your rollout up to?"
2. "Something is stuck. Find it."
3. "What can you actually do about it from here?"

### 3.4 Success definitions

Every task's success is an observable behaviour, never a rating.

| Task | Succeeds when |
|---|---|
| K–2 #2 | The child taps the primary slab or the scene object it names, first tap, without prompting |
| K–2 #4 | The child points at or names the thing that changed, unprompted, within 10 seconds |
| 3–5 #3 | The stated estimate is within the duration shown on screen, showing the number was read and understood as time |
| 6–12 #2 | The learner starts from the hero and the stated reason references the topic or the time cost, not "it was at the top" |
| 6–12 #5 | The due item is found without opening a second tab |
| Guardian #2 | The answer names a change over time. An answer phrased as a level, a rank, or a comparison to other children is a **failure of the composition**, not of the parent |
| Guardian #4 | The parent reaches the child's actual work in two taps or fewer |
| Guardian #6 | The parent names the evidence the claim rests on, not the app's authority |
| Teacher #3 | The teacher names the attempts or objective the suggestion cites, without being pointed at it |
| Teacher #5 | The teacher reaches a defensible artefact rather than a score |
| Tutor #3 | The tutor identifies the sessions missing a summary from the day view alone |

## 4 Moderating children

- **Do not lead.** No "have you tried…", no pointing, no looking at the answer. A moderator's gaze is a hint.
- **Do not rescue before the stall threshold.** 30 seconds of no action, or a stated "I don't know", whichever comes first. Then one neutral re-read of the prompt. Then one offer to move on. A rescue before that threshold destroys the first-click measure, which is the measure that matters most.
- **A wrong turn is data, and the child must not be told it was wrong.** "Okay" is the whole response.
- **Distress ends the session.** Fidgeting, going quiet, looking to the parent, asking how much longer — stop, thank them, and mark the session partial. A partial session is a finding, not a loss.
- **Never ask a child to evaluate.** No "did you like it", no smiley scales. The closing question is "was anything on there annoying or bossy?", which is the pressure check in a child's vocabulary.
- Sessions with children under 8 are moderated by one person only. Two adults watching a 5-year-old work is a performance, not a task.

## 5 Measures

| Measure | Definition | Recorded as |
|---|---|---|
| First click | The first deliberate interactive target touched after the prompt ends. A scroll is not a click; an accidental touch corrected within one second is not a click | Target name, or `none` if the participant asked a question first |
| Completion | Task success per §3.4, unaided | `unaided` / `after one re-read` / `not completed` |
| Wrong turns | Distinct destinations entered that are not on any path to success, before success or abandonment | Count plus the destination names |
| Recovery | Whether the participant returned to a productive path without help after a wrong turn | `self` / `prompted` / `no` |
| Comprehension | Whether the participant can restate what the screen said in their own words, probed **after** the task with a question that does not contain the answer | Verbatim quote plus a `yes` / `partial` / `no` verdict |
| Pressure check | Response to the closing question | Verbatim quote |

Comprehension is probed with "what is this telling you?" and never with "does this mean X?". A yes/no question about a specific reading hands over the reading.

The tally sheet is one row per task per participant with those six columns plus a free-text observation column. It is filled during the session, not reconstructed from a recording — a measure that depends on rewatching does not get taken.

**Preference is recorded in the quote column and is never counted.** A participant saying they like a screen is not evidence the screen worked, and a participant disliking a screen they completed every task on is not a defect. Preference statements are reported in a separate section titled "what people said", with a standing note that they carry no verdict.

## 6 Analysis

Findings are ranked by what they block, not by how many participants hit them.

- **Must-fix** — a task with unaided completion below 4 of 5 in any band; any guardian answering §3.4 Guardian #2 in terms of rank; any child who cannot answer "what changed"; any participant who reads a screen as pressure. One participant is enough for the last two: a single child reading a streak into the design means the design has a streak in it.
- **Should-fix** — completion achieved but with two or more wrong turns, or comprehension `partial` for a majority of a band.
- **Watch** — a single wrong turn with self-recovery; an isolated slow first click.

**A composition returns to design when it collects any must-fix finding.** It does not proceed to the vertical slice on the strength of the other five tasks passing.

Findings are written against the composition and the Mobbin open question they answer, so the reference doc closes its own question rather than leaving it open forever.

## 7 Accessibility coverage in the sample

Coverage is assigned to specific participants at recruitment, not hoped for.

| Condition | Where |
|---|---|
| Largest system text size | One participant per learner band, and one guardian |
| Screen reader | One teacher and one guardian, on the adult web surfaces, using the reader they already use |
| Reduced motion enabled | One participant per learner band |
| 3D off and voice off | Two Tutor Room sessions, one K–2 and one 6–12. `docs/design/moyo-design-reset-v2-brief.md` §12 requires the signature activity to work in this state, so it is observed rather than asserted |
| Touch target check | The K–2 sessions, on the smallest supported phone as well as the tablet |

A participant may carry more than one condition. A condition that produces no observation because the session ran fine is recorded as a pass, not omitted.

## 8 Schedule and what must exist first

Before session 1:

1. All six compositions in Storybook with the full state matrix — default, new account, empty, loading, failure, offline, denied, large text, reduced motion, both dials, all bands. A composition missing its failure state cannot be tested for what happens when a read fails, which is where the guardian sessions go.
2. A device build with seeded accounts per band, and a way to reset an account between sessions in under a minute.
3. Consent forms approved, and the recording setup verified to capture screen and audio without face.
4. Tally sheets printed, one per participant per composition.
5. A pilot session per audience with someone off the team, to catch prompts that do not survive being spoken aloud.

Effort: two weeks of scheduling and recruitment running in parallel with build, one week of sessions, one week of analysis and write-up. The 20 child sessions are the constraint — they cannot be stacked more than three to a day without the moderator's attention degrading, and moderator fatigue shows up as leading.

## 9 Threats to validity, to be stated when the findings are reported

- **Every navigation proposal in the brief is an untested hypothesis.** Doc 36 is the binding nav law; the alternates are candidates. A study that finds an alternate works has produced a case for an ADR, not an approved route change.
- **Mobbin captures are versioned snapshots, not live apps.** A reference showing how Duolingo behaved when it was captured is not evidence of how it behaves now, and none of the take/refuse calls in `docs/design/mobbin/*.md` are claims about a current competitor.
- **Seeded data is friendlier than real data.** Real accounts have gaps, stale reads, and children who did nothing for two weeks. The nothing-happened week is deliberately in the guardian task set for this reason, but seeded messiness is still curated messiness.
- **Children perform for adults.** A child who completes every task under observation may not open the app unprompted at home. This study measures whether the composition is legible, not whether it is wanted.
- **Sample sizes are qualitative.** Five per band finds the problems that most participants hit; it does not measure how many users would hit them, and no percentage should be reported from it.
- **The moderator knows the design.** Every session is run by someone who wants it to work. The stall threshold and the no-leading rule exist because of that, and a second observer should spot-check two sessions per audience for leading.

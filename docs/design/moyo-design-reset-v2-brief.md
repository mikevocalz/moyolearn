# Moyo Learn — Design Reset v2: research, diagnosis, direction, build brief

> **Read `docs/design/reset/00-repo-baseline.md` first.** Four of §1's counts were verified against the tree on 2026-09-05 and are wrong: `tokens.ts` is 1346 lines not 939; `packages/ui` is 317 files not "180+"; `apps/web-vite/public/images` holds 36 renditions of 7 photographs, not 24 photos; and the repo is not artwork-free — `packages/avatar/assets/` holds a rigged, textured Natalie. The baseline also records that four of §6's eleven proposed primitives already have a working neighbour in the kit. The direction below stands; those counts do not.

Prepared 2026-09-05 against `github.com/mikevocalz/moyolearn` @ `cdcf4cf3a59c5769c15c710a606c32756fc5e9f5` (cloned and read; no files changed, no build run, no authenticated session exercised).
Supersedes the v1 brief ("Moyo Learning Studio", 2026-09-05 draft) where the two disagree. Where this brief and `docs/pack/*` disagree, the pack still wins unless an ADR changes it.

Evidence boundary: source-code audit + Mobbin captures + public competitor documentation. Mobbin screens are captured versions, not live apps. Every navigation proposal here is a prototype hypothesis for testing with real children/adults, not a tested finding.

---

## 0. The one-paragraph verdict

The app is flat because it has no art system, not because it lacks a style name. The repo already has a strong token system (`packages/theme/tokens.ts`, hard-offset slabs, role accents in OKLCH, band touch targets, Hot/Cool dial), a large UI kit, a nav law (doc 36), and a full Flow-Contract taxonomy. What it does **not** have is product artwork on any app surface: `apps/mobile/assets/images` holds five files (icon, splash, adaptive icon); `packages/ui` has an `Image` wrapper and no `Scene`, `SubjectArt`, `Manipulative`, `Figure`, or `Paper` primitive; every home is `Heading → Text → PressScale/Card list`. Meanwhile the marketing site in `apps/web-vite` already carries an approved, richer direction — **Tactile Learning Modernism** (60% editorial neubrutalism / 25% tactile learning materials / 15% spatial magic, with real family/classroom photography and paper grain) — that the app never inherited. The complementary language Mike asked for already exists in his own repo; the reset is to bring it into the product, make it do pedagogical work, and compose screens around tasks instead of card stacks.

---

## 1. What the repo actually shows

| Finding | Where | Consequence |
|---|---|---|
| No product imagery on app surfaces. 5 image files in the mobile app (icon/splash). 7 photographs, 36 renditions, exist only in `apps/web-vite`. | `find` over the repo | "Flat" is literal: there is nothing to look at except type, borders, and icons. |
| No illustration/scene primitives in the kit. `Image.tsx` is a 27-line SolitoImage wrapper. No `Scene`, `Figure`, `SubjectArt`, `Manipulative`, `EvidenceStrip`, `MissionPath`. | `packages/ui/*` | Screens cannot be art-directed until the primitives exist; a Card restyle will not fix it. |
| Learner Today (3–12) = greeting + purpose line + one `bg-primary` continue card + due-work strip + fixture plan. K–2 hub = greeting + `Avatar name="Natalie"` (no image source) + three icon tiles. | `packages/app/features/home/student-home-content.tsx`, `learner-hub-content.tsx` | Both are feature launchers. Neither shows the child *the thing they are learning*. Fixture data (`studentHomeFixtureFor`) still drives the resume card. |
| Guardian home = `WhatsNextCard` + cards. Guardian tabs Home/Reports/Alerts/Family; source states no messaging surface exists. | `guardian-home-screen.tsx`, `(guardian)/(tabs)/_layout.tsx` | Adult role gets the child's card grammar, quieter. No evidence composition, no status hero. |
| School mobile parked at Overview-only pending persona/entitlement definition. | `(school)/_layout.tsx` | Scope gap, not styling. |
| The site's design language is documented and richer than the app's: `docs/site/tokens.md` ("60% Editorial Neubrutalism · 25% Tactile Learning · 15% Spatial Magic"), `MoyoPaperGrain`, `MoyoEyebrow` as the African structural rhythm carrier, `docs/site/component-inventory.md`. | `docs/site/*` | Two visual products under one brand. The app should inherit the site's system, not invent a third. |
| Typography: Archivo Black (display) · Space Grotesk (sans) · Chivo Mono (data). Single control radius 0.375rem, tool-enforced. Shadows `4px 4px 0 0 border-strong`, no blur. | `tokens.ts`, `I-token-system.md` | Keep all of it. It is the neubrutalist half and it is good. |
| Role-accent law: one accent moment per screen, allowlisted slots, primary button always ink-filled. | doc 36 §5, `check-role-accent.mjs` | Artwork must carry colour *inside itself*; UI chrome stays disciplined. This is the reconciliation rule for "colourful but not loud". |
| Comments in feature files are long, defensive, and narrate past bugs ("It was `items-end`…", "This used to…"). | every feature file read | A skeptical reader reads this as LLM-authored. Comment hygiene is part of the reset's code gate. |
| Every home has `FadeIn` staggers; motion is entrance-only. `audit/motion/before|after` exists. | feature files | Motion never shows a consequence (press → move → update). |
| Learner routes protected; Hot dial applied in learner shell; pane ban on learner screens (ADR-107); AdaptivePanes promoted. | `(learner)/_layout.tsx`, ADRs | Preserve. Do not re-litigate. |

---

## 2. Competitive intelligence that changed since the v1 brief

**Khan Academy "Reimagined" (piloted 2025–26, all district partners for back-to-school 2026).** Learner dashboard shows classes, mastery progress, and the next thing to do; a **Learner Queue** replaces the flat assignment list with **Daily / Weekly / Unit Missions**; students can toggle a **Path view** (recommended for younger learners, visual) or a **List view**; gems and classroom rewards were added; teacher and admin dashboards filter by week / teacher / school / class / student.
Sources: https://blog.khanacademy.org/meet-the-new-khan-academy-classroom-experience/ · https://support.khanacademy.org/hc/en-us/articles/46056261189773 · https://blog.khanacademy.org/built-in-the-open-how-pilot-districts-shaped-the-reimagined-khan-academy/ · https://www.edtechinnovationhub.com/news/khan-academy-redesigns-classroom-platform-as-ai-tools-move-further-into-daily-teaching

**Khanmigo engagement redesign.** Khan Academy disclosed only ~15% of eligible students actively used Khanmigo; the summer-2026 redesign makes it **proactive** (appears while the student works instead of waiting to be asked) and **differentiates help before vs after a first attempt**, drawing on help-seeking research.
Sources: https://www.edtechinnovationhub.com/news/only-15-percent-of-students-with-access-to-khanmigo-actually-use-it-khan-academy-admits · https://thelearningstandard.org/news/khan-academy-revamps-ai-tutor-after-low-student-usage

**What this means for Moyo.**
1. "Next thing to do" and "path vs list" are now table stakes. Moyo's Today must show the *current skill and next step* with subject artwork, not a generic Continue card.
2. Natalie must be **proactive and attempt-aware** inside the Tutor Room (offer a nudge after a stall, a different kind of help after a first attempt). This is a UX composition problem as much as a model problem.
3. Khan added gems/streak-style rewards. Moyo's PRD non-goal 7 bans engagement-pressure mechanics. That is the differentiation, not a handicap: **competence-based reveals** (a scene or manipulative completes as the skill is demonstrated) instead of gems and streaks. Parents read it as "she learned fractions", not "she kept a streak".

**Apple Design Awards 2026** — Sago Mini Jinja's Garden (Interaction winner, ages 3–6): no reading required, swipe-to-move, "no timer, no to-do lists"; inclusivity features integrated so organically nobody notices them. That is the K–2 bar.
Sources: https://developer.apple.com/design/awards/ · https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/

**SchoolAI Mission Control** (Mobbin web capture) — student rows carry a *headline* ("Needs guidance", "Frustrated", "Curious") plus outcome dots per objective plus a right-rail of per-student insights. This is the best teacher-workspace reference found: it separates *where the student is* from *what they demonstrated*, and puts the evidence one click away. https://mobbin.com/screens/14950322-bbc7-4cea-90ed-66e9909b8468

**Neubrutalism as a brand system** — NN/g's 2026 write-up and neubrutalism.com converge on the same rule the app needs: asymmetry and expression at the **macro** level (heroes, illustration, card stacks), mechanical alignment at the **micro** level (labels, fields, buttons, errors). https://www.nngroup.com/articles/neobrutalism/ · https://neubrutalism.com/

---

## 3. The direction: Neubrutalism × Tactile Learning Modernism (paper, objects, evidence)

Working name for the app art direction: **"Made at the kitchen table."** Not a product rename.

### Why tactile, not cartoon
Every competitor in the category is flat vector cartoon: Duolingo/ABC, Khan, ClassDojo, Kit, GoHenry, Finch. A child cannot tell them apart in a screenshot. Moyo's site already committed to paper grain, collage, real photography, and African geometric rhythm. Carrying that into the app gives Moyo an *ownable* look nobody in edtech has: **the lesson looks like it is made of paper, tape, marker, wooden blocks, and real light** — the materials a child actually learns with. It also keeps neubrutalism honest: cut-paper shapes with hard shadows *are* neubrutalist objects.

### Division of labour
- **Neubrutalism (structure, ~60%)** — ink borders, hard-offset slabs, Archivo Black display moments, single radius, ink-filled primary button, one role-accent moment per screen. Unchanged.
- **Tactile Learning materials (richness, ~25%)** — cut-paper and cardboard scenes for K–5; photographed or rendered real manipulatives (fraction tiles, base-ten blocks, rulers, beakers, globe) as lesson art for 3–12; real family/classroom photography (Pexels, per Mike's standing rule; AI-generated only when a real photo can't exist) for adults and onboarding; paper grain overlay at 2–4% on hero surfaces only. African geometric rhythm lives in eyebrows, section rules, pattern bands — structural, never decorative clip-art.
- **Spatial magic (~15%)** — Natalie in native 3D via react-native-webgpu (ADR-111), the raised Snap slab, scene-depth parallax on hero art (reduced-motion: static), the completion reveal.

### Rules
1. **Art does a job or it is deleted.** A fraction scene shows fifths. A reading scene shows the passage's setting. An empty state's art shows *what will appear here*. No mood illustration.
2. **Colour lives in the artwork; chrome stays disciplined.** The paper scene may use the full plum/coral/amber/teal family; UI keeps one accent moment. This satisfies both "exciting" and doc 36 §5.
3. **Reading and working surfaces stay quiet.** Paper-cream, no grain, no art competing with the problem.
4. **One illustration system.** Cut-paper geometry, consistent light from top-left matching the 4px 4px slab, fixed stroke weight, one figure style for children (silhouette/back-of-head or clearly stylised — never photoreal child faces in learner surfaces). Written into `docs/design/art-direction.md` with do/don't plates before any asset is produced.
5. **Natalie is a person, not a sticker.** Present on Today (small, greeting), full-body in Tutor Room (never over the canvas; docks to a side rail on phone, stands beside the canvas on tablet/web), and at completion. No Natalie during silent reading. Text/voice-only degradation is a complete experience (doc 32).
6. **Bands change composition, not just size.** K–2 scene-first, one action, narration. 3–5 subject world + a short plan. 6–8 studio: tools and projects. 9–12 goals, deadlines, credible diagrams, restrained celebration. Adults: editorial hierarchy, status heroes, evidence strips, dense tables where warranted.

---

## 4. Mobbin reference board (per screen, with what to take and what to refuse)

All links are real Mobbin captures inspected 2026-09-05.

| Moyo screen | Reference | Take | Refuse |
|---|---|---|---|
| Learner Today K–2 | Duolingo ABC home scene https://mobbin.com/screens/293a8f1a-10e6-4263-a4df-d1c84bd7ebb5 · Kit character path https://mobbin.com/screens/ccfc2094-3ae7-4d12-a8a6-1dc25dfcaa32 | The home *is* a place; the character and the goal share one world; progress is a physical object. | Six-tab bars, shops, streak counters. |
| Learner Today 3–5 | GoHenry Learn missions https://mobbin.com/screens/9bcd500f-f446-492e-8af1-1a50702b6db5 | Illustrated editorial tiles where the art explains the topic; "Level 1/2/3" segmented; "N missions" under each. | Parent-reward economy. |
| Learner Today 6–12 | Mimo daily review https://mobbin.com/screens/54b61209-26b8-4d28-ac60-9f888e099b6e · Duolingo path "Up next" https://mobbin.com/screens/345a05d1-9d96-4467-9746-8e87b752f691 | One hero ("Daily review · 10 min · Start now") above quiet lists; explicit "Up next" block. | Leaderboards. |
| Tutor Room (canvas) | Brilliant bar-model exercise https://mobbin.com/screens/9ebc579a-ba64-41bc-a268-b282ad3eb2d1 · Apple Notes Math handwriting solve https://mobbin.com/screens/283a4431-7ee1-4f6f-824a-a04f2e12094f · Duolingo ratio manipulative https://mobbin.com/screens/f5096c43-8d83-4447-a28d-aeb699f7aaef | The diagram is the lesson; hard-shadow ◄ ► controls already read neubrutalist; handwriting-first input with a floating "Solve/Hint" chip. | Chat transcript as the primary surface. |
| Completion | stoic. "Good job" with a single crafted glyph https://mobbin.com/flows/92380915-d1d3-4c2b-b2da-f6f7a6e2c84b · bless. editorial finish https://mobbin.com/flows/5da4942a-0a89-4cb0-90c4-c9979aae090c | One object completes; one sentence names the evidence; one Finish. | Duolingo's multi-screen reward cascade. |
| Natalie presence | Tolan full-screen companion https://mobbin.com/screens/90722ad9-55fe-4a5d-8df2-de63dae1a2ff | Minimal chrome around a living character; character owns the light. | Character blocking the work surface. |
| Capture review | (repo already has `docs/design/mobbin/capture-flow.md`, `ocr-review.md`) — keep those; add Apple Notes Math for the "recognised expression" chip. | Document stays visible; recognition uncertainty is a state. | Fake-confident transitions. |
| Parent Home | Duolingo ABC level card https://mobbin.com/screens/b06fe8bf-e3b9-44d2-9c7f-68f550e65b4d · Greenlight family setup steps https://mobbin.com/screens/7e97e03a-4c8e-47f3-8aab-2798ba5514ab | Scene + "Level 9 (Grade 2) · Read and spell…" — art plus plain-language mastery; onboarding as 3 illustrated steps with a % bar. | Finance-app KPI rows. |
| Child detail / report | Duolingo ABC level card (above) + doc 34's eight blocks | Movement vs position stays separate; each block gets one evidence object. | Percent-only dashboards. |
| Teacher class workspace | SchoolAI Mission Control https://mobbin.com/screens/14950322-bbc7-4cea-90ed-66e9909b8468 · ClassDojo activity steps https://mobbin.com/screens/ee80e5bd-0328-4db1-8b5e-0c22c04a9a04 | Student row = headline + outcome dots; right rail = insights → action; illustrated "what happens next" steps after assigning. | Deel/Zendesk density on a phone. |
| Tutor Today / ops queue | Pin outreach funnel https://mobbin.com/screens/228a2ca3-e5b6-4806-9a87-fc141efc11e8 (state funnel), Linear (v1 board) | Explicit state transitions across the top; scoped detail. | Marketing-CRM chrome. |
| Adult onboarding | Spotify Kids age choice https://mobbin.com/screens/bf5be757-1d6a-4dd8-9391-cee17bdfc1b3 | One decision per screen, illustrated options, "Help me choose". | — |

Flows to walk end-to-end in Mobbin before designing: Duolingo Home path flow https://mobbin.com/flows/08dc9b37-c078-458f-98ae-9c71fe8fd85f · Speak lesson completion https://mobbin.com/flows/a94db832-7412-4797-bba7-f19788c30b76 · World App course→quiz→return https://mobbin.com/flows/901222a7-82b3-476d-a1dc-6f7b7cd13801.

Per-screen Mobbin passes derived from this board live in `docs/design/mobbin/<screen-id>.md`.

---

## 5. Layout archetypes (seven, replacing "everything is a Card")

Each archetype is a composition contract: zones, proportions, which token dial, which art class. Implement as layout components in `packages/ui/layouts/`, not as per-screen JSX.

| Archetype | Used by | Zones (phone, top→bottom) | Art class |
|---|---|---|---|
| **A. Scene** | K–2 Today, K–2 completion | Scene (≥50% viewport, safe-area aware) → one primary slab (young target 72) → up to two secondary tiles → raised Snap in tab bar | Cut-paper world; Natalie small in scene |
| **B. Invitation** | 3–12 Today, tutor Today | Eyebrow + H1 → Hero card (subject art left 40% / text + Start right) → "Up next" strip → quiet list | Manipulative or subject object |
| **C. Focus** | Tutor Room, capture review, lesson | Progress rail → Canvas (≥60%) → Natalie dock (side on tablet/web, collapsible rail on phone) → single action bar | Diagram/manipulative; document image |
| **D. Day plan** | 6–12 Plan, tutor Calendar, guardian Calendar | Date header → segmented day → timeline rows with duration labels → floating add | None; colour from resource accents |
| **E. Status hero** | Parent Home, incident view, booking/consent states | Status band (what/why/who-acts) → evidence strip → action → details | Real photography (adults) or the child's own work |
| **F. List-detail** | Teacher class, tutor Learners/Notes, school People | List (headline + outcome dots) ‖ detail pane (AdaptivePanes; collapses by width class) | Avatars (curated), small evidence thumbnails |
| **G. Operational table** | Org Money/CRM, school Actions, district | Filter bar → dense table (Cool dial, Chivo Mono numerics) → row drawer | None |

Learner screens use A/B/C only (pane ban, ADR-107). Adults use B/D/E/F/G.

---

## 6. New primitives the kit must gain (all Storybook-documented, all typed)

`docs/design/reset/00-repo-baseline.md` §2 revises this list: four of these have an existing neighbour and are extensions, not new components — `NatalieDock` extends `TutorPresence.tsx`, `Manipulative` builds inside `LearningCanvas.tsx`, `OutcomeDots` extends `MasteryBar.tsx`, and `StatusHero` must either compose `Banner.tsx` or carry an ADR explaining why it does not. Six are genuinely new.

- `Paper` — surface with optional 2–4% grain, honours `prefers-reduced-transparency`/contrast. Hero surfaces only.
- `Scene` — art container with named slots (`background`, `objects[]`, `figure`), safe-area aware, parallax under motion budget, static under reduced motion. Accepts a `SceneAsset` id from the registry, never a bare URL.
- `SubjectArt` — one component, `subject × skill → asset` from a typed registry (`packages/art/registry.ts`). Missing asset = typed compile error, not a fallback emoji.
- `Manipulative` — renders fraction bars, base-ten blocks, number lines, area models as **interactive** Skia/WebGPU objects with a static PNG fallback. This is where Brilliant-level "the diagram is the lesson" lives.
- `EvidenceStrip` — horizontally scrolling thumbnails of the child's actual work (captures, whiteboard frames) with one-line captions; used by parent, teacher, tutor.
- `StatusHero` — what happened / why / who acts next, tone-tokened (never redpen for a struggling learner, doc 33).
- `MissionPath` — vertical path of skill nodes (Khan "Path view" answer), art-nodes not icon-circles; `List` variant for 6–12.
- `OutcomeDots` — per-objective status dots + headline pill (SchoolAI pattern), trajectory language from doc 34 (`solved on their own` / `solved with help` / `still working on it`).
- `NatalieDock` — the single component that owns Natalie's placement rules (§3 rule 5) across Today / Tutor Room / completion; wraps the webgpu renderer and the baked-clip fallback (doc 37, ADR-114 loader).
- `Reveal` — competence-based completion: object/scene completes, one evidence sentence, one Finish.

Retire nothing until its replacement is in Storybook with all states.

---

## 7. Six flagship compositions to approve first (wireframe-level)

Each must be shown with: real-length content, new account, empty, failure, loading, large text, reduced motion, phone + tablet (+ web for adults). Hero screenshot alone is not approval.

1. **Learner Today (K–2, Scene).** Cut-paper kitchen-table/desk scene fills the top half; the child's current object (e.g. a paper fraction pizza, 3/5 shaded) sits on the table; Natalie stands small at the side and speaks one line (narrated). One giant slab: "Let's finish the pizza." Below: two tiles (Snap, My Stuff). New account: the table is empty except a wrapped box labelled "Start here"; no fake history.
2. **Learner Today (6–12, Invitation).** Eyebrow "Algebra · Linear equations". H1 "Compare the two sides." Hero card: bar-model manipulative art left, "You already found x. Next: check it." + ink Start right, "12 min". "Up next" strip of 3 skill nodes as art. Due-work list quiet below. Failure state: the due-work read shows `ReadFailure`, hero still renders from cached skill.
3. **Tutor Room + Reveal (Focus).** Canvas ≥60% with the problem (captured image or manipulative); handwriting + keypad; Natalie docked right (tablet/web) or in a collapsible bottom-left rail (phone); proactive nudge chip appears after a stall ("Want to try halving both sides?") — pre-attempt help ≠ post-attempt help. Completion: the manipulative resolves, one sentence of evidence ("You solved 2 of 3 on your own"), Finish. Voice-off and 3D-off variants are the same screen minus the dock.
4. **Parent Home + Child detail (Status hero → Evidence).** Status band: "Amara worked on comparing fractions twice this week and got stuck on unlike denominators." Evidence strip of her captures. One action: "Set a 15-minute practice for Thursday" / "Ask Natalie to explain it to you first." Child detail = doc 34's eight blocks each with an evidence object; movement (MasteryBar before→after) and position kept on separate rows.
5. **Teacher class workspace (List-detail).** Class header with scope label; rows = student · headline pill · outcome dots; right/detail pane = evidence strip + suggested intervention with its source ("based on 3 attempts on 5.NF.1") + Assign/Message actions; after assigning, three illustrated "what happens next" steps.
6. **Tutor Today / school ops variant (Invitation → List-detail).** Tutor: today's sessions as a day plan, next session hero with learner context (authorised notes, assignment), Prepare → Tutor Room → summary draft queue. School: state funnel across the top (Invited → Provisioned → Active → Needs attention), queue below, scoped detail; Overview stays honest until People/Learning/Actions have complete workflows.

---

## 8. Navigation — reconcile with doc 36 rather than replace it

Doc 36 is binding: K–2 Today·Snap·My Stuff · 3–5 Today·Subjects·Snap·Me · 6–12 Home·Subjects·Snap·Progress·You · Guardian Home·Reports·Alerts·Family · Tutor Today·Learners·Notes·You. The v1 brief's alternates (learner "Plan" tab, guardian "Children·Calendar·Updates", teacher "Calendar", school "Overview·People·Learning·Actions") are **prototype candidates only**; each needs an ADR (adr-101..106 exist for exactly this) and a tested compatibility redirect before a route changes.

Navigation problems that are real and fixable now without route changes:
- The learner does not know *where they are in a subject* from any tab. Fix: `MissionPath` inside Subjects and the "Up next" strip on Today.
- Guardian Calendar is a secondary route; parents told us the day plan matters. Fix: surface a day-plan band on Home before adding a tab.
- Context (who am I → role → org → child/class) is carried by header colour only in places. Fix: a visible scope label component on every adult screen (`ScopeChip`), and the workspace switcher in You/Profile per doc 36.
- "Updates/Messages" must not appear until a messaging collection, participants, unread state, and safety review exist (guardian source says none does).

---

## 9. Asset pipeline (this is the missing 25%)

1. `docs/design/art-direction.md` — plates: light direction, stroke, paper palette (plum/coral/amber/teal + paper-cream + ink), figure policy, do/don't, per-band register. Approved before asset #1.
2. `packages/art/registry.ts` — typed map `{ subject, skill, band, variant } → asset` with dimensions, alt text, licence, source. Missing entry is a compile error. Feature code imports from the registry only. Model it on the existing `apps/web-vite/src/components/photography.ts` + `photography.provenance.ts` split; that pattern already works and the split is a measured bundle decision.
3. Production lanes: (a) cut-paper scenes and subject objects — produced as layered SVG/PNG sets (AI-generated only when a real photo cannot exist; every generated asset reviewed against the plates); (b) manipulatives — drawn at runtime by `Manipulative` (Skia/WebGPU), static PNG fallback exported from Storybook; (c) adult photography — Pexels, licence recorded in the registry, real families and classrooms, no child faces on learner surfaces.
4. Budget: first-paint art on Today ≤ 250 KB (AVIF/WebP with PNG fallback), preloaded with the shell per ADR-114; scenes lazy after first interaction; Natalie preload/loader owns its own budget.
5. Storybook "Art" section shows every registry asset at every band and both dials; `pnpm ui:sweep` extended to fail on un-registered images.

---

## 10. Copy and motion rules that ship with the composition

- Voice gate per doc 31 already exists; every hero line is written per band and passes the readability gate (K–2 ≤ 8 words, one question).
- Every screen answers in order: Where am I? What matters now? What can I do? What changed after I acted?
- Motion shows a consequence only: press → slab moves 4px into its shadow; complete → object resolves; select → pane reveals parent/child. Entrance `FadeIn` staggers are removed from lists longer than 3 items. Reduced motion: no parallax, no reveal animation, same information.

---

## 11. Delivery sequence

0. **Inventory + baseline (repo has most of it):** reuse `D-screen-inventory.md`, `C-orphans-dead-ends.md`; add an **asset inventory** and a comment-hygiene sweep list. → `docs/design/reset/00-repo-baseline.md`, `docs/design/reset/00-asset-inventory.md`.
1. **Art direction + primitives:** `art-direction.md`, `Paper`, `Scene`, `SubjectArt`, `Manipulative` (fraction bar + number line first), `StatusHero`, `EvidenceStrip`, `OutcomeDots`, `NatalieDock`, `Reveal`, `MissionPath` — Storybook, all states, both dials, all bands.
2. **Six flagship compositions** in Storybook + on device, against live data via existing hooks (`useLearnerAssignments`, session hooks), with the failure/empty/loading matrix. Design critique + accessibility review before any route work.
3. **Vertical slice:** learner Today → Tutor Room → Reveal → parent Home evidence → teacher row, on real backend, real Better Auth, real entitlement.
4. **Expand** to remaining roles, adaptive panes for adults, school companion only after persona/entitlement definition.
5. **Retire** superseded compositions and the defensive comments; visual regression re-baselined by review, not bulk snapshot update.

## 12. Release gates (add to the existing ones)

- No screen ships without at least one registry art asset or an explicit `artless` contract flag with a reason.
- No `<Image source={{uri}}>` outside the registry; sweep fails otherwise.
- Every visible control has a destination; back/close/reload/deep-link restore role/org/child/class.
- Signature learning activity works with 3D off, voice off, reduced motion.
- Movement vs position never conflated; no engagement-pressure mechanics; learner never sees prices.
- Contrast pairs derived and checked (`check-contrast.mjs`) including art-over-text overlays.
- Comment hygiene: comments state intent, not history; no "it used to be…".
- Observed usability with 5 children per band, 5 parents, 3 teachers, 3 tutors, 2 school reps: first-click, completion, wrong turns, recovery, comprehension. Preference is recorded, not counted as success.

## 13. Sources

Repository: https://github.com/mikevocalz/moyolearn (rev cdcf4cf3). Khan Academy: https://blog.khanacademy.org/meet-the-new-khan-academy-classroom-experience/ · https://support.khanacademy.org/hc/en-us/articles/46056261189773 · https://blog.khanacademy.org/built-in-the-open-how-pilot-districts-shaped-the-reimagined-khan-academy/ · https://blog.khanacademy.org/2026-khan-academy-updates-every-teacher-should-know/ · https://www.edtechinnovationhub.com/news/khan-academy-redesigns-classroom-platform-as-ai-tools-move-further-into-daily-teaching · https://www.edtechinnovationhub.com/news/only-15-percent-of-students-with-access-to-khanmigo-actually-use-it-khan-academy-admits · https://thelearningstandard.org/news/khan-academy-revamps-ai-tutor-after-low-student-usage. Apple Design Awards 2026: https://developer.apple.com/design/awards/ · https://www.apple.com/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/. Neubrutalism practice: https://www.nngroup.com/articles/neobrutalism/ · https://neubrutalism.com/. Mobbin captures: all URLs in §4. v1 brief sources retained: SchoolAI Mission Control docs, Synthesis Tutor, Khan Parent Dashboard, Google expressive-design research (see v1 brief).

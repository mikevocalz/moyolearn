# HANDOFF — `TutorStage`, the S9 tutor session surface
**Doc 23 · Moyo platform pack · Date:** Aug 21, 2026
**What this is:** the build contract for the screen designed on the **TutorStage canvas** — eight artboards, Hot dial, Schoolhouse. It fills the brief in doc 04 §S9 and the mount point doc 01 reserved (*"`TutorStage` (2D avatar v1; mount point contracts sized for 3D/XR later)"*). It adds no new decisions: everything here traces to docs 04, 07, 08, 12, 17 or 22, and where those disagree the later one wins. Where this doc is silent, the developer must ask rather than guess.

---

## §1 · Role
Build this at the level of the people who define these systems: a **React Native core / Fabric** engineer; a **design-systems engineer** who has owned a token pipeline end to end and treats a raw pixel value in feature code as a defect; an **accessibility engineer** specialising in motor and vestibular access, and in dynamic type; a **children's trust-&-safety architect** who writes platform policy; and a **real-time UI engineer** for whom a 60fps composer under a streaming response is table stakes. "Senior" does not exist here.

**Standing rule: no raw values in feature code.** Every number in §4 is given as its token name *and* its resolved value; ship the name. `p-[13px]` fails CI (doc 08 §2.1) and so does the intent behind it.

---

## §2 · The job, in one line

Teach, don't answer — the productive-struggle ladder as an interface (doc 04 §S9). Everything below serves that, and the two screens that look like failure states (§3.6, §3.7) exist because a child must never be made to feel that the system's problem is theirs.

**Archetype:** Focus (doc 02 §4). One goal, one primary action, `inset-roomy`, ≥40 % empty canvas. Focus surfaces span fullscreen and treat a device hinge as a safe-area inset, never a layout boundary (doc 02 §2.3).

**The signature is the avatar.** Doc 01 §6.1: *"Spend the boldness there; keep everything around it quiet."* Two consequences the canvas commits to, and the build must preserve:

1. **Natalie's yellow is the only saturated fill on the conversation states.** No highlighter button appears while she is speaking, thinking, or first painting — nothing competes with her. Highlighter returns only where the child has a decision: §3.4, §3.6, §3.7.
2. **One display moment on the whole surface**, spent on Session end (§3.7) — the one state whose entire job is a single statement. Everywhere else the header title answers "what is this screen", because the avatar already has.

---

## §3 · The state contract

`TutorStage` renders exactly one state at a time. Model it as a discriminated union (doc 10 §2: `any` banned, discriminated-union prop APIs), because these states have genuinely different data and the compiler should refuse an impossible pairing:

```ts
export type TutorStageState =
  | { kind: 'presence' }                                     // §3.1
  | { kind: 'speaking';  utterance: Utterance }              // §3.2
  | { kind: 'thinking' }                                     // §3.3
  | { kind: 'hint';      step: HintStep }                    // §3.4
  | { kind: 'listening' }                                    // §3.5
  | { kind: 'paused';    since: number }                     // §3.6  fail-closed
  | { kind: 'ended';     summary: SessionSummary }           // §3.7
  | { kind: 'retry' }                                        // §3.8  drawn: no
  | { kind: 'crisis' };                                      // §3.9  drawn: no
```

**There is deliberately no `error` kind and no `locked`/`upsell` kind.** A child never sees an error screen (doc 12 §5) and never sees a paywall (doc 05 §2.2, §3.2; doc 22 §7). Both are absent from the type so they cannot be added without this doc changing — that is the point of encoding them here rather than in a comment.

| § | `kind` | Artboard | Status chip | Highlighter | Primary action |
|---|---|---|---|---|---|
| 3.1 | `presence` | First paint · 2D presence | Here (green) | — | none (composer) |
| 3.2 | `speaking` | Speaking · 3D stage | Speaking (green) | — | none (composer) |
| 3.3 | `thinking` | Thinking | Thinking (blue) | — | none (composer) |
| 3.4 | `hint` | Hint ladder | Waiting for you (outline) | "I'll try it" | "I'll try it" |
| 3.5 | `listening` | *(reuses Speaking frame)* | Listening (green) + recording indicator | — | none (composer) |
| 3.6 | `paused` | Fail-closed · taking a break | Taking a break (outline) | "Practice on my own" | "Practice on my own" |
| 3.7 | `ended` | Session end | Session done (green) | "Back to my plan" | "Back to my plan" |
| 3.8 | `retry` | not drawn | — | — | inline retry |
| 3.9 | `crisis` | not drawn | — | — | terminal |

### §3.1 · `presence` — first paint
**Never waits on the 3D stage** (doc 22 §6). `TutorStage` mounts the 2D presence mark — the same mark as the tab icon — and streams the renderer in behind it. This is a designed state, not a fallback: it is also the terminal appearance for the `presence-2d` device tier (no hardware adapter, `isFallbackAdapter`, or a demoted tier), so it must look finished, not loading.

The mark is **not** a button: it carries the ink border but **no slab shadow**, because border + shadow + yellow is the primary-button treatment and the one thing on this screen that isn't a control must not wear it.

Greeting copy resumes context (doc 04 R1 — the tutor opens already knowing the assignment): "Hi {firstName}. We were on question {n} — want to pick up there?"

### §3.2 · `speaking`
Her turn is **always rendered as text**, not only when voice is on: doc 04 §S9 requires captions on by default and full parity between voice and text. The caption is the transcript; there is no separate transcript pane on compact.

Copy voice, verbatim from doc 04 §S9 — the tutor never says "Wrong": *"Not yet — look at the 7 on the left side. What undoes adding 7?"* The referenced value is marked in the caption with an inline highlighter span so the child's eye lands where hers is pointing.

### §3.3 · `thinking`
Skia clock-driven shimmer re-skinned to Schoolhouse — ink text, yellow highlight band (doc 15 §1). Copy: **"Natalie is thinking"**, band-appropriate. `prefers-reduced-motion` → the band renders static, label unchanged.

Latency is a design property here (doc 04 §S9): first token < 1.5s then streamed (doc 12 §2). If the gateway has not produced a first token by **~4s**, this state persists — it does not become an error. If the turn fails, go to §3.8, never to a red toast.

### §3.4 · `hint`
The ladder is **visible so effort feels fair, not withheld** (doc 04 §S9). Render the position honestly — "Hint 1 of 3" in tabular mono, with a three-dot ladder — and never offer a "Solve" affordance (doc 04 §S10; the ladder probe → nudge → hint → scaffold → worked example is enforced in the pedagogy engine, not prompt-suggested, doc 01 §2.7.2).

Two actions, and their order is the design: **"I'll try it"** is primary (highlighter), **"Show me the next hint"** is secondary (paper). Escalation is always the quieter choice.

### §3.5 · `listening`
Reuses the speaking frame with the status chip switched. **A visible recording indicator is always on when the mic is open** (doc 15 §2). STT runs on-device; raw child audio is never persisted and never leaves the device (doc 01 ADR-005).

### §3.6 · `paused` — fail-closed
Doc 12 §5, which wins over every other doc on this: *"if any safety layer is unavailable, tutoring pauses — 'Natalie is taking a break' (never an error screen at a child), guardian-visible status."*

Doc 22 §7 gives it a body: the stage keeps its **calm authored idle** — never a frozen T-pose, never a vanished mesh, never a spinner over her.

Copy takes the blame off the child and states what was kept: *"Natalie is taking a break. Nothing you did — she'll be back in a moment."* / *"Your work on question 4 is saved."* The child is offered solo practice, not an exit. The real status goes to the guardian, not to her.

### §3.7 · `ended`
Serves three different endings with one screen: the natural end of a session, the doc 07 §2.4 break-by-design nudge at ~25–45 minutes, and the doc 12 §7 daily inference budget. All three are *"great work today"* — cost control and child wellbeing point the same direction, so they get the same face.

Praise is for **effort and transfer**, and the line is doc 04 §S9's, verbatim: *"You solved the last two on your own."* Mastery delta is grade-green in tabular mono. **No streak, no countdown, no "come back tomorrow"** — doc 07 §2.5 bans engagement-maximization mechanics aimed at the child, and doc 04 makes celebration *"warm, never manipulative"*.

### §3.8 · `retry` — not drawn, still required
Doc 17 §A2: *"children never see red error toasts — a failed send/interaction gets gentle retry copy ('Hmm, that didn't stick — try again') in band voice, while the parent/ops surfaces get the registry's precise message."* Inline on the composer, not a toast, not modal. **`redpen` is not used here** — see §4.3.

### §3.9 · `crisis` — not drawn, needs its own design pass
Doc 07 §3 layer 6: tutoring stops, an age-appropriate supportive message renders with crisis resources (988 / Crisis Text Line), the guardian is alerted immediately, and *"the session does not resume into math as if nothing happened."* That is a **distinct terminal state**, not a toast and not a variant of §3.6. It is deliberately absent from the canvas: it needs its own review with the safety owner before anyone draws it. Ticket it; do not improvise it.

---

## §4 · Tokens, by element

Hot column throughout (doc 08). Values shown resolved for review only — **ship the token**.

### §4.1 · Structure

| Element | Token | Resolved |
|---|---|---|
| Screen background | `paper` (`ink.50`) | `#FFFDF7` |
| Every border | `border-2` + `border-strong` | 2px `#0D0C0B` |
| Card/stage shadow | `shadows.card` | `4px 4px 0` ink, **no blur, ever** (doc 03 §2.6) |
| Radius | `radius-card` | 14 |
| Header padding | `inset-tight` / `inset` | 16 / 20 |
| Screen padding | `inset` | 20 |
| Stage margin | `inset` | 20 |
| Caption ↔ composer | `gap-group` | 32 |
| Within a group | `gap-stack` | 16 |
| Icon ↔ label | `gap-element` | 12 (cool 8 inside chips) |

**Two `border-2` elements never sit flush** — stacked borders read as a 4px error (doc 08 §2.2). Minimum `gap-element` between bordered siblings.

### §4.2 · Type

| Element | Token | Resolved | Face |
|---|---|---|---|
| Session end statement | `display-sm` | 30 / 1.2 | **Archivo Black** — the only use on this surface |
| Header name | `title` | 20 / 1.3 / 700 | Space Grotesk |
| Her turn (caption) | `body-lg` | 18 / 1.55 | Space Grotesk |
| Composer placeholder | `body` | 17 / 1.5 | Space Grotesk |
| Button labels | `label` | 15 / 1.4 / 600 | Space Grotesk, sentence case |
| Chips, meta, disclosure | `caption` | 13 / 1.4 | Space Grotesk |
| Question counter, hint index, mastery Δ | `data` / `data-lg` | 15 / 20 | **Spline Sans Mono, tabular** |
| Equation (tablet) | — | 44 / 24 | Spline Sans Mono, tabular |

Line length caps at `content-prose` = **65ch**. **Reading-comfort mode** (doc 08 §3.3) must render without breaking: body → `body-lg`, letter-spacing +0.06em, line-height 1.7, `gap-stack` +1 step. Framed as "comfy reading", never as a diagnosis; default off.

### §4.3 · Colour

| Role | Token | Resolved |
|---|---|---|
| Ink — text, borders, shadows | `ink` | `#0D0C0B` |
| Secondary text | `ink.600` / `ink.500` | `#55524A` / `#6E6B5C` |
| Attention accent, primary button fill | `highlighter` (+ `on-highlighter` for the label) | `#FFE14D` on ink |
| Grid overlay, thinking status | `ballpoint` | `#2952D9` @ 7 % for the grid |
| Live / done status, mastery gain | `grade` | `#28613A` |
| Inactive status dot | paper fill + ink border | — |

**`redpen` (`#A03333`) does not appear anywhere on this surface.** Doc 08 §4.8: in a school-supplies language red pen means "marked wrong", and *"a child's overall progress is never 'wrong'"*. Struggle renders highlighter; a failed send (§3.8) renders ink. If a build introduces red here, it is a defect, not a style choice.

### §4.4 · Targets — a function of the child, not a hardcode

| Band | Token | Resolved |
|---|---|---|
| K–2 | `target-young` | **72** (~2cm — the NN/g 4× finding) |
| Grades 3–5 | `target-child` | **56** |
| Grades 6–12 | `target-teen` | **48** |
| CI floor | `target-floor` | 24 (WCAG 2.2 AA SC 2.5.8) — never a design target |

Read the band from the learner profile via `useTargetToken()` / `targetForBand()`. Doc 10 §3.3: *"a component that hardcodes `size='lg'` for children is a bug."* Doc 22 §7 extends it: **any** affordance on or around the avatar takes the band token, including the stage's own controls.

The canvas is drawn at the 3–5 default; the speaking artboard carries a live band lever so the ramp is visible. **Doc 01's 44pt floor still applies to everything** — the captions toggle in the header is sized to 44 for exactly that reason.

---

## §5 · Layout

| Width class | Layout |
|---|---|
| **compact** (<600dp) | Single spine: header · stage (flex-grow) · caption · composer. Stage takes all remaining height — it must never be given a fixed height, or the avatar clips on short devices. |
| **medium+** (≥600dp) | Two columns, `380px` + `minmax(0, 1fr)`, `gap-group` (32). Left: presence + her turn. Right: `LearningCanvas` (equation/whiteboard) + its own input. Header spans both. |

Doc 03 §2.3 M3 classes; doc 10 §3.1 — `WidthClass` is the single vocabulary and *"if CSS can express it, JS must not"*. Bento composition is explicitly **excluded** here: doc 02 A.3 keeps the child's guided path a single spine on purpose.

**Not on the child's screen, ever:** `StruggleMeter` (tutor-visible only) and `SessionPrepCard` (adult-facing) — doc 01 §6.

---

## §6 · Motion

Ceiling: **≤200ms, state-communicating** (doc 02 A.5). Durations and easings are tokens shared by both renderers (doc 17 §B3).

| Element | Trigger | Motion | Reduced motion |
|---|---|---|---|
| Buttons | press | translate 2,2 · shadow 4,4,0 → 2,2,0 · 80ms ease-out; springs back on release | instant state + opacity; **haptics retained — they are not motion** |
| Message bubble | arrival | Reanimated `SlideInDown` + hard-decel easing | instant |
| Thinking band | while thinking | Skia shimmer, delayed fade so band and label read as one motion | static band, label unchanged |
| Streaming text | token arrival | `react-native-enriched-markdown` `streamingAnimation`, off the JS thread | text appears without per-token animation |
| **The avatar** | always | breath, sway, drift, saccades, blink hazard, backchannel nods, pre-speech anticipation | **pinned. Speech-driven mouth and minimal blink only** |

**Never** on a child surface: ambient or parallax motion (doc 02 A.5). No attention-getting motion after inactivity, no idle that reads as sulking or waiting (doc 22 §7).

Reduced motion is one global switch honoured by the CSS, the Reanimated configs, the shimmer **and the renderer** (doc 17 §B3 + doc 22 §7). It is a render mode, not a style — and it has its own golden images, because *"it must be still, and a diff proves it"* (doc 22 §8).

Chat mechanics (doc 15 §1): LegendList v3 `anchoredEndSpace` so the just-sent message rides to the top and holds while the reply streams below; `KeyboardStickyView` so the composer rides the keyboard curve on the UI thread. Budget: 57–60fps on both threads while scrolling, UI thread at 60 during generation.

---

## §7 · The 2D ↔ 3D swap

Doc 22 §10.8 requires this to be a **provider swap, not a rewrite** — the same contract doc 09's Mock-Session Contract uses for the session itself.

- `TutorStage` renders the presence mark and owns the state union in §3. It knows nothing about three.js.
- The 3D renderer arrives through one lazily-imported entrypoint (`@acme/avatar`), never through a barrel — Metro does not tree-shake (doc 20).
- Tier selection is measured, not guessed: request adapter → `warnIfNotHardwareAccelerated` → read limits → pick tier → run 60 frames → demote on missed budget. `isFallbackAdapter` falls hard to `presence` (§3.1).
- **Every avatar asset comes from the CDN behind the capability manager. Zero avatar bytes in the binary** (doc 20; doc 22 §3).

---

## §8 · Accessibility

- **Focus order:** back → session title → captions toggle → caption text → primary action → secondary action → composer → mic. The stage itself is not focusable; it is decorative to a screen reader *except* its status, which is announced (§below).
- **Announcements:** status changes announce politely — "Natalie is thinking", "Natalie is speaking", "Natalie is taking a break". Her turn announces as it completes, not per token. The hint index announces as "Hint 1 of 3".
- **Labels:** the avatar carries one label ("Natalie, your tutor") and no description of appearance. The captions toggle, mic, back and both action buttons carry explicit labels; icon-only controls require one and it is type-enforced (doc 08 §4).
- **Targets:** §4.4. Nothing interactive is under 44, whatever the band.
- **Dynamic type to XL without layout breakage** (doc 01 §6.1) — the caption block grows and the stage shrinks; the composer never scrolls out of reach.
- **Contrast:** AA floor, CI-tested per pair. Ink/paper ≈18:1; secondary ink ≥5:1; ink-on-highlighter ≥12:1.
- **Voice and text are at full parity** (doc 04 §S9); captions default on.
- **The renderer holds no learner PII.** Nothing identifying is textured, labelled or logged on the stage (doc 22 §7).

---

## §9 · Edge cases

| Case | Behaviour |
|---|---|
| Her turn is very long | Caption block scrolls within its own box; the stage never shrinks below the avatar's rendered height. Composer stays pinned. |
| Her turn is one word | Caption block does not collapse below one line of `body-lg`; the stage takes the slack. |
| Localised copy runs ~35 % longer | Type ramp and 65ch cap hold; buttons wrap to two lines rather than truncating. A truncated child-facing instruction is a defect. |
| Slow first token | §3.3 persists. No spinner over Natalie, no timeout error. |
| Send fails | §3.8 inline. Optimistic bubble snaps back, band-voiced retry (doc 17 §A4.2). |
| Safety layer down mid-utterance | §3.6. She finishes nothing mid-sentence — the stage transitions to the authored idle. |
| No hardware adapter | §3.1 permanently, and it must look finished. |
| Offline | Composer disabled with band-voiced copy; the last turn stays on screen. Never a blank state. |
| Guardian's billing lapsed | **Nothing changes on this screen.** The learner degrades to a small free daily practice set; the paywall is the parent's, never hers (doc 05 §2.2). |

---

## §10 · Build order and gates

Wave 2 builds this against **scripted demo content on fixtures only** — no real child talks to the AI before Wave 5 (doc 09 §3). The state union in §3 is what the mock and the live provider both satisfy.

Compose from `@acme/ui` (doc 03 §2.2 — the foundation, not PanelUI) and scaffold with `pnpm gen component`; do not hand-roll the folder shape (doc 11). New pieces this screen needs: `TutorStage`, `LearningCanvas`, `SessionToolbar`, and the messaging trio `MessageBubble` / `Composer`.

Standing gates apply, plus three from this doc:

- `turbo typecheck` green cold · no invented APIs (cite file + symbol) · stories for every new component · contrast check green · **target-size CI** measures every interactive story against its dial × age-band token (doc 08 §7.4).
- **Squint test:** one display moment max, one highlighter accent max, primary action identifiable in a 5-second squint at a screenshot.
- **Red-team cases** for the copy rules: never "Wrong", never "Fail", no secrecy in either direction, no claimed feelings, no paywall reachable from any state, no red on a child's progress.

---

## §11 · Sources

**The design:** the TutorStage canvas (8 artboards — first paint, speaking, thinking, hint ladder, reduced motion, fail-closed, session end, tablet split).

**Pack:** doc 01 §5.1/§5.3/§6/§6.1 (tab bar, route, component list, signature, accessibility floor) · doc 02 §2.3/§4/§5.1–5.4/§6/A.3/A.5/Addendum B (Schoolhouse, dial, archetype, motion, brand-voice guardrail) · doc 03 §2.2/§2.3/§2.4/§2.6 (`@acme/ui`, width classes, sheet snaps 55/85, fonts + shadows + palette mapping) · doc 04 §S7/§S8/§S9/§S10 + R1/R3/R4/R9/R10 (the brief and its research) · doc 05 §2.2/§3.2 (no paywall at a child) · doc 07 §2/§3 (companionship firewall, Safety Plane, crisis protocol) · doc 08 §1–§5/§7 (spacing, targets, type ramp, hierarchy law, gates) · doc 09 §3 (fixtures-only in Wave 2) · doc 10 §2/§3 (typing contract, `WidthClass`, target tokens) · doc 11 (generator, guardrails) · doc 12 §5/§7 (fail-closed, budget UX) · doc 15 §1/§2/§5 (chat client, on-device STT, perf budget) · doc 17 §A2/§A4.2/§B3 (retry voice, optimistic send, one motion system) · doc 20 (zero avatar bytes in the binary) · doc 22 §3/§6/§7/§8/§10.8 (asset law, tiers and first paint, the safety boundary on the body, reduced-motion goldens, the swap).

**External, as cited by the pack:** [NN/g — UX Design for Children](https://www.nngroup.com/reports/children-on-the-web/) (age bands, 2cm targets, one-task-at-a-time) · [WCAG 2.2 SC 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · [WCAG 2.2 SC 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) · [prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) · [Reanimated](https://docs.swmansion.com/react-native-reanimated/) · [LegendList](https://github.com/LegendApp/legend-list) · [react-native-keyboard-controller](https://kirillzyusko.github.io/react-native-keyboard-controller/) · [988 Suicide & Crisis Lifeline](https://988lifeline.org/) · [Crisis Text Line](https://www.crisistextline.org/).

Where this doc and an earlier one disagree **on this screen**, this one wins — it was written with the design open. Doc 22 still wins on the avatar itself, and doc 12 still wins on the architecture underneath.

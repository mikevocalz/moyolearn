<!--
  Capacity worksheet — doc 12 §9.6. Token-cost model per learner-day at the §7
  Phase-2 load, with the §7 routing split shown explicitly and the arithmetic
  left on the page so a reader can disagree with an assumption rather than with
  a total. Prices are a STATED ASSUMPTION with a date, not a fact of the system.
  SOT: docs/pack/12-systems-design-prompt.md §2 §7 §9.6 · docs/design/inference-gateway.md §3 §7
  SOT-KEYWORDS: capacity worksheet token cost model routing split inference budget per learner day peak sensitivity pricing assumption
-->

# Capacity worksheet — token cost per learner-day

**Doc 12 §9.6 · Date: Aug 27, 2026 · Status: model, not a measurement**

Doc 12 §7: *"Web/API load is trivial next to inference — the system is designed around
token cost, not CPU."* This worksheet is that design's arithmetic. Every number below is
either an input this document names, or a line of arithmetic over those inputs. Nothing is
measured — there is no production traffic to measure — so the useful output is not the
total but the **shape**: which assumption the total is sensitive to.

**Headline: $0.130 per active learner-day.** One tutoring session of 12 turns. At the §7
load that is **$1,041/day** and **$31.2k/month**, of which the frontier model is 83% on
25% of the calls.

---

## 1 · Inputs

### 1.1 Load (doc 12 §7, binding)

| Input | Value | Source |
|---|---|---|
| Businesses | ~500 | Doc 12 §7 |
| Families | ~30,000 | Doc 12 §7 |
| Learner AI sessions/day | ~8,000 | Doc 12 §7 |
| Peak | 3–7pm local | Doc 12 §7 |
| Provider calls per AI turn | 2–6 | Doc 12 §7 |

### 1.2 Prices — a stated assumption, with a date

**These are the prices published at
`https://platform.claude.com/docs/en/about-claude/pricing`, read on 2026-08-27.** They are
an assumption of this model, not a property of the system, and they are the single input
most likely to be stale when you read this. Re-read the page before quoting a total.

| Model | Role | Input $/MTok | Output $/MTok | 5-min cache write $/MTok | Cache read $/MTok |
|---|---|---|---|---|---|
| `claude-opus-5` | Frontier — the tutoring turn | **$5.00** | **$25.00** | $6.25 | $0.50 |
| `claude-haiku-4-5` | Small fast — L3/L4/L5 classification | **$1.00** | **$5.00** | $1.25 | $0.10 |

Two published facts that this model relies on and that are easy to get wrong:

- **Cache reads cost 0.1× base input; 5-minute writes cost 1.25×.** A cached prefix pays
  for itself after one read.
- **The minimum cacheable prefix differs by model and is not monotonic across
  generations:** 512 tokens on `claude-opus-5`, **4,096 tokens on `claude-haiku-4-5`**. A
  `cache_control` marker below the minimum is accepted and silently does nothing —
  `cache_creation_input_tokens: 0`, no error. §2.2 is where this bites.

`claude-sonnet-5` ($2 / $10) is priced here for the §5 fallback comparison only; it is not
in the v1 routing table (`docs/design/inference-gateway.md` §3).

### 1.3 Shape of a session — the assumptions this worksheet owns

Doc 12 gives sessions/day but not turns/session, tokens/turn, or the classifier call mix.
Those are this document's, and they are where to argue.

| Assumption | Value | Why |
|---|---|---|
| Turns per session | **12** | A homework session: a captured problem worked to completion, plus a second problem started |
| Calls per turn | **4** = 1 frontier + 3 classifier | Midpoint of doc 12 §7's 2–6. The three are `classify-input`, `topic-fence`, `classify-output` (`docs/design/inference-gateway.md` §3) |
| Frontier system half | **900 tokens** | `packages/app/features/tutor/pedagogy.ts:PEDAGOGY_CONTRACT` (~660) + `packages/student-model/src/inference.ts:briefPreamble` over a capped `LearnerBrief` (~240) |
| Frontier user half | **120 tokens/turn** | The problem restatement + the child's turn, assembled in `packages/app/features/tutor/coach.service.ts` |
| Frontier output | **300 tokens/turn** | ~60 rendered + ~240 adaptive thinking at `effort: 'low'`. `MAX_TOKENS = 1024` in `tutor-model.ts` is a runaway guard, not a target |
| Classifier prompt | **400 tokens/call** | Policy + the five-class taxonomy of `packages/safety/src/plane.ts:InputClass` + a structured-output schema |
| Classifier payload | **120 tokens/call** | The text being classified |
| Classifier output | **20 tokens/call** | A label |
| Learners | **42,000** | 30,000 families × 1.4 learners |

**Conversation history is not resent.** `tutor-model.ts:streamTutorTurn` sends
`messages: [{ role: 'user', content: message }]` — a single message. Lesson continuity
comes from the brief (`briefPreamble`), not from a growing transcript in the context
window. This is the reason input cost is flat across a session instead of quadratic, and
it is worth naming because the obvious "add history for coherence" change would multiply
the frontier input line by roughly the turn index.

---

## 2 · Per-session arithmetic

### 2.1 Frontier — `claude-opus-5`, 12 calls

The 900-token system half clears the 512-token minimum, so it caches: one write on turn 1,
eleven reads after. `tutor-model.ts` already sets
`cache_control: { type: 'ephemeral' }` on the system block.

| Line | Tokens | Rate | Cost |
|---|---:|---:|---:|
| Cache write — system, once | 900 × 1 = **900** | $6.25/MTok | $0.005625 |
| Cache read — system, 11× | 900 × 11 = **9,900** | $0.50/MTok | $0.004950 |
| Uncached input — user half | 120 × 12 = **1,440** | $5.00/MTok | $0.007200 |
| Output | 300 × 12 = **3,600** | $25.00/MTok | $0.090000 |
| **Frontier subtotal** | | | **$0.107775** |

### 2.2 Small fast — `claude-haiku-4-5`, 36 calls

**No caching line, and that is deliberate rather than an omission.** The 400-token
classifier prompt is below Haiku 4.5's 4,096-token minimum, so a `cache_control` marker
on it would be accepted and would cache nothing. Modelling a cache here would understate
the classifier tier by ~40% and the error would never surface as a bug.

| Line | Tokens | Rate | Cost |
|---|---:|---:|---:|
| Input — prompt + payload, all uncached | (400 + 120) × 36 = **18,720** | $1.00/MTok | $0.018720 |
| Output — labels | 20 × 36 = **720** | $5.00/MTok | $0.003600 |
| **Classifier subtotal** | | | **$0.022320** |

### 2.3 Session total

```
  frontier   $0.107775
+ classifier $0.022320
  ─────────────────────
  session    $0.130095      →  $0.1301
  per turn   $0.130095 / 12 =  $0.010841
```

---

## 3 · The routing split, shown

This is doc 12 §7's cost control stated as a number: *"small model for L3/L5
classification and topic fencing; frontier model only for the tutoring turn."*

| Tier | Calls/session | Share of calls | Cost/session | **Share of cost** |
|---|---:|---:|---:|---:|
| `claude-opus-5` — tutoring turn | 12 | 25.0% | $0.107775 | **82.8%** |
| `claude-haiku-4-5` — classification | 36 | 75.0% | $0.022320 | **17.2%** |
| **Total** | **48** | 100% | **$0.130095** | 100% |

Three readings of that table, in order of usefulness:

1. **Three quarters of the calls are one sixth of the bill.** The split is doing its job.
2. **Output tokens on the frontier turn are 69% of the entire session cost**
   ($0.090000 / $0.130095). Not input, not the classifiers, not caching — the tokens the
   frontier model *generates*. §5.1 follows this to its conclusion.
3. **Doc 12 §7's "2–6 provider calls" barely matters.** At 2 calls/turn the session is
   $0.115215; at 6 it is $0.144975 — a ±11% band around $0.130, because the frontier turn
   is present in every variant and dominates each one. Effort tuning on the tutoring turn
   is worth more than the entire classifier line.

---

## 4 · At the §7 load

### 4.1 Per learner-day

| Figure | Arithmetic | Value |
|---|---|---:|
| **Cost per active learner-day** | one 12-turn session | **$0.130095** |
| Cost per session | same thing, said the other way | $0.130095 |
| Cost per turn | $0.130095 / 12 | $0.010841 |
| Cost per *enrolled* learner-day | 8,000 × $0.130095 / 42,000 | $0.024780 |

The two learner-day figures are different questions. **$0.130** is what a child who used
the tutor today cost. **$0.0248** is what the average enrolled learner cost, and it is the
one that belongs in a margin conversation — at the modelled load only ~19% of enrolled
learners have a session on a given day (8,000 ÷ 42,000).

### 4.2 Daily and monthly

| Figure | Arithmetic | Value |
|---|---|---:|
| Daily inference spend | 8,000 × $0.130095 | **$1,040.76** |
| Monthly (30 days) | $1,040.76 × 30 | **$31,222.80** |
| Monthly, frontier tier only | 8,000 × $0.107775 × 30 | $25,866.00 |
| Monthly, classifier tier only | 8,000 × $0.022320 × 30 | $5,356.80 |
| Monthly per family | $31,222.80 / 30,000 | **$1.04** |
| Monthly at doc 12 §7's 2–6 call range | 8,000 × 30 × {$0.115215 … $0.144975} | $27,652 … $34,794 |

### 4.3 Peak — 3–7pm local

Not a cost figure, a rate-limit sizing figure. Assume 60% of sessions land in the peak
window, spread across four continental time zones, so the national envelope is 3pm ET to
7pm PT — **7 wall-clock hours**, not 4. Assume a 20-minute session.

```
peak sessions           8,000 × 0.60          = 4,800
sessions started/hour   4,800 / 7             =   686
concurrent sessions     686 × (20 / 60)       =   229
turns/minute            229 × 12 / 20         =   137
turns/second            137 / 60              =  2.29
```

| Tier | Calls/s | ITPM | OTPM |
|---|---:|---:|---:|
| `claude-opus-5` | 2.29 | 2.29 × (900 + 120) × 60 ≈ **140k** | 2.29 × 300 × 60 ≈ **41k** |
| `claude-haiku-4-5` | 6.86 | 6.86 × 520 × 60 ≈ **214k** | 6.86 × 20 × 60 ≈ **8k** |

Cache-read tokens count against ITPM, so the frontier ITPM figure includes the 900-token
cached prefix even though it is billed at $0.50/MTok. **These numbers must be checked
against the organisation's actual tier limits before Phase 2** — `claude-opus-5` draws on
a rate-limit bucket separate from the Opus 4.x pool, so headroom on an older model is not
headroom here. The Batch API's 50% discount does not apply to any of this: a child is
waiting.

---

## 5 · Sensitivity

Ordered by how much money the assumption moves, which is not the order anyone expects.

### 5.1 Frontier effort — the largest lever, and it is not the routing split

`tutor-model.ts` runs `output_config: { effort: 'low' }` with adaptive thinking, and the
file argues for it on latency grounds: a coaching turn is "one pedagogical move on a
problem the brief already frames" with "a child waiting for a reply". Raising it to
`high` (the API default) plausibly takes output from 300 to ~700 tokens/turn.

| | Output/turn | Frontier subtotal | Session | vs baseline | Monthly |
|---|---:|---:|---:|---:|---:|
| `effort: 'low'` (current) | 300 | $0.107775 | $0.130095 | 1.00× | $31,223 |
| `effort: 'high'` | 700 | $0.227775 | $0.250095 | **1.92×** | **$60,023** |

A single parameter on one line of one file is worth **more than the entire classifier
tier** ($28,800/month vs $5,357/month). This is the number to defend in review.

### 5.2 Classification wrongly routed to the frontier model

The failure doc 12 §7's cost control exists to prevent: the 36 classifier calls per
session go to `claude-opus-5`. The 400-token classifier prompt is *also* below Opus 5's
512-token cache minimum, so it stays uncached — the input line simply reprices at 5×.

**Sub-case A — misrouted with `thinking: { type: 'disabled' }`.** Price ratio only.

| Line | Tokens | Rate | Cost |
|---|---:|---:|---:|
| Input | 18,720 | $5.00/MTok | $0.093600 |
| Output | 720 | $25.00/MTok | $0.018000 |
| Classifier subtotal | | | $0.111600 |
| **Session** | | | **$0.219375** (**1.69×**) |
| **Monthly** | 8,000 × 30 | | **$52,650** — **+$21,427** |

**Sub-case B — misrouted and left on the default.** This is the realistic one, and it is
much worse. **Thinking is on by default on `claude-opus-5`**: a request that omits the
`thinking` parameter thinks, where the same omission on Opus 4.8 and earlier meant no
thinking. A misroute that copies the tutoring cell's config, or copies nothing at all,
turns a 20-token label into a ~250-token reasoning trace.

| Line | Tokens | Rate | Cost |
|---|---:|---:|---:|
| Input | 18,720 | $5.00/MTok | $0.093600 |
| Output | 250 × 36 = 9,000 | $25.00/MTok | $0.225000 |
| Classifier subtotal | | | $0.318600 |
| **Session** | | | **$0.426375** (**3.28×**) |
| **Monthly** | 8,000 × 30 | | **$102,330** — **+$71,107** |

The lesson is not "the frontier model is 5× the price". It is that **most of the damage
comes from the frontier model's generation behaviour, not its price**: of the 2.28×
*increase* over baseline, the output line alone is 1.70× — three quarters of the damage,
from a parameter nobody set. A misroute triples the bill and, because every classification still
returns a correct label, produces no failing test, no error rate, and no latency alarm
that reads as a bug rather than as load. The only signal is the invoice.

Two controls follow, both in `docs/design/inference-gateway.md`:

- **§3's routing table is `as const satisfies Record<InferenceRole, RoutingCell>`.** A
  role maps to a model in checked-in code; callers name a role and cannot name a model.
- **§2.2's `ModelProfile.supportsAdaptiveThinking` and `supportsEffort` are data.** The
  adapter omits `thinking` and `output_config.effort` for a profile that does not declare
  them — which also happens to be required, since `claude-haiku-4-5` rejects
  `output_config.effort` outright.

And the operational backstop: **`dailyUsdCeiling` breaches logged at warning severity**
(inference-gateway §7.3). Hitting a dollar ceiling before a turn ceiling means a turn is
costing far more than this worksheet predicts, which is exactly the misroute's signature.

### 5.3 Cache expiry on the frontier system half

`tutor-model.ts` sets `cache_control: { type: 'ephemeral' }` with no `ttl`, so the entry
lives 5 minutes. A child who reads a hint, thinks, and comes back after six minutes has
let it expire, and the next turn pays a fresh write.

| Gaps > 5 min per session | Writes | Reads | Net delta | Session | Monthly delta |
|---:|---:|---:|---:|---:|---:|
| 0 (baseline) | 1 | 11 | — | $0.130095 | — |
| 3 | 4 | 8 | +$0.015525 | $0.145620 | **+$3,726** |

Small in absolute terms, and worth naming for two reasons: it is invisible in any
per-request view, and the fix (a 1-hour TTL at 2× write cost) is only worth it if gaps are
frequent — a 1-hour write needs two reads to pay for itself, so a session with one long
gap is better off on the 5-minute default. Left as-is until there is session-timing data.

### 5.4 Turns per session

Near-linear, because the only amortised line is a $0.0056 cache write.

| Turns | Frontier | Classifier | Session | Monthly |
|---:|---:|---:|---:|---:|
| 8 | $0.073575 | $0.014880 | $0.088455 | $21,229 |
| **12** | **$0.107775** | **$0.022320** | **$0.130095** | **$31,223** |
| 20 | $0.176175 | $0.037200 | $0.213375 | $51,210 |

This is the line the per-learner daily budget acts on. At
`docs/design/inference-gateway.md` §7.1's default of `dailyTurns: 40`, the ceiling is
40 × $0.010841 = **$0.434/learner-day** — 3.3× the modelled session, which is deliberate slack: the budget
exists to stop a runaway loop and to carry doc 07's break-nudge, not to ration a child
who is working hard.

### 5.5 Provider price change

The model is linear in price, so the frontier rate carries 83% of any move. A 20% frontier
increase is +$5,173/month; a 20% classifier increase is +$1,071/month. Doc 12 §7's
"provider price/perf re-evaluated behind the gateway without app changes" is the response,
and `ModelProfile.inputUsdPerMTok` / `outputUsdPerMTok` (inference-gateway §2.2) is where
the numbers live so a re-evaluation is a data change.

---

## 6 · What this model does not cover

Named so the total is not read as an all-in figure.

- **Vision.** Homework capture (doc 24) sends an image. Image input is billed as input
  tokens and can be several thousand per image on the current high-resolution tier. This
  worksheet models the *coaching* turn on already-extracted text; the capture turn is a
  separate line and is not costed here.
- **Distillation.** Doc 12 §4's transcript → derived facts job is a model call per session
  that this model omits. It is a candidate for the Batch API's 50% discount — it is
  asynchronous by construction and nobody is waiting.
- **Retrieval.** pgvector embeddings for curriculum lookup (doc 12 §4). Postgres CPU, plus
  an embedding call not costed here.
- **Everything that is not inference.** Doc 12 §7's premise is that this is the rounding
  error, and at $31.2k/month of tokens against 30,000 families it is.
- **Negotiated pricing.** §1.2 is list price. Doc 12 §7's cost ceiling should be defended
  at list, so a discount is headroom rather than a load-bearing assumption.

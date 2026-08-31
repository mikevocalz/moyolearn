# Tutor Model Routing
**Date:** 2026-08-31  
**Source of truth:** `docs/pack/18-tutor-ai-stack.md` §2-§3 · `docs/pack/33-moyo-learn-prd.md` §11 · `packages/inference/src/routing.ts` · `packages/app/features/tutor/tutor-capabilities.ts`  
**Status:** Routing table accepted and seeded. Eval gate is pending harness.

---

## 1. Principle

Claude is the default tutor brain. Gemini is a paired capability, used only for verified lanes. A model is not assigned to a subject×grade cell until it passes that cell's evaluation. Failover is allowed only to another eval-passed cell. On-device ExecuTorch handles perception and structuring, never the learner-facing turn.

This design satisfies the one-voice rule (doc 32): model routing never changes the tutor identity — the provider is infrastructure, Natalie is the product.

## 2. Registry shape

```ts
tutorCapabilities[subject][gradeBand][task] -> TutorCell
```

Each `TutorCell` resolves:

- `primary` — the `InferenceRole` used for the turn.
- `allowedFallbacks` — other `InferenceRole`s that passed this cell's evals.
- `tools` — required deterministic tools (e.g. arithmetic, symbolic math, code runner).
- `vision` — whether a multimodal input is required.
- `grounding` — whether curriculum RAG is required.
- `safety` — the active safety policy for this cell.
- `maxLatencyMs` — p95 latency ceiling.
- `costCeiling` — per-turn dollar ceiling for this cell.
- `enabled` — false until the eval harness passes this cell.

## 3. Initial routing table

| Subject/task | Primary lane | Paired capability/tool | Notes |
|---|---|---|---|
| General tutoring | `tutor-turn` (Claude Opus 5, low effort) | n/a | Default for an unrecognised subject. |
| Elementary mathematics (K-5) | `tutor-turn` (Claude) | `arithmetic` tool for deterministic checks | Visual manipulatives served by the canvas. |
| Arithmetic / fractions / pre-algebra | `tutor-turn` (Claude) | `arithmetic` tool | No symbolic math yet. |
| Algebra through calculus | `tutor-turn` (Claude) | `symbolic-math` / Wolfram-type verifier | Equations rendered in the canvas. |
| Geometry, graph-heavy math | `tutor-turn` + `vision` (Gemini) | `geometry` tool | Gemini vision only for the confirmed diagram crop. |
| ELA / writing | `tutor-turn` (Claude) | `rubric`, readability gate | Output measured against band readability. |
| Literature / humanities | `tutor-turn` (Claude) | `source-retrieval` | Approved citations and grounding. |
| Biology / Earth science | `tutor-turn` (Claude) | `vision` (Gemini) for diagrams | Diagram crop confirmed before upload. |
| Chemistry / physics | `tutor-turn` (Claude) | `unit-aware` computation + `vision` | Numerical verification, not model guessing. |
| History / civics / geography | `tutor-turn` (Claude) | `curriculum-rag` | Current-events grounded where required. |
| Computer science / coding | `tutor-turn` (Claude) | `sandboxed-code` | Code executed in a sandbox, not an answer. |
| World languages | `tutor-turn` (Claude default) | Local STT/pronunciation signals, ElevenLabs Natalie voice | Eval winner can replace Claude default. |
| Art / design analysis | `tutor-turn` (Claude) | `vision` (Gemini) for visual perception | Confirmed image or crop. |
| Music theory | `tutor-turn` (Claude) | Deterministic theory tools | No performance audio analysis. |
| Test preparation | `tutor-turn` (Claude) | `verified-item-bank`, standards mapping | Never reveal the answer. |

## 4. Paired capability rules

1. **Do not call two cloud models for the same turn merely to combine them.** That doubles cost and latency.
2. Permitted sequences:
   - Local perception → Gemini visual interpretation **only when necessary** → Claude tutoring turn.
   - Claude tutoring turn → deterministic subject tool → verified response.
   - Direct eval-winner per subject×band cell.
   - Second cloud model only for a defined verifier lane.
3. The learner's raw voice and face never go to any cloud provider. Only reviewed transcript text and confirmed crops cross the boundary.

## 5. Evaluation gate

A provider wins a `subject × grade band × task` cell only after passing an eval suite. The harness is PR-50 (doc 18 §7). Until the harness passes a cell, `enabled` is `false` and the cell falls back to the safe default: Claude + `tutor-turn`.

Eval dimensions:

- Subject correctness
- Pedagogical quality (Socratic, answer-withholding)
- Near-correct recognition
- Misconception diagnosis
- Strategy change after repeated failure
- Grade-level readability
- Tone appropriateness
- Tool-use correctness
- Citation/grounding quality
- Safety
- Latency
- Cost
- Structured-output reliability

## 6. Canonical local model

Qwen 3.5 0.8B Quantized (`QWEN3_5_0_8B_QUANTIZED`) is the single local language model. It does not replace the tutor brain. Its permitted lanes are:

- Subject and task classification
- OCR text cleanup and structuring
- Separating multiple detected homework problems
- Equation/instruction/answer-choice extraction
- Language identification
- "Answer vs. tutoring" detection
- Deterministic subject tool selection
- Structured context preparation for the cloud tutor
- Low-risk offline metadata generation

## 7. Sources

- `docs/pack/18-tutor-ai-stack.md` §2-§3
- `docs/pack/32-tutor-voice-tone.md`
- `packages/inference/src/routing.ts`
- `packages/inference/src/models.ts`

## 8. SOT Keywords

SOT-KEYWORDS: tutor model routing claude gemini executorch qwen capabilities subject grade band eval gate

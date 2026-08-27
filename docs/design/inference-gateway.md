<!--
  The Inference Gateway — doc 12 §9.3. Server-only, and the sole egress to a
  model provider. Written against the Anthropic SDK surface the repo already
  calls (`packages/app/features/tutor/tutor-model.ts:streamTutorTurn`), not
  against a generic "LLM client" abstraction: the fields below are the fields
  that file passes today, and the shapes that do not exist yet are labelled.
  SOT: docs/pack/12-systems-design-prompt.md §3 §5 §7 §9.3 · docs/pack/07-security-child-ai-safety-spec.md §3 §4 · docs/pack/18-tutor-ai-stack.md §2 §3 · docs/pack/01-ai-tutoring-platform-plan.md ADR-005
  SOT-KEYWORDS: inference gateway provider adapter routing table pseudonymization streaming sentence window budget fail closed egress anthropic claude
-->

# The Inference Gateway

**Doc 12 §9.3 · Date: Aug 27, 2026 · Status: spec, not yet built as a package**

The gateway is the one place in the system that talks to a model provider. Everything
else — features, services, the Safety Plane — reaches a model by handing the gateway a
value, never by holding a client. Doc 12 §3 puts it in the server core as "sole egress to
model providers"; this document says what that means in types.

**The gateway does not exist as a package yet.** What exists is its single realised
adapter, `packages/app/features/tutor/tutor-model.ts`, which the file's own header calls
"the ONLY file in the codebase that imports a model vendor's SDK". This spec's job is to
name the interface that file already satisfies by accident, so the second adapter is a
file rather than a refactor.

---

## 1 · What already holds the boundary

Four seams do the work today. Everything below is built on them, and nothing below asks
any of them to change shape.

| Seam | `file:symbol` | What it guarantees |
|---|---|---|
| The vendor call | `packages/app/features/tutor/tutor-model.ts:streamTutorTurn` | The only `@anthropic-ai/sdk` import in the repo |
| The call's type | `packages/student-model/src/inference.ts:ModelStreamCall` | `(prompt: TutorPrompt) => AsyncIterable<string>` — takes no identity, returns no metadata |
| The prompt | `packages/student-model/src/inference.ts:TutorPrompt` | `{ system: string; message: string }` — two strings, and that is the entire egress payload |
| The only consumer | `packages/student-model/src/inference.ts:withLearnerBriefStream` | Turns a `ModelStreamCall` into a `StreamingGenerator`, which only `packages/safety/src/plane.ts:runSafetyPlaneStream` accepts |

The chain is load-bearing rather than decorative: a `ModelStreamCall` has no argument that
accepts a learner, and the only function that accepts one produces a value that only the
Safety Plane consumes. There is no argument order that gets a model in front of a child
with the plane skipped.

**The current default model in use is `claude-opus-5`**, pinned as
`packages/app/features/tutor/tutor-model.ts:TUTOR_MODEL`. It is a module constant rather
than an environment read, and the file states why: "which model teaches a child is a
decision that belongs in a reviewed commit, not in a deploy variable." The gateway keeps
that property — the routing table in §3 is a checked-in `as const` map, not config.

---

## 2 · Provider adapter interface

### 2.1 What the SDK surface actually is

`streamTutorTurn` uses exactly this much of `@anthropic-ai/sdk` (pinned
`0.120.0` in `pnpm-workspace.yaml`):

- `new Anthropic()` — zero-arg, credentials resolved from the environment
- `client.messages.stream(params)` → a `MessageStream`
- `params`: `model`, `max_tokens`, `thinking: { type: 'adaptive' }`,
  `output_config: { effort: 'low' }`,
  `system: [{ type: 'text', text, cache_control: { type: 'ephemeral' } }]`,
  `messages: [{ role: 'user', content }]`
- stream events: `event.type === 'content_block_delta'` →
  `event.delta.type === 'text_delta'` → `event.delta.text`
- `await stream.finalMessage()` → `Message`, of which it reads `stop_reason`

The interface below is that list plus the two fields the file discards and the gateway
needs: `Message.usage` (for §5's budget) and `Message.model` (for the audit trail). It
adds no SDK shape that is not in the list.

### 2.2 The interface

```ts
// packages/inference/src/adapter.ts — NOT YET IMPLEMENTED
import 'server-only';

/**
 * Which job a call is doing. Not a model name — the routing table (§3) maps a
 * role to a model, and a caller that could name a model could name the wrong one.
 */
export type InferenceRole = 'tutor-turn' | 'classify-input' | 'classify-output' | 'topic-fence';

/**
 * The entire egress payload. Structurally `TutorPrompt`
 * (packages/student-model/src/inference.ts:TutorPrompt) plus nothing: two
 * strings, no identity, no session handle, no free-form metadata bag. A `Record`
 * of extras is the field a name eventually arrives in, so there isn't one.
 */
export interface InferencePayload {
  /** Policy half. Stable within a session, so it carries the cache breakpoint. */
  readonly system: string;
  /** The turn being reasoned about or classified. */
  readonly message: string;
}

/**
 * Per-model capability, because the two tiers do NOT take the same parameters.
 * Claude Haiku 4.5 does not support `output_config.effort` at all and uses the
 * older manual-thinking mode; sending the frontier tier's `thinking: adaptive`
 * + `effort` to it is a 400, not a no-op. Encoding this as data is what keeps
 * §3's misroute a routing bug rather than a runtime crash.
 */
export interface ModelProfile {
  readonly id: string;
  readonly supportsEffort: boolean;
  readonly supportsAdaptiveThinking: boolean;
  /** Below this, `cache_control` is accepted and silently does nothing. */
  readonly minCacheablePrefixTokens: number;
  readonly inputUsdPerMTok: number;
  readonly outputUsdPerMTok: number;
  readonly cacheReadUsdPerMTok: number;
  readonly cacheWriteUsdPerMTok: number;
}

/** `Message.usage`, field-for-field. Named here so the budget can read it. */
export interface InferenceUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadInputTokens: number;
  readonly cacheCreationInputTokens: number;
}

/**
 * `Message.stop_reason`, narrowed to the values a tutoring or classification
 * turn can produce. `tool_use` is absent because the gateway declares no tools:
 * a tool argument is the classic route by which an identity re-enters a payload
 * that CLAUDE.md forbids it from entering.
 */
export type InferenceStop =
  | 'end_turn'
  | 'max_tokens'
  | 'stop_sequence'
  | 'refusal'
  | 'pause_turn'
  | 'model_context_window_exceeded';

/** What `stream.finalMessage()` is worth keeping. */
export interface InferenceOutcome {
  readonly stop: InferenceStop;
  readonly usage: InferenceUsage;
  /** The model that actually served the turn — not the one that was requested. */
  readonly servedBy: string;
}

/**
 * A streamed turn. Text deltas arrive on the iterable; the terminal metadata
 * arrives on `settled`, which resolves only after the iterable is exhausted.
 *
 * Two channels rather than a union frame because the Safety Plane's streaming
 * path (packages/safety/src/plane.ts:runSafetyPlaneStream) consumes a plain
 * `AsyncIterable<string>` and buffers it into sentences. A metadata frame
 * interleaved with the text would have to be filtered out inside the sentence
 * window, which is the one loop in the system that must stay boring.
 */
export interface InferenceStream {
  readonly text: AsyncIterable<string>;
  readonly settled: Promise<InferenceOutcome>;
}

/**
 * The provider adapter. One implementation per vendor; `AnthropicAdapter` is the
 * only one for v1 (ADR-018 §1: Claude is the tutor brain).
 *
 * `stream` is the tutoring turn. `complete` is a classifier call: one shot, no
 * stream, because a class label has nothing to render progressively and the
 * plane needs it whole before it can route on it.
 */
export interface ProviderAdapter {
  readonly vendor: 'anthropic';
  /** The models this adapter can serve, keyed by the id in the routing table. */
  readonly profiles: Readonly<Record<string, ModelProfile>>;

  stream(request: InferenceRequest): InferenceStream;
  complete(request: InferenceRequest): Promise<InferenceCompletion>;
}

export interface InferenceRequest {
  readonly modelId: string;
  readonly payload: InferencePayload;
  readonly maxTokens: number;
  /** Applied only when `ModelProfile.supportsEffort`. */
  readonly effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
  /** Applied only when the system half clears `minCacheablePrefixTokens`. */
  readonly cacheSystem: boolean;
  /** The child navigated away; tear the vendor stream down rather than bill it. */
  readonly signal?: AbortSignal;
}

export interface InferenceCompletion {
  readonly text: string;
  readonly outcome: InferenceOutcome;
}
```

### 2.3 How `AnthropicAdapter.stream` maps onto the SDK

Line for line against what `streamTutorTurn` does today:

| Interface field | SDK param it becomes |
|---|---|
| `request.modelId` | `model` |
| `request.maxTokens` | `max_tokens` (currently `MAX_TOKENS = 1024`) |
| `request.effort`, when `supportsEffort` | `output_config: { effort }` |
| `supportsAdaptiveThinking` | `thinking: { type: 'adaptive' }`; **omitted entirely** when false |
| `payload.system` + `cacheSystem` | `system: [{ type: 'text', text, cache_control: { type: 'ephemeral' } }]` |
| `payload.message` | `messages: [{ role: 'user', content }]` |
| `request.signal` | the SDK's per-request options `signal` |
| `InferenceStream.text` | `content_block_delta` → `delta.text_delta` → `delta.text` |
| `InferenceStream.settled` | `await stream.finalMessage()` → `stop_reason`, `usage`, `model` |

Two behaviours are inherited rather than invented:

- **`stop_reason === 'refusal'` is not a tutor turn.** `streamTutorTurn` throws on it,
  and the comment says why: ending the stream silently "would render as Natalie trailing
  off mid-thought". The gateway keeps the throw and adds the reason —
  `Message.stop_details.category` — to the safety log.
- **Server-side refusal fallback should be on for the tutoring turn.** The frontier tier
  runs safety classifiers of its own that can decline a benign turn; opting in means a
  declined turn is re-run on a fallback model inside the same call instead of surfacing.
  This is `fallbacks: 'default'` with the `server-side-fallback-2026-07-01` beta on
  `client.beta.messages.stream`, and it *strengthens* the existing check: with fallbacks
  on, a `refusal` on the final message means the whole chain refused, which is
  unambiguously the fail-closed case in §6. **NOT YET IMPLEMENTED** — `tutor-model.ts`
  calls the non-beta `client.messages.stream` today.

---

## 3 · Routing table

Doc 12 §7's binding cost control: "small model for L3/L5 classification and topic
fencing; frontier model only for the tutoring turn."

```ts
// packages/inference/src/routing.ts — NOT YET IMPLEMENTED
export const ROUTING = {
  'tutor-turn':      { model: 'claude-opus-5',    maxTokens: 1024, effort: 'low' },
  'classify-input':  { model: 'claude-haiku-4-5', maxTokens: 64 },
  'classify-output': { model: 'claude-haiku-4-5', maxTokens: 64 },
  'topic-fence':     { model: 'claude-haiku-4-5', maxTokens: 64 },
} as const satisfies Record<InferenceRole, RoutingCell>;
```

**Concrete model ids.** Frontier: `claude-opus-5`. Small fast: `claude-haiku-4-5`.
`claude-sonnet-5` is deliberately absent — it is the fallback candidate if Haiku's
classification recall proves insufficient, and adding it is a routing-table commit.

### Where each is decided

| Role | Decided today at | Decided under this spec |
|---|---|---|
| Tutoring turn | `packages/app/features/tutor/tutor-model.ts:TUTOR_MODEL` — the pinned `claude-opus-5` const | `ROUTING['tutor-turn']`, same pinning discipline |
| L3 input classification | **No model call exists.** `packages/app/features/tutor/tutor-safety.ts:coachClassifier.classifyInput` is deterministic regex over `CRISIS_PATTERNS` / `PROHIBITED_PATTERNS` / `SENSITIVE_PATTERNS` | `ROUTING['classify-input']` |
| L5 output classification | **No model call exists.** `coachClassifier.classifyOutput` runs the same patterns over the generated text; `packages/safety/src/firewall.ts:screen` runs the six `FIREWALL_RULES` | `ROUTING['classify-output']` |
| L4 topic fence | **No model call exists.** `tutor-safety.ts` documents this as a deliberate omission: the arithmetic classifier "would fence off the entire product" on a photographed word problem, so the fence was replaced by a deterministic floor plus the pedagogy contract | `ROUTING['topic-fence']` |

Three of the four routing cells therefore route calls that are not yet made. That is the
honest state, and it matters for two reasons:

1. **The deterministic floor is not replaced, it is added to.** `tutor-safety.ts` calls
   itself "a floor, and the ceiling is named". A model-backed classifier runs *after* the
   regex, never instead of it — the regex families are the ones where being wrong is
   unacceptable, and a model cannot be argued out of a `RegExp`.
2. **Per-cell routing is gated on evidence, not on this document.** Doc 18 §3 layer 5
   makes `tutorCapabilities[subject][band]` (PR-50, the eval registry) the routing table's
   source of truth, fail-closed per cell. The map above is the v1 default the registry
   overrides, not a claim that the bake-off has run.

**Provider outage.** Doc 12 §7 specifies "gateway fallback chain, else the fail-closed
pause". The chain is §2.3's `fallbacks: 'default'` for policy declines; a transport-level
outage is not a decline and does not fall back — it goes to §6.

---

## 4 · Pseudonymization boundary

ADR-005 §1 (`docs/pack/01-ai-tutoring-platform-plan.md`): "Pseudonymous payloads only —
learner session handle, grade band, concept, mastery, attempt, misconception; never
name/DOB/school/contact." Doc 07 §4: "Child conversations never enter any training
pipeline," enforced by architecture — "the training/eval pipeline has no read path to the
educational store."

### 4.1 Exactly what crosses

Two strings, and this is the complete list.

**`payload.system`** = `PEDAGOGY_CONTRACT` + `briefPreamble(brief)`, assembled at
`packages/student-model/src/inference.ts:withLearnerBriefStream`.

- `packages/app/features/tutor/pedagogy.ts:PEDAGOGY_CONTRACT` — a checked-in constant.
  Provider-independent, learner-independent, identical for every child.
- `packages/student-model/src/inference.ts:briefPreamble` renders
  `packages/student-model/src/brief.ts:LearnerBrief`, whose complete field list is:
  `gradeBand`, `frontier[{ skillTitle, sentence }]`, `misconceptions[{ sentence,
  strategy }]`, `reviewDue[]`, `interests[]`, `scaffoldDepth`. Capped at 3 entries each
  (`MAX_FRONTIER`, `MAX_MISCONCEPTIONS`, `MAX_REVIEW`, `MAX_INTERESTS`).

**`payload.message`** = the turn assembled at
`packages/app/features/tutor/coach.service.ts` from `CoachTurnInput.problem` and
`CoachTurnInput.message` — the captured worksheet and what the child just typed.

### 4.2 What is stripped, and where

| Stripped | Where | Why it is structural |
|---|---|---|
| `learnerId` | Never enters. `packages/student-model/src/inference.ts:BriefLookup` is `(context: IdentityContext) => Promise<LearnerBrief>` — the id is the *retrieval key*, and `LearnerBrief` has no field to carry it forward | The type has no id field, so there is no assignment to forget |
| `IdentityContext` entire | `withLearnerBriefStream` closes over it and passes only `TutorPrompt` to `ModelStreamCall` | `ModelStreamCall` takes one parameter and it is not an identity |
| Name, DOB, school, contact | Never in the educational store's derived facts to begin with; `packages/student-model/src/facts.ts:DerivedFact` is mastery/misconception/review/interest/scaffolding only | Doc 07 §4 Loop A: raw transcript → derived facts → transcript expiry |
| Raw transcript | `packages/student-model/src/distill.ts:distill` produces facts; `transcriptExpiry` schedules the raw text's death (`TRANSCRIPT_TTL_DAYS`) | ADR-006: raw conversation is "ephemeral processing material" |
| Unresolved-only misconceptions | `brief.ts` — "a retired misconception is history, not context" | Minimises the payload as a side effect of getting the pedagogy right |

`inference.ts`'s own header states the design intent plainly: the preamble is assembled in
code rather than from a template "because a template is a file someone edits at 2am to
'just add the child's name for warmth'. Everything that reaches the model is a field of
`LearnerBrief`, and `LearnerBrief` has no field for a name."

### 4.3 The gap this spec does not close

`payload.message` carries the child's own words and OCR'd worksheet text verbatim. A
photographed worksheet header can say `Name: ______` filled in. Nothing redacts it:
`packages/safety/src/plane.ts:screenInput` calls
`packages/safety/src/firewall.ts:screen(message, 'learner')`, whose six rules are
`secrecy` / `exclusivity` / `claimed-feelings` / `discourages-adults` / `human-roleplay` /
`contact-request` — grooming-pattern rules, not a PII scrubber, and `contact-request` is
scoped to the *tutor* asking, not the child volunteering.

**NOT YET IMPLEMENTED — inbound PII redaction.** The gateway should run a deterministic
scrub over `payload.message` immediately before egress: strip `Name:`/`Student:` header
captures from OCR text, and mask email/phone/street-address shapes. Deterministic rather
than model-backed, because a redactor that needs a model call to decide what to redact has
already sent the thing it was redacting.

### 4.4 How it is tested

**Exists.**

- `packages/student-model/src/student-model.test.ts:160` —
  `assert.equal(briefPreamble(brief).includes('learner-9'), false)`. The learner id does
  not reach the prompt, asserted on the real `briefPreamble` rather than a mock, which is
  why the function is exported at all (its docblock says so).
- `tooling/check-no-training-path.mjs`, wired into `package.json:scripts.lint`. It fails
  the build if anything under `packages/training`, `packages/evals`, `packages/eval`,
  `packages/fine-tune`, `tooling/training`, or `tooling/evals` imports `@acme/payload`,
  `@acme/auth`, `@acme/safety`, `features/`, or `repositories/`. It is currently vacuous —
  no such pipeline exists — and it prints that fact rather than a bare "OK", because "a
  gate that silently passes because it is guarding an empty room reads identically to one
  that is working."

**Owed by this spec.**

- **An egress assertion at the adapter.** A test that drives `AnthropicAdapter` with a
  fake transport and asserts the outbound `system` and `messages[0].content` match
  `/^[\s\S]*$/` minus a fixture list of forbidden tokens (the learner id, the fixture
  child's name, a DOB, an email, a phone number). The existing test asserts the *preamble*
  is clean; nothing asserts what the *adapter* actually put on the wire.
- **A `LearnerBrief` shape guard.** A type-level test that fails when a field is added to
  `LearnerBrief` without a reviewer acknowledging it — the interface is the payload
  allowlist, so widening it silently widens egress.
- **Extend `check-no-training-path.mjs` to `packages/inference`.** The gateway is the one
  package that legitimately holds provider credentials; it must not also be able to read
  the educational store directly. Adding it to `FORBIDDEN`'s complement — i.e. asserting
  `packages/inference` imports neither `@acme/payload` nor `repositories/` — makes "the
  gateway cannot read a child's record" a build failure rather than a convention.

**Contract, not just code.** ADR-005 §2 requires no-training and zero/limited-retention
terms in the provider agreement, and ADR-005 §4 requires a sub-processor registry
enumerating every provider with purpose and retention. Those are procurement artefacts;
this spec notes them so the architecture claim is not doing work the contract should do.

---

## 5 · Streaming + sentence-window screening

### 5.1 What already runs

`packages/safety/src/plane.ts:runSafetyPlaneStream` is the sentence window, and it is
built. Its docblock states the problem exactly: doc 07 §3 layer 5 says generated text is
screened *before* it is rendered, which "reads as a prohibition on streaming". The
resolution is that the plane emits only whole sentences, and only after `screen()` passes
them. Time-to-first-token becomes time-to-first-sentence.

- `packages/safety/src/plane.ts:takeSentences` closes a window on sentence-ending
  punctuation followed by whitespace, or a newline, with a digit guard so `divide 7.5 by 3`
  does not emit `divide 7.` as a finished, wrong instruction. The separating whitespace
  travels with the sentence it closes, so emitted chunks concatenate back to exactly what
  the model produced.
- Per sentence: `screen(emit, 'tutor')` — the deterministic firewall. A failure yields a
  terminal `blocked`.
- After the loop: the trailing buffer is flushed and screened, then the **assembled draft**
  is screened once more, because a banned construction can straddle a sentence boundary.
- Finally `classifier.classifyOutput(draft, context)` runs once on the whole turn, since a
  classifier needs the whole turn to judge it.

The plane's own docblock names the residual gap and does not paper over it: the whole-turn
classifier verdict "arrives as a terminal `blocked` outcome" after text is already on
screen, "which is a real gap for the seconds the text is on screen, and it is why the
sentence window (not the classifier) carries the hard rules."

### 5.2 Screening in terms of the existing `CoachEvent` frames

`packages/app/features/tutor/coach.service.ts:CoachEvent` is the wire contract and this
spec adds nothing to it. The four non-terminal frames already carry the whole design:

| Frame | Meaning fixed by `coach.service.ts` | What the gateway maps onto it |
|---|---|---|
| `chunk` | A sentence that passed the per-sentence firewall — append it | Vendor text deltas, buffered by `takeSentences`, one screened window at a time |
| `replace` | **Retraction.** "Discard what you have already rendered" | A late verdict on already-rendered text: the whole-draft `screen()`, the whole-turn `classifyOutput`, and `packages/app/features/tutor/pedagogy.ts:revealsAnswer` (which runs per sentence *before* the sentence is rendered, because "catching a revealed answer after the child has read it is not catching it") |
| `blocked` | A Safety Plane decision, and a terminal one | Every fail-closed outcome in §6, including classifier unavailability |
| `unavailable` | The turn could not be *attempted* — retryable, and explicitly not `blocked` | Vendor transport failure, missing credential, connection reset before any screened text |

The `replace` / `blocked` distinction is not stylistic. The client honours it:
`packages/app/features/tutor/tutor.store.ts` maps `blocked` → `{ kind: 'paused' }` (which
locks the composer — the fail-closed state) and `unavailable` → `{ kind: 'retry' }`. The
comment there is explicit that conflating the two "sent an unconfigured dev environment
into the fail-closed paused state, which locks the composer and reads to a child as
Natalie having withdrawn."

### 5.3 What the gateway adds to the window

Three things, none of which change a frame:

1. **`InferenceStream.text` is the iterable the plane already consumes.** The adapter
   hands `runSafetyPlaneStream` the same `AsyncIterable<string>` shape it takes today via
   `withLearnerBriefStream`. The sentence loop is untouched.
2. **`InferenceStream.settled` feeds the budget and the log, not the render path.** It
   resolves after the iterable is exhausted, so a token count never races a sentence.
   Because the plane's screening happens between the vendor and the client, the budget
   debit in §5.4 is charged even for a turn that ends `blocked` — the tokens were spent.
3. **A first-sentence deadline.** Doc 12 §2 requires AI first token < 1.5s; the sentence
   window converts that to first *sentence*. The gateway starts a timer at
   `messages.stream` and, if no window has closed by the deadline, emits nothing early —
   it lets the turn run and records the miss against the SLO. It must not flush an
   unscreened partial to make a latency number.

**Cancellation.** `apps/web/app/api/tutor/coach/route.ts`'s `ReadableStream.cancel()`
calls `events.return()` so "the vendor stream is torn down rather than billed to
completion". The gateway threads `InferenceRequest.signal` through to the SDK so the
teardown reaches the socket, not just the generator.

---

## 6 · Fail-closed rule

Doc 12 §5, and doc 12 §8 lists it as the one trade-off with "revisit when: never" —
*"if any safety layer is unavailable, tutoring pauses"*, surfaced as "Natalie is taking a
break", never an error screen at a child.

**The rule as implemented:** a safety layer that cannot render a verdict yields
`{ kind: 'blocked' }`, not `{ kind: 'unavailable' }`. `blocked` is the terminal
plane-decision frame, and the store already turns it into `{ kind: 'paused' }`.

**This is currently vacuous, and will stop being vacuous.** Today L3/L5 are deterministic
regex (`tutor-safety.ts:coachClassifier`) and `screen()` is a pure function over
`FIREWALL_RULES`. Neither can be "unavailable" — they cannot fail without the process
failing. The moment §3's classifier cells start making network calls, a classifier outage
becomes an exception thrown inside the plane's generator, and
`coach.service.ts:coach`'s `catch` block turns *any* throw into
`{ kind: 'unavailable' }` → `{ kind: 'retry' }`.

That would be a child retrying into an unscreened tutor. So the gateway owes a
discrimination that costs nothing today and is load-bearing the day it matters:

```ts
// packages/inference/src/errors.ts — NOT YET IMPLEMENTED
/** A safety layer could not render a verdict. Fail closed, never retry. */
export class SafetyLayerUnavailable extends Error {
  readonly layer: 'classify-input' | 'classify-output' | 'topic-fence';
}
```

`coach.service.ts:coach`'s catch becomes: `SafetyLayerUnavailable` → `{ kind: 'blocked' }`;
everything else → `{ kind: 'unavailable' }`. Two frames, both existing, and the
distinction is the class rather than a string match.

The failure taxonomy, complete:

| Failure | Frame | Client state | Rationale |
|---|---|---|---|
| Classifier call fails / times out | `blocked` | `paused` | Doc 12 §7: "classifier outage → fail closed" |
| Firewall throws | `blocked` | `paused` | Same layer, same rule |
| Brief lookup fails | `blocked` | `paused` | Without a brief the tutor has no grade band; layer 1 has not run |
| `stop_reason === 'refusal'` after fallbacks | `blocked` | `paused` | The provider's own safety layer declined; a decision, not an outage |
| Provider 429 / 5xx / connection reset | `unavailable` | `retry` | Availability failure with the plane intact |
| Missing `ANTHROPIC_API_KEY` | `unavailable` | `retry` | Misconfiguration. The existing throw in `tutor-model.ts:anthropic()` |
| Budget exhausted (§7) | *neither* | session-end UX | Not a failure. See below |

**The guardian-visible half.** Doc 12 §5 requires the pause be "guardian-visible status".
That surface does not exist. **NOT YET IMPLEMENTED** — a paused turn should write a
`safetyEvents` row (doc 12 §4 names the collection) so S27's "what the AI remembers"
screen and the guardian activity review can show *why* Natalie was quiet, without showing
the child an error.

---

## 7 · Budget enforcement

**NOT YET IMPLEMENTED.** There is no budget, quota, or rate-limit code in the repo:
`packages/app/core/protected-operation.ts` runs session → `ProtectedCtx` and nothing else,
so doc 12 §3's "rate limit" step of the Block is also unbuilt.

Doc 12 §7 makes this binding and states the design's best property: *"per-learner daily
inference budget with graceful 'great work today' session-length UX (which is also the doc
07 break-nudge — cost control and child wellbeing point the same direction, use it)."*

### 7.1 Counted in turns, backstopped in dollars

The child-facing budget is a **turn count**, not a dollar figure. Two reasons, and the
second is the important one:

1. A dollar cap is not a thing a session-length nudge can be phrased around. "Great work
   today" is a sentence about effort; "$0.43" is a sentence about a customer.
2. **CLAUDE.md §Children's surfaces: no paywall, price, or upgrade prompt may render on a
   learner surface. Ever.** A budget that surfaces as spend has put a price in front of a
   child. The dollar ceiling exists and is enforced — it is simply not the thing the
   learner sees, and the learner-facing copy has no branch that mentions it.

```ts
// packages/inference/src/budget.ts — NOT YET IMPLEMENTED
export interface LearnerBudget {
  /** Turns per rolling day. The nudge is phrased against this. */
  readonly dailyTurns: number;
  /** Hard ceiling, checked against accumulated `InferenceUsage`. Never rendered. */
  readonly dailyUsdCeiling: number;
  /** Consecutive-turn count that triggers the break nudge mid-session. */
  readonly breakNudgeAfterTurns: number;
}
```

Defaults, derived from `docs/design/capacity.md`: a modelled session is 12 turns at
$0.130. `dailyTurns: 40` (three-plus sessions) with `dailyUsdCeiling: 0.60` — roughly 4.6×
the modelled session, so a child who works unusually hard is never cut off by the ceiling
and a runaway loop is.

### 7.2 Where it is enforced

At the gateway, not at the route. A per-route counter is a counter each new route forgets;
the gateway is the only egress, so a debit there is a debit on every call by construction.

- **Pre-call:** `assertWithinBudget(ctx.learnerId, role)` before the adapter is touched. A
  learner past `dailyTurns` gets no provider call at all — the cheapest possible enforcement.
- **Post-call:** `InferenceStream.settled` resolves with `InferenceUsage`; the gateway
  prices it against `ModelProfile` and debits. Charged even when the plane returned
  `blocked`, because the tokens were spent.
- **Identity:** `learnerId` comes from `ProtectedCtx` at the service boundary, per
  CLAUDE.md. The budget key is never a parameter, and the gateway reads it from the same
  `IdentityContext` that `withLearnerBriefStream` closes over — the same value that never
  reaches the payload.

### 7.3 The UX, in existing frames

Budget exhaustion is **not** a `CoachEvent`. It is not a failure, and routing it through
`blocked` would put a child in the fail-closed paused state for having done their
homework. It is a session-end state the tutor screen owns, reached the ordinary way:

- **Mid-session, at `breakNudgeAfterTurns`:** the gateway does not intervene. It sets a
  flag the tutor service reads and appends to the *next* turn's system half — the coach
  is told to land the current thread and suggest a break. The nudge arrives as coaching
  text through `chunk`, in Natalie's voice, which is what makes it a break-nudge rather
  than a wall.
- **At `dailyTurns`:** the composer closes into a "great work today" summary state before
  a turn is attempted. No frame, no error, no price. Doc 07's break-nudge and doc 12 §7's
  cost ceiling are the same control, and this is the sentence where that pays off.
- **At `dailyUsdCeiling`:** identical child-facing surface. The difference is invisible to
  the learner and logged at warning severity for operations, because hitting a dollar
  ceiling before a turn ceiling means a turn is costing far more than the model in
  `capacity.md` predicts.

---

## 8 · What lands, in what order

Nothing here blocks Wave 2 screens; doc 12 §9 places this at Wave 3+.

1. `packages/inference` with `ProviderAdapter`, `AnthropicAdapter`, and the routing table —
   `tutor-model.ts` becomes a caller instead of a vendor surface.
2. The egress assertion test and the `LearnerBrief` shape guard (§4.4).
3. `SafetyLayerUnavailable` and the `coach.service.ts` catch discrimination (§6). This is
   small, and it must land *before* any classifier cell makes a network call.
4. Budget: the pre-call gate and the post-call debit (§7.2), then the two learner-facing
   states (§7.3).
5. Inbound PII redaction (§4.3).
6. Model-backed L3/L5 classification — last, and only behind PR-50's eval registry.

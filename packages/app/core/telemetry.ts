// The Block's telemetry record — doc 12 §7's claim that "the Block gives uniform
// telemetry for free — every operation logs `{op, resource, action, ctx.kind,
// latency, outcome}` structured", made true.
//
// `docs/design/slo.md` §2.1 makes this the prerequisite that gates every
// latency, availability and outcome rule in that document: `protectedOperation`
// wrapped every server operation and emitted nothing, so there was no SLI to
// alert on. This is the emitter; `protected-operation.ts` is the only caller.
//
// WHY THE DESCRIPTOR IS OPTIONAL. §7 W-1 notes `protectedOperation` has no
// `op`/`resource`/`action` and calls naming them "an API change to every call
// site". Making them required would have meant editing all fourteen call sites
// at once, several of which are owned elsewhere, and a change that has to land
// everywhere lands nowhere. So the descriptor is an option, and its ABSENCE is
// recorded as `attributed: false` rather than guessed at. That is the whole
// design: `count() by attributed` is the burn-down of the remaining call sites,
// visible on the same dashboard as the signal, instead of a TODO in a file.
// An unattributed record still carries latency, outcome, capability and ctx
// kind, so SLO-1, SLO-3 and SLO-4 are measurable today; only per-operation
// grouping (LAT-2) waits on attribution.
//
// WHAT IT MAY NEVER CARRY. No `learnerId`, no `orgId`, no `userId`, no email,
// no message or transcript text (CLAUDE.md · The block; slo.md §3.1). `ctxKind`
// is a four-value enumeration DERIVED from the context; it is the closest this
// record comes to identity and it is deliberately not identifying.
// SOT: docs/pack/12-systems-design-prompt.md §7 · docs/design/slo.md §2.1 · §7 W-1 · CLAUDE.md (The block)
// SOT-KEYWORDS: block telemetry operation record op resource action ctx kind latency outcome structured sink attributed auth mode

import type { Capability } from '@acme/auth/entitlements';

export {
  dropText,
  scrubTelemetryEvent,
  stripUrlParams,
  REDACTED_TELEMETRY,
  type ScrubbableEvent,
  type TextMask,
} from './telemetry-scrub.ts';

/** What the operation does to the resource. */
export type OperationAction = 'read' | 'write' | 'delete' | 'stream';

/** The action as recorded, including the "nobody has named it yet" case. */
export type RecordedAction = OperationAction | 'unspecified';

/**
 * What an operation IS. Grouped into one object rather than three sibling
 * options because the three are meaningless apart — a record with `op` and no
 * `resource` is not a partially attributed operation, it is a broken one, and
 * CLAUDE.md asks for unrepresentable invalid combinations rather than
 * optional-prop soup.
 */
export interface OperationDescriptor {
  /** Dotted operation name, e.g. `ops.leads.list`. A constant, never interpolated with data. */
  op: string;
  /** The collection or domain noun acted on, e.g. `leads`. Never an id. */
  resource: string;
  action: OperationAction;
}

/**
 * How the operation ended. `denied` and `unauthenticated` are separated from
 * `error` because they are the system working: an availability rule that counts
 * a refused upgrade-gated call as a failure burns the error budget every time
 * a lapsed card is correctly turned away (slo.md §4.4).
 */
export type OperationOutcome = 'ok' | 'denied' | 'unauthenticated' | 'error';

/**
 * `ctx.kind` from doc 12 §7, derived rather than stored. Three real kinds plus
 * `anonymous`, which is the only kind an unauthenticated attempt has.
 */
export type OperationCtxKind = 'learner' | 'guardian' | 'org' | 'anonymous';

/**
 * Which branch of `protectedOperation` ran. slo.md §2.1 requires this: the mock
 * branch returns a fixed ctx without calling Better Auth, so a sample taken in
 * that mode measures nothing and has to be excludable at query time rather than
 * silently averaged into a production p95.
 */
export type OperationAuthMode = 'mock' | 'session';

export interface OperationRecord {
  /** Discriminator, so a log drain can select these lines out of everything else. */
  evt: 'op';
  op: string;
  resource: string;
  action: RecordedAction;
  ctxKind: OperationCtxKind;
  /** The capability the operation was judged against. A closed enumeration. */
  capability: Capability;
  latencyMs: number;
  outcome: OperationOutcome;
  authMode: OperationAuthMode;
  /** False when no `OperationDescriptor` was supplied. See the header. */
  attributed: boolean;
}

/** Placeholder used for both `op` and `resource` on an unattributed record. */
export const UNATTRIBUTED = 'unattributed';

/** The minimum of a `ProtectedCtx` this module needs, so it holds no import cycle. */
interface CtxShape {
  isLearner: boolean;
  orgId?: string;
}

/**
 * Which kind of caller this is, from the context and nothing else.
 *
 * Order matters: a child in a school org is a `learner` first. The org tag
 * exists to separate ops-dashboard traffic from family traffic, and folding a
 * learner into it would hide the learner latency SLO inside the org's.
 */
export function ctxKindOf(ctx: CtxShape | null): OperationCtxKind {
  if (!ctx) return 'anonymous';
  if (ctx.isLearner) return 'learner';
  return ctx.orgId ? 'org' : 'guardian';
}

export interface OperationRecordInput {
  descriptor?: OperationDescriptor;
  capability: Capability;
  ctxKind: OperationCtxKind;
  outcome: OperationOutcome;
  /** Wall time across the whole block — session, gate and handler together. */
  latencyMs: number;
  authMode: OperationAuthMode;
}

/**
 * Builds the record. Pure, and the single place identity could ever have been
 * added — which is why the input type has no field that could carry one.
 */
export function operationRecord(input: OperationRecordInput): OperationRecord {
  const { descriptor } = input;
  return {
    evt: 'op',
    op: descriptor?.op ?? UNATTRIBUTED,
    resource: descriptor?.resource ?? UNATTRIBUTED,
    action: descriptor?.action ?? 'unspecified',
    ctxKind: input.ctxKind,
    capability: input.capability,
    // Sub-millisecond precision is noise at a 300 ms SLO and makes every value
    // a distinct string in a log index.
    latencyMs: Math.round(input.latencyMs),
    outcome: input.outcome,
    authMode: input.authMode,
    attributed: descriptor !== undefined,
  };
}

export type OperationSink = (record: OperationRecord) => void;

/**
 * Structured stdout. The collector of last resort, and the only one that exists
 * with no vendor configured: Vercel's log drain picks these up, and `evt` makes
 * them selectable.
 */
export const stdoutOperationSink: OperationSink = (record) => {
  console.info(JSON.stringify(record));
};

let sink: OperationSink = stdoutOperationSink;

/**
 * Points the Block's records somewhere else — `apps/web/instrumentation.ts`
 * installs one that also files them as Sentry breadcrumbs.
 *
 * A settable module-level sink rather than a parameter on `protectedOperation`,
 * because the alternative is threading a logger through fourteen call sites and
 * every service between them, which is the API change W-1 was avoiding.
 * `null` restores the default.
 */
export function setOperationSink(next: OperationSink | null): void {
  sink = next ?? stdoutOperationSink;
}

/**
 * Emits, and never throws.
 *
 * `protectedOperation` calls this from a `finally`, so a sink that fails —
 * a transport with no network, a JSON cycle — would replace the operation's own
 * error with the telemetry's. Observability is not allowed to be the thing that
 * breaks the request it is observing.
 */
export function recordOperation(record: OperationRecord): void {
  try {
    sink(record);
  } catch {
    // Intentionally silent: a second console write here would be the same risk.
  }
}

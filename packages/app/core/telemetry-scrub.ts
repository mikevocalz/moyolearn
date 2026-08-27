// The egress scrubber for error/telemetry events, and the reason doc 12 §7's
// "errors + traces to Sentry" is allowed to be true in a children's product at
// all. `docs/design/slo.md` §3.1 and W-7 make it a precondition of turning any
// reporter on, not a follow-up: a reporter without this ships prompts,
// transcript turns and usernames to a third party.
//
// It is deliberately NOT a second copy of the redaction rules. The masking of
// free text is injected as a `TextMask`, so the server binds
// `@acme/inference`'s `scrubText` — the reviewed, red-teamed rule set that
// already guards the model-egress boundary — and there is exactly one place a
// pattern can drift.
//
// The default mask is `dropText`, not a regex pass. On a client bundle
// (`instrumentation-client.ts`, and the RN JS bundle) `scrubText` is
// unreachable — `pseudonymize.ts` opens with `import 'server-only'`, whose
// browser resolution throws — so the choice there is between a second
// unreviewed rule set and refusing to send free text at all. This refuses.
// Exception TYPE and stack frames survive; the message string does not. That
// costs triage detail and cannot leak a child's words, which is the correct
// direction for the trade.
//
// The shape it operates on is declared structurally rather than imported from
// an SDK: this file must stay usable from the Expo bundle, from the Next server
// runtime, and from a plain `node --test` process, and none of those should
// have to agree on a Sentry version.
// SOT: docs/design/slo.md §3.1 · §7 W-7 · docs/pack/07-security-child-ai-safety-spec.md §4
// SOT-KEYWORDS: telemetry scrub beforeSend sentry pii redaction egress children request body stack vars mask

/** How free-form text is neutralised. The server binds `scrubText`. */
export type TextMask = (text: string) => string;

/** What a dropped string becomes. One token, so a test can count them. */
export const REDACTED_TELEMETRY = '[redacted]';

/**
 * The client-side default: refuse the text entirely.
 *
 * A masker would have to carry its own patterns into the bundle, and a second
 * pattern list that nobody red-teams is the failure this scrubber exists to
 * prevent — §3.1 calls an unscrubbed prompt reaching Sentry "a Safety-Plane
 * skip path by another name".
 */
export const dropText: TextMask = () => REDACTED_TELEMETRY;

interface ScrubbableException {
  /** The error class name — authored in this repo, never user data. Kept. */
  type?: string;
  value?: string;
  /** Frames are only ever deleted FROM, so `object` is all this needs to know. */
  stacktrace?: { frames?: object[] };
}

/**
 * The subset of a Sentry event this scrubber READS. Nothing it merely deletes
 * appears here.
 *
 * That asymmetry is deliberate and it is what makes the file portable: Sentry
 * types `request.data`, `extra` and every `contexts` value as `unknown`, which
 * no honest local declaration can accept, and this repo bans `unknown` outright.
 * Declaring only the readable fields and removing the rest with
 * `Reflect.deleteProperty` means `@sentry/nextjs`'s `ErrorEvent` and
 * `TransactionEvent`, and `@sentry/react-native`'s, all satisfy this
 * structurally — with no cast, no `any`, and no dependency on either SDK.
 */
export interface ScrubbableEvent {
  message?: string;
  logentry?: { message?: string };
  exception?: { values?: ScrubbableException[] };
  breadcrumbs?: { message?: string }[];
  request?: { url?: string };
  spans?: { description?: string }[];
  contexts?: object;
}

/**
 * Everything a request carries that is a body, a credential, or a caller
 * identity. Dropped wholesale rather than per-path.
 *
 * §3.1 only asks for bodies on `/api/tutor/*`, `/api/learner/*`,
 * `/api/capture/*` and `/api/media/*`. Dropping every body is strictly
 * stronger and has no allowlist to forget to update the day a new route starts
 * carrying a child's words — which, in this product, most new routes will.
 */
const REQUEST_FIELDS_DROPPED = ['data', 'cookies', 'headers', 'query_string', 'env'];

/**
 * Top-level bags with no safe subset.
 *
 * `user` is identity by definition and CLAUDE.md puts it out of reach of every
 * log line. `extra` is free-form and typed `unknown` by the SDK, so anything at
 * all can be in it. `server_name` is a hostname that adds nothing a release tag
 * does not.
 */
const EVENT_FIELDS_DROPPED = ['user', 'extra', 'server_name'];

/**
 * The only `contexts` entries that survive.
 *
 * Deleting `contexts` wholesale was the first version and it was wrong:
 * `contexts.trace` is what links an event to its transaction, so dropping it
 * would silently disable every latency and availability rule in slo.md §4.
 * These seven are SDK-populated and describe the MACHINE. Everything else —
 * `response` (which carries headers and cookies) and anything a future
 * `setContext` call adds — is dropped, because an allowlist is the only version
 * of this that stays correct when somebody adds a context next year.
 */
/**
 * Fields INSIDE a kept context that a person can name, and therefore can name
 * after themselves.
 *
 * `contexts.device` is allowlisted because model, OS and memory are how you
 * reproduce a bug. `device.name` is not any of those — iOS defaults it to
 * "<FirstName>'s iPad", so on this product it is very often the CHILD'S OWN
 * NAME, arriving under an innocuous key inside an allowlisted context.
 *
 * That is the failure mode an allowlist has: it is a judgement about keys, and
 * this value is user-supplied under a key that sounds like metadata. Caught by
 * running a realistic event through the scrubber rather than by reading it.
 */
const CONTEXT_FIELDS_DROPPED: Readonly<Record<string, readonly string[]>> = {
  device: ['name'],
  app: ['device_app_hash'],
  culture: ['display_name'],
};

const CONTEXT_KEYS_KEPT: readonly string[] = [
  'trace',
  'runtime',
  'os',
  'device',
  'app',
  'culture',
  'cloud_resource',
];

/**
 * Strips the query string and fragment from a URL.
 *
 * A signed media URL and a `?q=` search both put user-supplied text in the
 * query, and the path alone is what a transaction is grouped by anyway.
 */
export function stripUrlParams(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/**
 * Neutralises an event in place.
 *
 * In place, and returning nothing, so the caller keeps its own SDK-typed value
 * to hand back from `beforeSend` — this package never has to name a Sentry
 * type, and a version bump on either SDK cannot silently change the contract.
 */
export function scrubTelemetryEvent(event: ScrubbableEvent, mask: TextMask = dropText): void {
  if (event.message !== undefined) event.message = mask(event.message);

  if (event.logentry) {
    if (event.logentry.message !== undefined) event.logentry.message = mask(event.logentry.message);
    // Interpolation params are the values that were spliced into the message.
    Reflect.deleteProperty(event.logentry, 'params');
  }

  for (const value of event.exception?.values ?? []) {
    if (value.value !== undefined) value.value = mask(value.value);
    /*
      `vars` is stack-frame locals. Sentry's Node local-variables integration
      fills them with whatever was in scope, which on the coaching path is the
      turn itself.
    */
    for (const frame of value.stacktrace?.frames ?? []) Reflect.deleteProperty(frame, 'vars');
  }

  for (const breadcrumb of event.breadcrumbs ?? []) {
    if (breadcrumb.message !== undefined) breadcrumb.message = mask(breadcrumb.message);
    /*
      Breadcrumb `data` is where the fetch integration files request bodies and
      the console integration files its arguments. There is no shape to walk
      here that is worth the risk of missing one.
    */
    Reflect.deleteProperty(breadcrumb, 'data');
  }

  if (event.request) {
    if (event.request.url !== undefined) event.request.url = stripUrlParams(event.request.url);
    for (const field of REQUEST_FIELDS_DROPPED) Reflect.deleteProperty(event.request, field);
  }

  /*
    Span descriptions get the URL treatment, NOT the mask. They are generated by
    the SDK's own integrations out of operation names and URLs — machine text,
    not a child's — and the query string is the only part of one that can carry
    user data. Masking them instead would erase every span description in a
    client bundle (where the mask is `dropText`) and make traces unreadable for
    no gain in safety.
  */
  for (const span of event.spans ?? []) {
    if (span.description !== undefined) span.description = stripUrlParams(span.description);
  }

  if (event.contexts) {
    const contexts = event.contexts;
    for (const key of Object.keys(contexts)) {
      if (!CONTEXT_KEYS_KEPT.includes(key)) {
        Reflect.deleteProperty(contexts, key);
        continue;
      }

      // Kept, but not wholesale: a person can name a device after themselves.
      const inner = CONTEXT_FIELDS_DROPPED[key];
      if (inner === undefined) continue;
      const context: unknown = Reflect.get(contexts, key);
      if (typeof context === 'object' && context !== null) {
        for (const field of inner) Reflect.deleteProperty(context, field);
      }
    }
  }

  for (const field of EVENT_FIELDS_DROPPED) Reflect.deleteProperty(event, field);
}

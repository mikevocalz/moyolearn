// The storm breaker — doc 35 §4.1's client-side kill for the free-tier fire.
//
// One device in a retry/render loop can emit thousands of identical events and
// end the 5k/month error quota by lunch. Sentry's spike protection and the
// DSN-key rate limit (50 errors/hour, set in the Sentry UI) only smooth a storm
// SERVER-side, after the events crossed the network and some were accepted;
// this breaker refuses them on the device, before any of that: a dropped event
// here costs no network, no quota, nothing.
//
// PURE, DELIBERATELY. No Sentry import — the breadcrumb that records a trip is
// an injected sink, the same inversion `telemetry-scrub.ts` uses for its text
// mask, so this file tests under bare `node --test` and neither SDK's types are
// named. The counters live in the closure `createStormBreaker` returns, not at
// module level, so a test gets a fresh breaker and a process gets exactly one
// "session" (the process/app lifetime — which is what doc 35 §4.1 means by
// session: the caps reset when the app restarts, and a storm that survives a
// restart is a crash loop, which release health reports separately).
//
// The fingerprint is doc 35 §4.1's "type + top frame + message class". The
// message CLASS, not the message: a storm rarely repeats byte-identical text —
// ids, counts and timestamps churn inside it — so digits and long hex runs are
// collapsed before comparing. Two "timeout after 3012ms on job 8f2…" events are
// one storm.
// SOT: docs/pack/35-sentry-free-tier.md §4.1 · docs/design/slo.md §3.1
// SOT-KEYWORDS: storm breaker sentry beforeSend fingerprint cap session quota free tier drop client-side breadcrumb

/** Doc 35 §4.1: the fifth repeat of one fingerprint is the last one sent. */
export const MAX_EVENTS_PER_FINGERPRINT = 5;

/** Doc 35 §4.1: no session sends more than twenty error events, total. */
export const MAX_EVENTS_PER_SESSION = 20;

/**
 * The one stack frame the fingerprint reads. Declared structurally, exactly as
 * `ScrubbableEvent` is: `@sentry/nextjs`'s and `@sentry/react-native`'s
 * `StackFrame` both satisfy this without either SDK being imported.
 */
export interface StormFrame {
  filename?: string;
  function?: string;
  module?: string;
  lineno?: number;
}

/** The subset of a Sentry event the breaker reads. Every field optional, as the SDKs type them. */
export interface StormEvent {
  message?: string;
  exception?: {
    values?: {
      type?: string;
      value?: string;
      stacktrace?: { frames?: StormFrame[] };
    }[];
  };
}

/**
 * Collapses a message to its CLASS: digits, long hex runs and quoted spans —
 * the parts that churn between repeats of the same storm — become `#`, and the
 * rest is capped at 120 chars so a fingerprint is never itself unbounded.
 */
export function messageClassOf(text: string): string {
  return text
    .replace(/[0-9a-f]{8,}/gi, '#')
    .replace(/\d+/g, '#')
    .replace(/(["'`])(?:(?!\1).)*\1/g, '"#"')
    .slice(0, 120);
}

/**
 * Doc 35 §4.1's fingerprint: type + top frame + message class.
 *
 * The top frame is the LAST frame of the first exception value — Sentry orders
 * frames oldest-first, so the crashing frame is at the end. A message-only
 * event (no exception) fingerprints on its message class alone, which is the
 * right grouping for `captureMessage` storms too.
 */
export function fingerprintOf(event: StormEvent): string {
  const first = event.exception?.values?.[0];
  const frames = first?.stacktrace?.frames;
  const top = frames && frames.length > 0 ? frames[frames.length - 1] : undefined;
  const site = top
    ? `${top.module ?? top.filename ?? '?'}:${top.function ?? '?'}:${String(top.lineno ?? '?')}`
    : 'no-frame';
  return `${first?.type ?? 'message'}@${site}#${messageClassOf(first?.value ?? event.message ?? '')}`;
}

export interface StormBreakerOptions {
  readonly maxPerFingerprint?: number;
  readonly maxPerSession?: number;
  /**
   * Where a trip is recorded. Each surface passes its SDK's `addBreadcrumb`,
   * so the note rides the NEXT real event that does get through — a breadcrumb
   * costs no quota, and an operator reading the surviving event learns that
   * siblings were dropped rather than believing the storm was five events deep.
   */
  readonly addBreadcrumb?: (message: string) => void;
}

export interface StormBreaker {
  /**
   * Wraps a `beforeSend`. The wrapped function returns `null` — dropped, never
   * sent — once a fingerprint or the session is over its cap; under the caps it
   * defers to `next` untouched, so the scrubber behind it still runs on every
   * event that will actually leave the device.
   */
  wrap<E extends StormEvent, H, R>(next: (event: E, hint: H) => R): (event: E, hint: H) => R | null;
}

/**
 * One breaker, one session's counters.
 *
 * The counts are of events SEEN, not sent, which is doc 35 §4.1's arithmetic
 * verbatim: an event dropped by the fingerprint cap still advances the session
 * total, because a device producing hundreds of distinct-looking errors is the
 * session-level storm the second cap exists for.
 */
export function createStormBreaker(options: StormBreakerOptions = {}): StormBreaker {
  const maxPerFingerprint = options.maxPerFingerprint ?? MAX_EVENTS_PER_FINGERPRINT;
  const maxPerSession = options.maxPerSession ?? MAX_EVENTS_PER_SESSION;
  const note = options.addBreadcrumb ?? (() => undefined);

  const seen = new Map<string, number>();
  let sessionTotal = 0;

  return {
    wrap(next) {
      return (event, hint) => {
        const fingerprint = fingerprintOf(event);
        const count = (seen.get(fingerprint) ?? 0) + 1;
        seen.set(fingerprint, count);
        sessionTotal += 1;

        if (count > maxPerFingerprint || sessionTotal > maxPerSession) {
          // Once per cap, on the first drop only — a breadcrumb per dropped
          // event would itself be the storm, relocated into breadcrumbs.
          if (count === maxPerFingerprint + 1) {
            note(`storm-breaker tripped: ${fingerprint}`);
          }
          if (sessionTotal === maxPerSession + 1) {
            note('storm-breaker tripped: session cap');
          }
          return null;
        }

        return next(event, hint);
      };
    },
  };
}

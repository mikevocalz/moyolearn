// Sentry for the browser bundle — slo.md §7 W-2's client half, on doc 35 §4's
// shared base with §7 W-7's scrubber in its strictest form.
//
// THE MASK HERE IS `dropText`, NOT `scrubText`. The reviewed rule set lives in
// `packages/inference/src/pseudonymize.ts`, which opens with
// `import 'server-only'`; in a browser bundle that module resolves to the
// throwing shim, so it cannot be imported here at any price. The alternatives
// were a second, unreviewed copy of the redaction patterns in the client
// bundle, or refusing to send free text at all. This refuses: exception TYPE,
// stack frames and the route survive; every message string becomes
// `[redacted]`. Triage detail is the price and a child's words are what it buys.
//
// SESSION REPLAY IS NOT ENABLED AND MUST NOT BE — doc 35 §7.4 makes it law,
// not budget: a replay of a tutoring session is a recording of a child's own
// work. No replay integration is imported on ANY surface a child can reach,
// and `tooling/check-sentry-invariants.mjs` fails the build if one appears.
//
// The storm breaker (doc 35 §4.1) sits in front of the scrubber: one tab in a
// render/retry loop is capped at 5 events per fingerprint and 20 per page
// lifetime before anything crosses the network.
// SOT: docs/pack/35-sentry-free-tier.md §4 §4.1 §4.3 §7 · docs/design/slo.md §3.1 §7 W-2 W-7
// SOT-KEYWORDS: sentry client browser instrumentation dsn factory storm breaker beforeSend dropText scrubber no replay router transition
import * as Sentry from '@sentry/nextjs';
import { createStormBreaker, scrubTelemetryEvent, telemetryInitOptions } from '@acme/app/telemetry';

// Per-surface first, shared fallback — the doc 35 §3 project split is deferred
// on the free tier; the `surface` tag stands in. Literal reads, because a
// client bundle only inlines `process.env.<NAME>` spelled out.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  const breaker = createStormBreaker({
    addBreadcrumb: (message) => Sentry.addBreadcrumb({ category: 'storm-breaker', message }),
  });

  Sentry.init({
    ...telemetryInitOptions({
      dsn,
      surface: 'web',
      environment:
        process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NEXT_PUBLIC_VERCEL_ENV,
      isProduction: process.env.NODE_ENV === 'production',
      ...(process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA === undefined
        ? {}
        : { release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA }),
    }),
    beforeSend: breaker.wrap((event) => {
      scrubTelemetryEvent(event);
      return event;
    }),
    // No transactions leave (tracesSampleRate 0); the belt stays for the day an
    // exception is temporarily sanctioned, same as the server config.
    beforeSendTransaction(event) {
      scrubTelemetryEvent(event);
      return event;
    },
  });
}

/** App Router navigation spans. A no-op while `tracesSampleRate` is 0. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

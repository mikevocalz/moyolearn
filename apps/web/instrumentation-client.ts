// Sentry for the browser bundle — slo.md §7 W-2's client half, with §7 W-7's
// scrubber in its strictest form.
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
// SESSION REPLAY IS NOT ENABLED AND MUST NOT BE. Replay records the DOM of a
// screen that shows a child's own work and a tutor's reply to it — doc 07 §4's
// wall with a camera pointed over it.
// SOT: docs/design/slo.md §3.1 · §7 W-2 · §7 W-7 · docs/pack/07-security-child-ai-safety-spec.md §4
// SOT-KEYWORDS: sentry client browser instrumentation dsn beforeSend dropText scrubber no replay router transition
import * as Sentry from '@sentry/nextjs';
import { scrubTelemetryEvent } from '@acme/app/telemetry';

/*
  Off by default. Browser transactions answer none of slo.md §4's rules — those
  are all server-side — so the client SDK is here for crash reporting, and
  paying to sample navigations by default would buy nothing the server p95 does
  not already say.
*/
const sampleRate = Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE);

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    tracesSampleRate: Number.isFinite(sampleRate) ? sampleRate : 0,
    sendDefaultPii: false,
    beforeSend(event) {
      scrubTelemetryEvent(event);
      return event;
    },
    beforeSendTransaction(event) {
      scrubTelemetryEvent(event);
      return event;
    },
  });
}

/** App Router navigation spans. A no-op while `tracesSampleRate` is 0. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

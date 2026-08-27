// Sentry for the Expo app — slo.md §7 W-2's mobile half, with §7 W-7's
// scrubber. Imported for its side effect from `app/_layout.tsx`, which is the
// earliest module the router evaluates.
//
// @sentry/react-native 8.24.0 builds and tests against react-native 0.86.2,
// which is the version this workspace pins, so SDK support was never the
// question here. What IS constrained is the scrubber: this is a client bundle,
// so `@acme/inference`'s `scrubText` (behind `import 'server-only'`) cannot be
// reached and the mask is `dropText` — every message string becomes
// `[redacted]` and the exception type, stack and route survive. Same trade, and
// same reasoning, as `apps/web/instrumentation-client.ts`.
//
// TWO THINGS DELIBERATELY NOT ENABLED:
//
// `Sentry.wrap()` — its `TouchEventBoundary` files a breadcrumb naming the
// element a user touched, which on a learner surface means the label of a
// child's own answer. The scrubber would blank it, so the wrapper would cost a
// re-render boundary to produce redactions.
//
// The `@sentry/react-native/expo` config plugin — it exists to upload source
// maps at build time and needs `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`
// against a Sentry project that does not exist yet (slo.md §2). Crash reporting
// and release health do not depend on it; stack frames read as bundled output
// until it lands. `withSentryConfig` is deferred on the web app for the same
// reason, so the two apps are in the same state rather than one silently ahead.
// SOT: docs/design/slo.md §3.1 · §4.4 AVL-6 · §7 W-2 · §7 W-7
// SOT-KEYWORDS: sentry mobile expo react-native init dsn scrubber dropText release health crash free sessions
import * as Sentry from '@sentry/react-native';
import { scrubTelemetryEvent } from '@acme/app/telemetry';

const sampleRate = Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE);

/*
  No DSN means the reporter is OFF. Every checkout is in that state today — see
  slo.md §2 — and a reporter that half-initialises is worse than one that does
  not, because the dashboard cannot tell the difference.
*/
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
    /*
      Off by default. AVL-6 is a release-health rule (crash-free sessions), not
      a tracing one, and sessions are reported independently of this rate.
    */
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

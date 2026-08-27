// Sentry for the Expo app — slo.md §7 W-2's mobile half on doc 35 §4's shared
// base, §4.2's mobile additions, and §7 W-7's scrubber. Imported for its side
// effect from `app/_layout.tsx`, which is the earliest module the router
// evaluates.
//
// @sentry/react-native 8.24.0 builds and tests against react-native 0.86.2,
// which is the version this workspace pins. The mask is `dropText` — this is a
// client bundle, so `@acme/inference`'s `scrubText` (behind `import
// 'server-only'`) cannot be reached; every message string becomes `[redacted]`
// and the exception type, stack and route survive. Same trade, same reasoning,
// as `apps/web/instrumentation-client.ts`.
//
// DOC 35 §4.2, APPLIED:
//   `enableAutoSessionTracking: true` — release-health sessions power the
//     crash-free rate, the one mobile health number that matters; sessions are
//     a separate accounting category from the 5k/month error quota.
//   `attachScreenshot: false` — §7.5: a screenshot of a tutoring screen is a
//     child's work, same reasoning as replay.
//   NO REPLAY, NO EXCEPTION — §7.4 is law, not a sampling decision. No replay
//     integration is imported anywhere the mobile bundle can reach, and
//     `tooling/check-sentry-invariants.mjs` fails the build if one appears.
//   The storm breaker (§4.1) caps a device in a retry loop at 5 events per
//     fingerprint and 20 per app session, client-side, before any network.
//
// STILL DELIBERATELY NOT ENABLED:
//
// `Sentry.wrap()` — its `TouchEventBoundary` files a breadcrumb naming the
// element a child touched, which on a learner surface is the label of the
// child's own answer. The scrubber would blank it, so the wrapper would cost a
// re-render boundary to produce redactions.
//
// The `@sentry/react-native/expo` config plugin — source-map upload needs
// `SENTRY_AUTH_TOKEN` in EAS, which is not provisioned yet; crash reporting and
// release health do not depend on it. Stack frames read as bundled output until
// it lands, and `withSentryConfig` on the web app is gated the same way so the
// two surfaces stay in the same state.
// SOT: docs/pack/35-sentry-free-tier.md §4 §4.1 §4.2 §7 · docs/design/slo.md §3.1 §4.4 AVL-6 §7 W-2 W-7
// SOT-KEYWORDS: sentry mobile expo react-native init factory storm breaker dsn scrubber dropText release health crash free sessions no replay no screenshot
import * as Sentry from '@sentry/react-native';
import { createStormBreaker, scrubTelemetryEvent, telemetryInitOptions } from '@acme/app/telemetry';

// Per-surface first, shared fallback — the doc 35 §3 project split is deferred
// on the free tier; the `surface` tag stands in. Literal reads: Expo inlines
// only `process.env.EXPO_PUBLIC_<NAME>` spelled out.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN_MOBILE ?? process.env.EXPO_PUBLIC_SENTRY_DSN;

/*
  No DSN means the reporter is OFF, and the factory's `enabled` keeps every dev
  bundle silent even with one — doc 35 §2: local dev sends nothing, ever. A
  reporter that half-initialises is worse than one that does not, because the
  dashboard cannot tell the difference.
*/
if (dsn) {
  const breaker = createStormBreaker({
    addBreadcrumb: (message) => Sentry.addBreadcrumb({ category: 'storm-breaker', message }),
  });

  Sentry.init({
    ...telemetryInitOptions({
      dsn,
      surface: 'mobile',
      environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT,
      // __DEV__ is the mobile bundle's production truth, not NODE_ENV — Metro
      // defines it per build type, which is exactly doc 35 §2's `!__DEV__`.
      isProduction: !__DEV__,
    }),
    enableAutoSessionTracking: true,
    attachScreenshot: false,
    beforeSend: breaker.wrap((event) => {
      scrubTelemetryEvent(event);
      return event;
    }),
    beforeSendTransaction(event) {
      scrubTelemetryEvent(event);
      return event;
    },
  });
}

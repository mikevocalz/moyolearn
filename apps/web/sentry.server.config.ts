// Sentry for the Next.js Node runtime — slo.md §7 W-2/W-7, refined to doc 35's
// free-tier posture: errors and crash health, nothing else.
//
// The base options come from `telemetryInitOptions` in `@acme/app/telemetry` —
// one factory, four surfaces — so `sendDefaultPii: false`, `enabled` only in
// production, and `tracesSampleRate: 0` are facts about a function rather than
// about four files agreeing. Doc 35 §2 retired this file's old 10% trace
// sample: the ≤2s SLO is measured by our own timing rows in Postgres, and a
// 1–2% vendor trace answers no rule in slo.md §4 that those rows don't. If
// Phase-1 tuning ever wants the capture→first-token waterfall, the sanctioned
// exception is a `tracesSampler` returning ~0.02 for that one transaction,
// added HERE, temporarily — never a default in the factory.
//
// `beforeSend` is storm breaker THEN scrubber (doc 35 §4.1 + §7): the breaker
// drops a repeat before any work is spent on it, and everything that will
// actually leave carries the server mask (`scrubText`, the reviewed rule set).
//
// The DSN read is per-surface with the shared fallback — the doc 35 §3
// three-project split is deferred (free tier), so `SENTRY_DSN_SERVER` is empty
// today and the `surface`/`runtime` tags stand in for the split.
// SOT: docs/pack/35-sentry-free-tier.md §2 §4 §4.4 · docs/design/slo.md §3 §3.1 §7 W-2 W-7
// SOT-KEYWORDS: sentry server config init dsn factory storm breaker scrubber sendDefaultPii traces zero operation sink breadcrumb
import * as Sentry from '@sentry/nextjs';
import {
  createStormBreaker,
  setOperationSink,
  scrubTelemetryEvent,
  telemetryInitOptions,
  type OperationOutcome,
} from '@acme/app/telemetry';
import { maskTelemetryText } from '@acme/app/telemetry/mask';

/**
 * The record's severity, so `ok` traffic does not colour a breadcrumb trail red
 * and a refusal does not read as a crash.
 */
const levelFor = (outcome: OperationOutcome): 'info' | 'warning' | 'error' =>
  outcome === 'ok' ? 'info' : outcome === 'error' ? 'error' : 'warning';

const dsn = process.env.SENTRY_DSN_SERVER ?? process.env.SENTRY_DSN;

/*
  No DSN means the reporter is OFF, not half on — a checkout without one must
  behave exactly like one that never had the SDK. The factory's `enabled` flag
  additionally keeps dev and preview silent even WITH a DSN (doc 35 §2: dev
  noise is the #1 silent quota leak).
*/
if (dsn) {
  const breaker = createStormBreaker({
    addBreadcrumb: (message) => Sentry.addBreadcrumb({ category: 'storm-breaker', message }),
  });

  Sentry.init({
    ...telemetryInitOptions({
      dsn,
      surface: 'server',
      environment:
        process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      isProduction: process.env.NODE_ENV === 'production',
      ...(process.env.VERCEL_GIT_COMMIT_SHA === undefined
        ? {}
        : { release: process.env.VERCEL_GIT_COMMIT_SHA }),
    }),
    beforeSend: breaker.wrap((event) => {
      scrubTelemetryEvent(event, maskTelemetryText);
      return event;
    }),
    // Belt for the day a tracesSampler exception is temporarily added above:
    // whatever transaction leaves, it leaves scrubbed.
    beforeSendTransaction(event) {
      scrubTelemetryEvent(event, maskTelemetryText);
      return event;
    },
  });

  /*
    The Block's record rides along with whatever error is reported, so an issue
    arrives already carrying the operation, its latency and its outcome —
    without the record ever becoming a second copy of the log line. It stays on
    stdout too: breadcrumbs only survive if something is captured, and SLO-1 is
    measured from every operation, not the ones that failed.
  */
  setOperationSink((record) => {
    console.info(JSON.stringify(record));
    Sentry.addBreadcrumb({ category: 'op', level: levelFor(record.outcome), data: record });
  });
}

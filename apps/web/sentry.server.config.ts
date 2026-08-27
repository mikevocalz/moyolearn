// Sentry for the Next.js Node runtime — slo.md §7 W-2 and W-7, which that
// document says must land together and do.
//
// This is the surface every rule in slo.md §4 actually queries: LAT-*, AVL-*
// and the SAFE-* transaction rules are all server transactions. It is loaded
// from `instrumentation.ts`'s `register()` rather than imported at module
// scope, so the edge runtime never pulls the inference package (and its vendor
// SDK) into a middleware bundle.
//
// NOT WIRED HERE, deliberately: `withSentryConfig`. Source-map upload and
// release health need `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` and a
// Sentry project that does not exist yet (slo.md §2 — the connected org has one
// project, belonging to another product). Errors and traces do not depend on
// it; stack frames will read as bundled output until it lands.
// SOT: docs/design/slo.md §3 · §3.1 · §7 W-2 · §7 W-7 · docs/pack/12-systems-design-prompt.md §7
// SOT-KEYWORDS: sentry server config init dsn traces beforeSend scrubber sendDefaultPii operation sink breadcrumb
import * as Sentry from '@sentry/nextjs';
import {
  setOperationSink,
  scrubTelemetryEvent,
  type OperationOutcome,
} from '@acme/app/telemetry';
import { maskTelemetryText } from '@acme/app/telemetry/mask';

/**
 * 10 % by default.
 *
 * A p95 latency SLO (slo.md §4.3) and a `failure_rate()` burn rate (§4.4) are
 * both distribution questions, and 10 % of this app's traffic answers them
 * without paying to store nine tenths of a duplicate. Override per environment;
 * set it to 1 while calibrating the SLO-2 budget in §1.1.
 */
const DEFAULT_TRACES_SAMPLE_RATE = 0.1;

const sampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE);

/**
 * The record's severity, so `ok` traffic does not colour a breadcrumb trail red
 * and a refusal does not read as a crash.
 */
const levelFor = (outcome: OperationOutcome): 'info' | 'warning' | 'error' =>
  outcome === 'ok' ? 'info' : outcome === 'error' ? 'error' : 'warning';

/*
  No DSN means the reporter is OFF, not half on. A checkout with no Sentry
  project — which is every checkout today, slo.md §2 — must behave exactly like
  one that never had the SDK, so nothing downstream can start depending on a
  reporter that is not there.
*/
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: Number.isFinite(sampleRate) ? sampleRate : DEFAULT_TRACES_SAMPLE_RATE,

    /*
      §3.1, first line. With this false the SDK does not attach IP addresses,
      cookies, headers or user identity of its own accord. `beforeSend` below is
      the second wall, for everything an integration or a future `setContext`
      call adds after this option was decided.
    */
    sendDefaultPii: false,

    beforeSend(event) {
      scrubTelemetryEvent(event, maskTelemetryText);
      return event;
    },
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

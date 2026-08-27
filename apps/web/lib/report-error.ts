// slo.md §7 W-3: the six-plus API route `catch` blocks that map an error to a
// status code and then discard it. The status code is the client's answer; this
// is the operator's.
//
// WHAT IT REFUSES TO REPORT is the point. `CapabilityDenied` and
// `Unauthenticated` are the Block working — a lapsed card correctly turned away,
// a signed-out caller correctly refused — and filing them as issues would bury
// the real failures under the product's own access control and burn SLO-3's
// error budget on correct behaviour (slo.md §4.4). Everything else is a bug or
// an outage and belongs in front of a human.
//
// The error object itself still reaches Sentry, so `beforeSend` in
// `sentry.server.config.ts` is what stands between a message string and the
// vendor — see there and in `@acme/app/telemetry`.
// SOT: docs/design/slo.md §3 · §7 W-3 · §7 W-7
// SOT-KEYWORDS: route error report sentry captureException catch swallow capability denied unauthenticated api
import 'server-only';
import * as Sentry from '@sentry/nextjs';
import { CapabilityDenied } from '@acme/app/server';

/**
 * Files an unexpected route failure.
 *
 * Takes `Error` rather than the `unknown` a `catch` binds, so the call site's
 * existing `instanceof Error` narrowing does the work and nothing untyped
 * crosses into this module. A no-op when Sentry has no DSN.
 */
export function reportRouteError(error: Error): void {
  if (error instanceof CapabilityDenied) return;
  if (error.message === 'Unauthenticated') return;
  Sentry.captureException(error);
}

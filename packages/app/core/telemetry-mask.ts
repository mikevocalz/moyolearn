// The server binding of the telemetry scrubber's text mask, and the whole
// reason `telemetry-scrub.ts` takes the mask as an argument.
//
// It is one line because it must be: the rules belong to
// `packages/inference/src/pseudonymize.ts`, which is the reviewed,
// red-teamed set already guarding the model-egress boundary, and a telemetry
// path that maintained its own copy would drift from it silently. slo.md §3.1
// calls an unscrubbed prompt reaching Sentry "a Safety-Plane skip path by
// another name" — two rule sets is the same failure with an extra step.
//
// Server-only, because `scrubText` is. Client bundles (the browser reporter and
// the RN JS bundle) cannot reach this file and use `dropText` instead, which
// refuses free text outright rather than masking it — see `telemetry-scrub.ts`.
// SOT: docs/design/slo.md §3.1 · §7 W-7 · docs/design/inference-gateway.md §4.3
// SOT-KEYWORDS: telemetry mask server scrubText pseudonymize reuse sentry beforeSend redaction
import 'server-only';
import { scrubText } from '@acme/inference';
import type { TextMask } from './telemetry-scrub.ts';

/** `scrubText`, named for the boundary that uses it. Never a reimplementation. */
export const maskTelemetryText: TextMask = scrubText;

// The proof that the server scrubber is the inference gateway's scrubber, and
// that a real Sentry-shaped event carrying a child's worksheet comes out the
// far side with nothing usable in it.
//
// `.server-test.ts`, because `scrubText` lives behind `import 'server-only'`
// and needs node's `react-server` condition to resolve.
// SOT: docs/design/slo.md §3.1 · §7 W-7
// SOT-KEYWORDS: telemetry mask server test scrubText pseudonymize sentry beforeSend pii worksheet email phone reuse
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { REDACTED, scrubText } from '@acme/inference';
import { maskTelemetryText } from './telemetry-mask.ts';
import { scrubTelemetryEvent } from './telemetry-scrub.ts';

describe('server telemetry mask', () => {
  it('IS the gateway scrubber, not a second copy of its rules', () => {
    assert.equal(
      maskTelemetryText,
      scrubText,
      'the telemetry mask must be the same function the model-egress boundary uses',
    );
  });

  it('masks a worksheet header, an email and a phone number out of an exception', () => {
    // Unannotated on purpose — see `telemetry.test.ts`; `ScrubbableEvent`
    // declares only what the scrubber reads.
    const event = {
      message: 'evaluate failed',
      exception: {
        values: [
          {
            type: 'ProviderUnavailable',
            value:
              'payload rejected: "Name: Ada Lovelace\nemail ada.guardian@example.com\ncall 07700 900123"',
          },
        ],
      },
    };

    scrubTelemetryEvent(event, maskTelemetryText);

    const value = event.exception?.values?.[0]?.value ?? '';
    assert.ok(!value.includes('Ada Lovelace'), value);
    assert.ok(!value.includes('ada.guardian@example.com'), value);
    assert.ok(!value.includes('07700 900123'), value);
    assert.ok(value.includes(REDACTED), 'the mask must leave its marker so a reader knows why');
    // The error class survives — it is authored here and is what SAFE-2 queries.
    assert.equal(event.exception?.values?.[0]?.type, 'ProviderUnavailable');
  });

  it('still drops the fields that have no safe subset, mask or no mask', () => {
    const event = {
      request: {
        url: 'https://moyo.app/api/tutor/coach?problem=7x8',
        data: { message: 'my mum says I am bad at maths' },
        cookies: { session: 'ba_sess_abc123' },
      },
      user: { id: 'usr_9f3c1a7e' },
      extra: { transcript: 'my mum says I am bad at maths' },
    };

    scrubTelemetryEvent(event, maskTelemetryText);

    const serialised = JSON.stringify(event);
    for (const secret of ['usr_9f3c1a7e', 'ba_sess_abc123', 'my mum says I am bad at maths', 'problem=7x8']) {
      assert.ok(!serialised.includes(secret), `leaked ${secret}: ${serialised}`);
    }
  });

  it('is idempotent, so scrubbing twice cannot nest redactions', () => {
    const once = { message: 'contact ada.guardian@example.com' };
    scrubTelemetryEvent(once, maskTelemetryText);
    const after = once.message;
    scrubTelemetryEvent(once, maskTelemetryText);
    assert.equal(once.message, after);
  });
});

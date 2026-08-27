// The Block record, tested at the point it is built, and the scrubber tested
// with the client-side default mask.
//
// The load-bearing assertion is `carries no identity`: it walks the whole
// serialised record for every value the block holds and every shape a leak
// would take, rather than checking a field list. A field list only catches the
// leak somebody remembered to test for.
//
// The server binding — that the mask is `@acme/inference`'s reviewed
// `scrubText` and not a second rule set — needs node's `react-server`
// condition to resolve `server-only`, so it lives in
// `telemetry-mask.server-test.ts`.
// SOT-KEYWORDS: telemetry test block record identity leak scrub beforeSend sentry pii sink attributed
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ctxKindOf,
  dropText,
  operationRecord,
  recordOperation,
  scrubTelemetryEvent,
  setOperationSink,
  stripUrlParams,
  REDACTED_TELEMETRY,
  UNATTRIBUTED,
  type OperationRecord,
  type OperationRecordInput,
} from './telemetry.ts';

/** Every string a leak could be spelled with, drawn from the real ctx shapes. */
const LEARNER_ID = 'usr_9f3c1a7e';
const ORG_ID = 'riverside-unified';
const LEARNER_NAME = 'Ada Lovelace';
const GUARDIAN_EMAIL = 'ada.guardian@example.com';
const TRANSCRIPT = 'I keep getting 7 x 8 wrong and my mum says I am bad at maths';

const input = (over: Partial<OperationRecordInput> = {}): OperationRecordInput => ({
  capability: 'practise',
  ctxKind: 'learner',
  outcome: 'ok',
  latencyMs: 12.4,
  authMode: 'session',
  ...over,
});

describe('block telemetry record', () => {
  it('carries no identity, in any field, for any outcome', () => {
    const forbidden = [LEARNER_ID, ORG_ID, LEARNER_NAME, GUARDIAN_EMAIL, TRANSCRIPT];
    const outcomes = ['ok', 'denied', 'unauthenticated', 'error'] as const;

    for (const outcome of outcomes) {
      for (const ctxKind of ['learner', 'guardian', 'org', 'anonymous'] as const) {
        const record = operationRecord(
          input({
            outcome,
            ctxKind,
            descriptor: { op: 'tutor.session.open', resource: 'tutorSessions', action: 'write' },
          }),
        );
        const serialised = JSON.stringify(record);
        for (const secret of forbidden) {
          assert.ok(
            !serialised.includes(secret),
            `${outcome}/${ctxKind} record leaked ${secret}: ${serialised}`,
          );
        }
      }
    }
  });

  it('has no input channel identity could arrive through', () => {
    /*
      The type forbids it; this proves the runtime does too, because a caller
      reaching this function from untyped JS is exactly how a field like
      `learnerId` would get spread in.
    */
    const smuggled = { ...input(), learnerId: LEARNER_ID, orgId: ORG_ID };
    const record = operationRecord(smuggled);
    assert.ok(!JSON.stringify(record).includes(LEARNER_ID));
    assert.ok(!JSON.stringify(record).includes(ORG_ID));
  });

  it('records an unnamed operation as unattributed rather than guessing', () => {
    const record = operationRecord(input());
    assert.equal(record.op, UNATTRIBUTED);
    assert.equal(record.resource, UNATTRIBUTED);
    assert.equal(record.action, 'unspecified');
    assert.equal(record.attributed, false);
  });

  it('marks a named operation attributed and keeps the three fields together', () => {
    const record = operationRecord(
      input({ descriptor: { op: 'ops.leads.list', resource: 'leads', action: 'read' } }),
    );
    assert.deepEqual(
      { op: record.op, resource: record.resource, action: record.action, attributed: record.attributed },
      { op: 'ops.leads.list', resource: 'leads', action: 'read', attributed: true },
    );
  });

  it('rounds latency and carries the auth mode so mock samples are excludable', () => {
    assert.equal(operationRecord(input({ latencyMs: 12.4 })).latencyMs, 12);
    assert.equal(operationRecord(input({ authMode: 'mock' })).authMode, 'mock');
    assert.equal(operationRecord(input()).authMode, 'session');
  });

  it('derives ctx kind without ever reading an id', () => {
    assert.equal(ctxKindOf(null), 'anonymous');
    assert.equal(ctxKindOf({ isLearner: true }), 'learner');
    // A child inside a school org is still a learner — see ctxKindOf's comment.
    assert.equal(ctxKindOf({ isLearner: true, orgId: ORG_ID }), 'learner');
    assert.equal(ctxKindOf({ isLearner: false, orgId: ORG_ID }), 'org');
    assert.equal(ctxKindOf({ isLearner: false }), 'guardian');
  });
});

describe('operation sink', () => {
  it('routes records to the installed sink and back to the default', () => {
    const seen: OperationRecord[] = [];
    setOperationSink((record) => seen.push(record));
    recordOperation(operationRecord(input()));
    assert.equal(seen.length, 1);
    setOperationSink(null);
    recordOperation(operationRecord(input()));
    assert.equal(seen.length, 1, 'null must restore the default sink');
  });

  it('never lets a failing sink break the operation it is observing', () => {
    setOperationSink(() => {
      throw new Error('transport down');
    });
    assert.doesNotThrow(() => recordOperation(operationRecord(input())));
    setOperationSink(null);
  });
});

describe('telemetry scrubber, client default', () => {
  /*
    Deliberately UNANNOTATED. `ScrubbableEvent` declares only the fields the
    scrubber reads, so annotating this fixture would trip excess-property
    checking on exactly the fields under test — the ones that must be deleted.
  */
  const event = () => ({
    message: `tutor turn failed for ${LEARNER_NAME}`,
    logentry: { message: TRANSCRIPT, params: { name: LEARNER_NAME } },
    exception: {
      values: [
        {
          type: 'SafetyLayerUnavailable',
          value: `screen() rejected: ${TRANSCRIPT}`,
          stacktrace: { frames: [{ vars: { message: TRANSCRIPT, learnerId: LEARNER_ID } }] },
        },
      ],
    },
    breadcrumbs: [{ message: TRANSCRIPT, data: { body: TRANSCRIPT } }],
    request: {
      url: `https://moyo.app/api/tutor/coach?q=${encodeURIComponent(TRANSCRIPT)}`,
      data: { problem: TRANSCRIPT, learnerId: LEARNER_ID },
      cookies: { session: 'ba_sess_abc123' },
      headers: { authorization: 'Bearer abc123', cookie: 'ba_sess_abc123' },
      query_string: `q=${TRANSCRIPT}`,
    },
    spans: [{ description: `POST https://moyo.app/api/tutor/coach?problem=${TRANSCRIPT}` }],
    user: { id: LEARNER_ID, email: GUARDIAN_EMAIL, username: LEARNER_NAME },
    extra: { transcript: TRANSCRIPT },
    contexts: {
      trace: { trace_id: 'abc', span_id: 'def' },
      response: { headers: { cookie: 'ba_sess_abc123' } },
      learner: { id: LEARNER_ID },
    },
    server_name: 'iad1-runtime-7',
  });

  it('lets nothing recognisable out, anywhere in the event', () => {
    const scrubbed = event();
    scrubTelemetryEvent(scrubbed, dropText);
    const serialised = JSON.stringify(scrubbed);
    for (const secret of [LEARNER_ID, LEARNER_NAME, GUARDIAN_EMAIL, TRANSCRIPT, 'ba_sess_abc123', 'Bearer abc123']) {
      assert.ok(!serialised.includes(secret), `event leaked ${secret}: ${serialised}`);
    }
  });

  it('keeps what triage needs — the exception type and the route', () => {
    const scrubbed = event();
    scrubTelemetryEvent(scrubbed, dropText);
    assert.equal(scrubbed.exception?.values?.[0]?.type, 'SafetyLayerUnavailable');
    assert.equal(scrubbed.request?.url, 'https://moyo.app/api/tutor/coach');
    assert.equal(scrubbed.message, REDACTED_TELEMETRY);
    assert.equal(scrubbed.spans?.[0]?.description, 'POST https://moyo.app/api/tutor/coach');
  });

  it('keeps the trace context, because every latency rule hangs off it', () => {
    /*
      Deleting `contexts` wholesale would disarm §4.3 and §4.4 without failing
      anything — the events would still arrive, unlinked to a transaction.
    */
    const scrubbed = event();
    scrubTelemetryEvent(scrubbed, dropText);
    assert.deepEqual(scrubbed.contexts?.trace, { trace_id: 'abc', span_id: 'def' });
    assert.equal(scrubbed.contexts?.response, undefined, 'response carries headers and cookies');
    assert.equal(scrubbed.contexts?.learner, undefined, 'an unknown context is not allowlisted');
  });

  it('drops the fields that have no safe subset', () => {
    const scrubbed = event();
    scrubTelemetryEvent(scrubbed, dropText);
    assert.equal(scrubbed.user, undefined);
    assert.equal(scrubbed.extra, undefined);
    assert.equal(scrubbed.server_name, undefined);
    assert.equal(scrubbed.request?.data, undefined);
    assert.equal(scrubbed.request?.cookies, undefined);
    assert.equal(scrubbed.request?.headers, undefined);
    assert.equal(scrubbed.request?.query_string, undefined);
    assert.equal(scrubbed.breadcrumbs?.[0]?.data, undefined);
    assert.equal(scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars, undefined);
    assert.equal(scrubbed.logentry?.params, undefined);
  });

  it('is safe on an empty event', () => {
    const empty = {};
    assert.doesNotThrow(() => scrubTelemetryEvent(empty, dropText));
    assert.deepEqual(empty, {});
  });

  it('strips query and fragment but leaves a bare path alone', () => {
    assert.equal(stripUrlParams('https://moyo.app/api/tutor/coach'), 'https://moyo.app/api/tutor/coach');
    assert.equal(stripUrlParams('https://moyo.app/p?name=Ada#frag'), 'https://moyo.app/p');
    assert.equal(stripUrlParams('https://moyo.app/p#name=Ada'), 'https://moyo.app/p');
  });
});

/*
  A device name is not device metadata.

  `contexts.device` is allowlisted because model, OS and memory are how you
  reproduce a bug. `device.name` is none of those: iOS defaults it to
  "<FirstName>'s iPad", so on a product used by children it is very often the
  child's own name — arriving under an innocuous key, inside a context the
  allowlist deliberately keeps.

  This is the failure mode an allowlist has. It is a judgement about KEYS, and
  this value is user-supplied under a key that sounds like metadata. It survived
  the first version of the scrubber and was found by running a realistic event
  through it rather than by reading the list again.
*/
describe('an allowlisted context is not a safe context', () => {
  it('does not let a device named after the child reach the wire', () => {
    const event = {
      contexts: {
        trace: { trace_id: 'abc', span_id: 'def' },
        device: { name: "Aisha's iPad", model: 'iPhone14,3', memory_size: 4096 },
        os: { name: 'iOS', version: '18.2' },
      },
    };

    scrubTelemetryEvent(event);
    const wire = JSON.stringify(event);

    assert.ok(!wire.includes('Aisha'), 'the device name carried the child to Sentry');
    // Still debuggable: the fields that are actually metadata survive.
    assert.ok(wire.includes('iPhone14,3'));
    assert.ok(wire.includes('18.2'));
    assert.ok(wire.includes('trace_id'), 'trace must survive or the event cannot be grouped');
  });
});

// Storm-breaker proof — doc 35 §7's verification checklist row 4: "beforeSend
// chain includes per-fingerprint/session caps; tests cover the trip".
// SOT: docs/pack/35-sentry-free-tier.md §4.1 · §7 checklist row 4
// SOT-KEYWORDS: storm breaker test fingerprint session cap trip breadcrumb
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createStormBreaker,
  fingerprintOf,
  messageClassOf,
  MAX_EVENTS_PER_FINGERPRINT,
  MAX_EVENTS_PER_SESSION,
  type StormEvent,
} from './telemetry-storm.ts';

/** An exception event whose identity the tests control precisely. */
function errorEvent(type: string, value: string, fn = 'coach'): StormEvent {
  return {
    exception: {
      values: [
        {
          type,
          value,
          stacktrace: {
            frames: [
              { module: 'app/root', function: 'render', lineno: 1 },
              { module: 'features/tutor', function: fn, lineno: 42 },
            ],
          },
        },
      ],
    },
  };
}

test('under the caps, every event reaches the wrapped beforeSend untouched', () => {
  const breaker = createStormBreaker();
  let calls = 0;
  const send = breaker.wrap((event: StormEvent) => {
    calls += 1;
    return event;
  });

  for (let i = 0; i < MAX_EVENTS_PER_FINGERPRINT; i += 1) {
    const event = errorEvent('TypeError', 'boom', `site${String(i)}`);
    assert.equal(send(event, {}), event);
  }
  assert.equal(calls, MAX_EVENTS_PER_FINGERPRINT);
});

test('the cap-plus-first repeat of one fingerprint is dropped, with one breadcrumb', () => {
  const crumbs: string[] = [];
  const breaker = createStormBreaker({ addBreadcrumb: (m) => crumbs.push(m) });
  const send = breaker.wrap((event: StormEvent) => event);

  for (let i = 0; i < MAX_EVENTS_PER_FINGERPRINT; i += 1) {
    assert.notEqual(send(errorEvent('TypeError', 'boom'), {}), null);
  }
  // Sixth, seventh, eighth: all dropped, but the trip is noted exactly once.
  assert.equal(send(errorEvent('TypeError', 'boom'), {}), null);
  assert.equal(send(errorEvent('TypeError', 'boom'), {}), null);
  assert.equal(send(errorEvent('TypeError', 'boom'), {}), null);

  const trips = crumbs.filter((c) => c.startsWith('storm-breaker tripped:'));
  assert.equal(trips.length, 1);
  assert.match(trips[0] ?? '', /TypeError/);
});

test('distinct fingerprints are counted separately', () => {
  const breaker = createStormBreaker();
  const send = breaker.wrap((event: StormEvent) => event);

  for (let i = 0; i < MAX_EVENTS_PER_FINGERPRINT; i += 1) {
    send(errorEvent('TypeError', 'boom'), {});
  }
  assert.equal(send(errorEvent('TypeError', 'boom'), {}), null, 'first storm is capped');
  assert.notEqual(send(errorEvent('RangeError', 'other'), {}), null, 'a new storm still sends');
});

test('the session cap drops everything past twenty, whatever the fingerprint', () => {
  const crumbs: string[] = [];
  const breaker = createStormBreaker({ addBreadcrumb: (m) => crumbs.push(m) });
  const send = breaker.wrap((event: StormEvent) => event);

  let sent = 0;
  for (let i = 0; i < MAX_EVENTS_PER_SESSION + 5; i += 1) {
    // A fresh fingerprint every time, so only the session cap can trip.
    if (send(errorEvent('TypeError', 'boom', `site${String(i)}`), {}) !== null) sent += 1;
  }
  assert.equal(sent, MAX_EVENTS_PER_SESSION);
  assert.equal(crumbs.filter((c) => c.includes('session cap')).length, 1);
});

test('fingerprint is type + top frame + message CLASS — churning ids share one storm', () => {
  const a = fingerprintOf(errorEvent('TimeoutError', 'timeout after 3012ms on job 8f2a9c1d4e'));
  const b = fingerprintOf(errorEvent('TimeoutError', 'timeout after 87ms on job deadbeef99'));
  assert.equal(a, b);

  const c = fingerprintOf(errorEvent('TimeoutError', 'timeout after 87ms', 'otherFrame'));
  assert.notEqual(a, c, 'a different top frame is a different storm');
});

test('messageClassOf collapses digits, hex runs and quoted spans', () => {
  assert.equal(messageClassOf('job 12 of 40'), 'job # of #');
  assert.equal(messageClassOf('id deadbeefcafe1234'), 'id #');
  assert.equal(messageClassOf(`no row for 'maya-7'`), 'no row for "#"');
});

test('a message-only event still fingerprints, on its message class', () => {
  const a = fingerprintOf({ message: 'queue depth 400' });
  const b = fingerprintOf({ message: 'queue depth 900' });
  assert.equal(a, b);
  assert.match(a, /^message@no-frame#/);
});

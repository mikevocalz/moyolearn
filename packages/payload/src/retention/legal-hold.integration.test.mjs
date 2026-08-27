// Doc 31 §4.1's legal hold, proved against the real sweep and real rows.
//
// "Retention follows the learner-content schedule *except* S4 and
// abuse-disclosure records, which follow the legal-hold schedule counsel sets."
// The exception is one predicate — `AND legal_hold IS NULL` — in
// `packages/payload/src/retention/sweep.sql`, and a predicate is the kind of
// thing that gets tidied out of a statement by somebody making it read better.
//
// WHAT A UNIT TEST CANNOT PROVE HERE. `packages/safety/src/incidents.ts` decides
// which records are held, and `ladder.test.ts` covers that decision exhaustively.
// This file asserts the OTHER half — that the DELETE actually declines to touch a
// held row — and that is a claim about a statement running against Postgres. A
// mock would agree with whatever the mock was written to agree with.
//
// It runs the REAL `sweep.sql`, read off disk, rather than a copy of the one
// statement. A test holding its own copy of the DELETE would keep passing after
// somebody changed the file it is supposed to be guarding, which is the exact
// failure mode the sweep already had once (see that file's header: the shadow
// pass silently took the expired-parent deletes down with it).
//
// It issues its own SQL rather than calling `apps/web/lib/incident.repository.ts`,
// for the same reason the two integration tests beside it do: that file begins
// with `import 'server-only'` and will not load outside a server bundle.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.1 · packages/payload/src/retention/sweep.sql · packages/safety/src/incidents.ts
// SOT-KEYWORDS: legal hold integration test retention sweep refuses incident report s4 abuse disclosure expires at delete
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
  Anchored to this file, not to `process.cwd()` — the trap the two tests beside
  this one document: resolved from the cwd, the test reports "no DATABASE_URL"
  while the URL is sitting in `.env`, and a test that skips for the wrong reason
  reads exactly like a test that passed.
*/
const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..');

function databaseUrl() {
  for (const name of ['.env.local', '.env']) {
    const file = resolve(repoRoot, name);
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/postgres(?:ql)?:\/\/\S+/);
      if (match) return match[0].replace(/^["']|["']$/g, '');
    }
  }
  return undefined;
}

const url = databaseUrl();
const SWEEP = readFileSync(resolve(here, 'sweep.sql'), 'utf8');

async function client() {
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
}

/** One expired incident, held or not. Everything else is filler the sweep ignores. */
async function insert(db, { incidentId, severity, category, legalHold }) {
  await db.query(
    `insert into payload.incident_reports
       (incident_id, source, reporter_role, anonymous, subject_learner_auth_id,
        category, severity, occurred_at, summary, status, guardian_visible,
        timeline, expires_at, legal_hold)
     values ($1, 'automated', 'system', false, $2,
             $3, $4, now() - interval '90 days', $5, 'new', true,
             $6::jsonb, now() - interval '1 day', $7)`,
    [
      incidentId,
      `legal-hold-test-${incidentId}`,
      category,
      severity,
      'Fixture for the retention sweep.',
      JSON.stringify([{ at: new Date().toISOString(), actor: 'system', action: 'auto-filed', note: null }]),
      legalHold,
    ],
  );
}

const exists = async (db, incidentId) => {
  const { rows } = await db.query(
    'select 1 from payload.incident_reports where incident_id = $1',
    [incidentId],
  );
  return rows.length > 0;
};

/*
  Skipped rather than failed without a database, for the reason the tests beside
  this one give: a suite that goes red on a laptop with no credentials is a suite
  people learn to ignore, and an ignored retention test reads as proof while
  proving nothing.
*/
const skip = url ? false : 'no DATABASE_URL';

test('the sweep refuses a legal-hold row and takes the expired one beside it', { skip }, async () => {
  const held = `hold-${randomUUID()}`;
  const ordinary = `plain-${randomUUID()}`;
  const db = await client();

  try {
    // An S4 record — every one of them carries a hold (doc 31 §4.1).
    await insert(db, {
      incidentId: held,
      severity: 'S4',
      category: 'self-harm',
      legalHold: 's4-or-abuse-disclosure · pending counsel signoff',
    });
    // An ordinary S3, equally expired, with no hold. The CONTROL: without it, a
    // sweep that deleted nothing at all would pass this test.
    await insert(db, {
      incidentId: ordinary,
      severity: 'S3',
      category: 'safety-concern',
      legalHold: null,
    });

    await db.query(SWEEP);

    assert.equal(
      await exists(db, held),
      true,
      'the sweep crossed a legal hold — doc 31 §4.1 says S4 and abuse-disclosure records follow counsel’s schedule, not this one',
    );
    assert.equal(
      await exists(db, ordinary),
      false,
      'the sweep left an expired, unheld incident behind — the retention promise is not being kept',
    );
  } finally {
    // Cleanup deletes the held row DIRECTLY, which is the one place in this
    // repository that is allowed to: nothing in the product may, which is why
    // the test has to.
    await db.query('delete from payload.incident_reports where incident_id = any($1)', [
      [held, ordinary],
    ]);
    await db.end();
  }
});

test('a held row that has not expired is left alone for the same reason', { skip }, async () => {
  /*
    The predicate is `expires_at < now() AND legal_hold IS NULL`, and this is the
    half of it that is easy to get backwards: an implementation that swapped the
    conditions — deleting held rows and sparing unheld ones — would pass the
    first test's control assertion and fail here.
  */
  const future = `future-${randomUUID()}`;
  const db = await client();

  try {
    await insert(db, {
      incidentId: future,
      severity: 'S3',
      category: 'bullying',
      legalHold: null,
    });
    await db.query(
      "update payload.incident_reports set expires_at = now() + interval '30 days' where incident_id = $1",
      [future],
    );

    await db.query(SWEEP);

    assert.equal(await exists(db, future), true, 'the sweep deleted an incident inside its window');
  } finally {
    await db.query('delete from payload.incident_reports where incident_id = $1', [future]);
    await db.end();
  }
});

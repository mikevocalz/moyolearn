// The daily inference budget, proved durable against a real row.
//
// `packages/inference/src/budget.ts` used to ship only `inMemoryLedger()`, which
// is process-local by construction: a deploy zeroed every child's day and two
// lambdas serving one child each believed they were the only counter. Doc 12 §7's
// cost model rests on that ceiling, so "the budget survives a restart" is a
// claim about a table and cannot be proved by a unit test over a Map.
//
// A RESTART IS MODELLED AS A SECOND CONNECTION. Two independent `pg` clients
// share nothing except the row — which is precisely what the process after a
// deploy shares with the process before it. If the second client sees the first
// client's turns, the ledger is durable; if it sees zero, it is not, and that is
// the exact failure this file exists to catch.
//
// It issues its own SQL rather than calling `apps/web/lib/budget-ledger.repository.ts`
// for the same reason the erasure test does: the repository begins with
// `import 'server-only'` and will not load outside a server bundle. Both files
// are named in `tooling/check-store-separation.mjs`'s `SQL_ALLOWLIST`.
// SOT: packages/inference/src/budget.ts · apps/web/lib/budget-ledger.repository.ts · packages/payload/migrations/edu_inference_budget.sql
// SOT-KEYWORDS: budget ledger durable integration test restart deploy two connections atomic increment ceiling learner daily turns
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/*
  Anchored to this file, not to `process.cwd()` — the same trap
  `erasure.integration.test.mjs` documents: resolved from the cwd, the test
  reports "no DATABASE_URL" while the URL is sitting in `.env`, and a test that
  skips for the wrong reason reads exactly like a test that passed.
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

/**
 * The repository's `record`, character for character.
 *
 * Duplicated rather than imported, and the duplication is the point: this test
 * is asserting that THIS STATEMENT is atomic and cumulative. Importing the
 * repository would make the test agree with whatever the repository does, which
 * is the one thing it must not do.
 */
const RECORD = `insert into edu.inference_budget (learner_id, day, turns, usd)
     values ($1, $2::date, 1, $3)
on conflict (learner_id, day) do update
        set turns = edu.inference_budget.turns + 1,
            usd   = edu.inference_budget.usd + excluded.usd,
            last_turn_at = now()`;

const READ = `select turns, usd
                from edu.inference_budget
               where learner_id = $1 and day = $2::date`;

async function client() {
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  return c;
}

/*
  Skipped rather than failed without a database, for the reason the erasure test
  gives: a suite that goes red on a laptop with no credentials is a suite people
  learn to ignore, and an ignored cost-ceiling test reads as proof while proving
  nothing.
*/
const skip = url ? false : 'no DATABASE_URL';

test('the budget survives a restart — a second connection reads the first one’s turns', { skip }, async () => {
  const learnerId = `budget-test-${randomUUID()}`;
  const day = '2026-08-27';

  // The process BEFORE the deploy.
  const before = await client();
  try {
    for (let i = 0; i < 40; i += 1) {
      await before.query(RECORD, [learnerId, day, 0.013]);
    }
  } finally {
    await before.end();
  }

  // The process AFTER it. A new connection, a new session, nothing carried over
  // but the row.
  const after = await client();
  try {
    const { rows } = await after.query(READ, [learnerId, day]);
    assert.equal(rows.length, 1, 'the ledger row did not survive the connection');
    assert.equal(rows[0].turns, 40, 'the restarted process forgave the day — the §7 ceiling does not hold');

    // `numeric` arrives as a string so a value wider than a double survives the
    // trip; the repository parses it the same way.
    assert.ok(Math.abs(Number(rows[0].usd) - 0.52) < 1e-9, `usd did not accumulate: ${rows[0].usd}`);
  } finally {
    await after.end();
    const cleanup = await client();
    await cleanup.query('delete from edu.inference_budget where learner_id = $1', [learnerId]);
    await cleanup.end();
  }
});

test('two concurrent writers cannot lose a turn', { skip }, async () => {
  const learnerId = `budget-race-${randomUUID()}`;
  const day = '2026-08-27';

  /*
    TWO CONNECTIONS DEBITING AT ONCE — the 3–7pm peak in doc 12 §7, in miniature.

    A read-modify-write ledger loses here: both sides read `n`, both write `n+1`,
    and the child gets a free turn per collision. The repository's single
    `ON CONFLICT … DO UPDATE` statement makes the increment the database's
    problem, which is the only place it can be solved.
  */
  const a = await client();
  const b = await client();
  try {
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        (i % 2 === 0 ? a : b).query(RECORD, [learnerId, day, 0.001]),
      ),
    );
    const { rows } = await a.query(READ, [learnerId, day]);
    assert.equal(rows[0].turns, 20, 'a concurrent debit was lost — the ceiling leaks under load');
  } finally {
    await a.query('delete from edu.inference_budget where learner_id = $1', [learnerId]);
    await a.end();
    await b.end();
  }
});

test('the retention window is generated, not chosen by the writer', { skip }, async () => {
  const learnerId = `budget-ttl-${randomUUID()}`;
  const day = '2026-08-27';

  const c = await client();
  try {
    await c.query(RECORD, [learnerId, day, 0]);

    // 30 days after the day it counts, matching `TRANSCRIPT_TTL_DAYS` — no trace
    // of a session outlives the session's own transcript.
    const { rows } = await c.query(
      `select (expires_at at time zone 'UTC')::date - day as days
         from edu.inference_budget where learner_id = $1 and day = $2::date`,
      [learnerId, day],
    );
    assert.equal(rows[0].days, 30);

    // A writer may not extend its own window. `GENERATED ALWAYS` is what makes
    // the retention promise a property of the column rather than of everyone
    // remembering to pass the right value.
    await assert.rejects(
      () =>
        c.query(
          `insert into edu.inference_budget (learner_id, day, turns, usd, expires_at)
                values ($1, $2::date, 1, 0, now() + interval '10 years')`,
          [`${learnerId}-forever`, day],
        ),
      /non-DEFAULT value into column "expires_at"/i,
      'a writer was allowed to choose its own retention window',
    );
  } finally {
    await c.query('delete from edu.inference_budget where learner_id like $1', [`${learnerId}%`]);
    await c.end();
  }
});

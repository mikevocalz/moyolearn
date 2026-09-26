#!/usr/bin/env node
// Answers the one question `payload.payload_migrations` cannot: has every
// checked-in migration actually reached the database?
//
// That ledger holds ONE row (`name: dev`) against 33 files in
// `packages/payload/migrations/`, because the files are applied by hand. So on
// 2026-09-22 "is production up to date?" had to be answered by probing twenty
// objects one at a time, and the answer was no — `edu_questions.sql` had never
// run. It arrived in `b04e2e2` on a branch that was not `main`, production
// picked that CODE up four days later via a deploy from that branch, and the
// migration did not travel with it.
//
// The cost of not knowing was not theoretical. `eraseEduSubject`
// (apps/web/lib/edu.repository.ts) deletes blocked_tags, knowledge_graph,
// transcripts and then `edu.questions` inside ONE transaction. The missing
// table raised 42P01, the catch rolled the whole thing back, and both account
// deletion routes have been failing — invisibly, because `reportRouteError`
// reports to a Sentry with no DSN configured in production.
//
// `packages/jobs/src/boss.ts` already holds the pg-boss half of this idea in
// `PGBOSS_SCHEMA_VERSION`, asserted by a test. This is the payload half, and it
// has to run against a live database rather than at lint time, so it is a
// script rather than a 23rd lint checker.
//
//   DATABASE_URL=... node tooling/check-schema-applied.mjs
//
// Exits non-zero listing every object a checked-in migration declares and the
// database does not have.
// SOT: packages/payload/migrations/ · docs/decisions/2026-09-22-migration-drift.md
// SOT-KEYWORDS: schema applied migration drift ledger check tables columns production
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import pg from 'pg';

const DIR = 'packages/payload/migrations';

// Only the `IF NOT EXISTS` forms are read. A migration that creates an object
// unconditionally is one that cannot be re-run, and this repo does not write
// them; if one appears, it is better that this check stays quiet about it than
// that it invents a rule the migrations do not follow.
const TABLE = /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+"?(\w+)"?\."?(\w+)"?/gi;
const COLUMN = /ALTER\s+TABLE\s+"?(\w+)"?\."?(\w+)"?\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+"?(\w+)"?/gi;

const tables = new Map();
const columns = new Map();

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort()) {
  const sql = readFileSync(join(DIR, file), 'utf8');
  for (const [, schema, table] of sql.matchAll(TABLE)) {
    tables.set(`${schema}.${table}`, file);
  }
  for (const [, schema, table, column] of sql.matchAll(COLUMN)) {
    columns.set(`${schema}.${table}.${column}`, file);
  }
}

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
if (!connectionString) {
  console.error('  FAIL set DATABASE_URL (or DIRECT_URL) to the database to check.');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes('supabase.co') ? { rejectUnauthorized: false } : undefined,
});
await client.connect();

const missing = [];

// `to_regclass` rather than information_schema: it answers for a relation the
// current role can see without a join, and returns null instead of raising.
for (const [qualified, file] of tables) {
  const { rows } = await client.query('select to_regclass($1) is null as missing', [qualified]);
  if (rows[0]?.missing) missing.push({ what: `table  ${qualified}`, file });
}

for (const [qualified, file] of columns) {
  const [schema, table, column] = qualified.split('.');
  const { rows } = await client.query(
    `select not exists (
       select 1 from information_schema.columns
        where table_schema = $1 and table_name = $2 and column_name = $3
     ) as missing`,
    [schema, table, column],
  );
  if (rows[0]?.missing) missing.push({ what: `column ${qualified}`, file });
}

await client.end();

const checked = tables.size + columns.size;

if (missing.length > 0) {
  console.error(`  FAIL ${missing.length} of ${checked} declared object(s) are not in the database:`);
  for (const { what, file } of missing) console.error(`    ${what}  — declared by ${file}, never applied`);
  console.error('  Apply the named migration(s). A checked-in migration that never ran is a');
  console.error('  table the code already queries: the failure surfaces as 42P01 inside whatever');
  console.error('  transaction reaches it first, which is how learner erasure broke.');
  process.exit(1);
}

console.log(`schema-applied OK — all ${checked} declared table(s) and column(s) are present`);

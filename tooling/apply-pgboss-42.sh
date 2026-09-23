#!/usr/bin/env bash
# Applies the pg-boss 38 -> 42 migration. See docs/decisions/adr-123-pgboss-schema-42.md.
#
# Run from the repo root:  ./tooling/apply-pgboss-42.sh
#
# Picks the SESSION-mode connection (port 5432) on purpose. The 6543 URL in the
# same .env is the transaction pooler, and it cannot run CREATE INDEX
# CONCURRENTLY at all — the migration would fail at statement 20.
#
# Deliberately NOT `-v ON_ERROR_STOP=1`. That flag looks like the careful choice
# and is the wrong one here: on a re-run after an interruption between COMMIT
# and the index work, it aborts at the version guard and never reaches the index
# swap, silently leaving it undone.
set -uo pipefail

PSQL="${PSQL:-/opt/homebrew/opt/libpq/bin/psql}"
SQL="packages/payload/migrations/jobs_pgboss_schema_38_to_42.sql"
[ -f "$SQL" ] || { echo "run me from the repo root; $SQL not found" >&2; exit 1; }

URL="$(grep -h '^DATABASE_URL=\|^DIRECT_URL=\|^POSTGRES_URL' .env .env.local 2>/dev/null \
  | sed 's/^[A-Z_]*=//' | tr -d '"'\''' | grep ':5432' | head -1 \
  | sed -E 's/[?&]pgbouncer=[^&]*//; s/[?&]$//')"
[ -n "$URL" ] || { echo "no port-5432 (session-mode) connection string in .env" >&2; exit 1; }

echo "== before =="
"$PSQL" "$URL" -X -A -t -c "select 'jobs.version = ' || version from jobs.version;"

echo "== applying =="
"$PSQL" "$URL" -X -f "$SQL" || echo "(non-zero exit — read the invalid-index check below before re-running)"

echo "== after =="
"$PSQL" "$URL" -X -A -t -c "select 'jobs.version = ' || version from jobs.version;"

# An interrupted CREATE INDEX CONCURRENTLY leaves an INVALID index behind, and
# the migration's own IF NOT EXISTS will skip rebuilding it on a re-run. This is
# the only failure mode idempotency does not cover, so it gets checked by hand.
echo "== invalid indexes (must be empty) =="
"$PSQL" "$URL" -X -A -t -c "select c.relname from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'jobs' and not i.indisvalid;"

echo "== done — 42 above means deploy the converged build next =="

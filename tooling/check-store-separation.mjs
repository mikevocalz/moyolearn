#!/usr/bin/env node
// Doc 12 §3: "The three-store separation (operational / educational / billing)
// is schema-level in one Postgres v1 — separation is enforced by the repository
// layer and the no-read-path build check, not by running three databases we
// don't need yet."
//
// This is that check, for the educational store. The schema half of the same
// promise is `packages/payload/migrations/edu_schema.sql`; between them the rule
// is that `edu` is reachable through exactly one kind of file and unreachable
// from everywhere else. A separation that exists only as a convention is one
// PR away from not existing, and the PR that ends it will not look like it.
//
// Deliberately TEXTUAL rather than a module-graph walk. The rule being enforced
// is "these files may not name those things", which is a property of the source,
// and a graph walk would miss the case that actually matters: a service that
// writes `edu.*` SQL and hands it to some other client. `pnpm lint`.
// SOT: docs/pack/12-systems-design-prompt.md §3 §4 · docs/pack/07-security-child-ai-safety-spec.md §4 · apps/web/lib/edu.repository.ts
// SOT-KEYWORDS: store separation educational store edu schema repository no read path build check gate three stores
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** Where product code lives. `tooling/` is excluded: this file names everything. */
const SCAN_ROOTS = ['apps', 'packages'];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.expo', '.turbo', 'migrations']);

/**
 * A repository, by the convention every repository in this repo already follows
 * (`apps/web/lib/*.repository.ts`). Matched by shape rather than by an explicit
 * list so a second educational repository needs no edit here — but the count is
 * printed on every run, because a rule whose exceptions grow silently is not a
 * rule. Naming a service `*.repository.ts` to get past this is possible and is
 * exactly the kind of thing code review is for; it is not possible by accident.
 */
const isRepository = (rel) => /(^|\/)[\w.-]+\.repository\.ts$/.test(rel);

/**
 * The educational store's connection module. Nothing outside a repository may
 * import it, which is what makes "only repositories touch the edu store" a
 * property of the build rather than of everyone's memory.
 */
const EDU_CLIENT = /(?:from|import|require\()\s*['"`][^'"`]*\bedu\.client['"`]/;

/**
 * `edu` SQL, recognised by a SQL keyword in front of the table. Matching the
 * bare table name would flag the prose in this file, in the sweep route's own
 * comments and in the design docs — and a check that fails on an explanation of
 * itself gets deleted rather than obeyed.
 *
 * The table list is EXPLICIT rather than `\w+`, so a table added to `edu` without
 * being added here is unguarded — which is why it is added in the same commit as
 * the migration that creates it. `inference_budget` (doc 12 §7's daily ledger)
 * joined the list with `edu_inference_budget.sql`; `blocked_tags` (doc 07 §4's
 * re-derivation guard) with `edu_blocked_tags.sql`.
 */
const EDU_SQL = /\b(?:from|into|update|join|table|truncate)\s+"?edu"?\s*\.\s*"?(?:transcripts|knowledge_graph|embeddings|inference_budget|blocked_tags)\b/i;

/** The raw driver. A file holding one is talking to a database, whatever it calls itself. */
const RAW_DRIVER = /(?:from|import|require\()\s*['"`]pg['"`]/;

/**
 * The feature and service layer. Doc 12 §3: "Services ─► Repositories (ONLY code
 * touching Payload/Drizzle)". `packages/auth` is NOT here on purpose — Better
 * Auth owns the `auth` schema and holds its own `Pool` by design
 * (`packages/auth/src/server.ts`), which is a different store, not a leak.
 */
const FEATURE_ROOTS = ['packages/app'];

/**
 * Files allowed to write `edu` SQL despite not being repositories. Named one by
 * one, so extending the list is a decision somebody made rather than a pattern
 * that quietly widened.
 *
 * `erasure.integration.test.mjs` is here because it proves the cascade against
 * real rows and cannot import the repository to do it — `edu.repository.ts`
 * begins with `import 'server-only'` and will not load outside a server bundle,
 * which is the same reason the payload half of that test issues its own SQL.
 */
const SQL_ALLOWLIST = new Set([
  'packages/payload/src/retention/erasure.integration.test.mjs',
  // Proves the doc 12 §7 budget survives a restart by reading one row from two
  // independent connections, which is a claim about the TABLE. Same reason as
  // above: `budget-ledger.repository.ts` begins with `import 'server-only'` and
  // will not load outside a server bundle, so the proof issues its own SQL.
  'packages/payload/src/retention/budget-ledger.integration.test.mjs',
]);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|cjs|js|jsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const violations = [];
let scanned = 0;
let repositories = 0;

for (const root of SCAN_ROOTS) {
  const dir = join(ROOT, root);
  if (!existsSync(dir)) continue;

  for (const file of walk(dir)) {
    const rel = relative(ROOT, file).split(sep).join('/');
    const source = readFileSync(file, 'utf8');
    scanned += 1;
    const repository = isRepository(rel);
    if (repository) repositories += 1;

    if (!repository && EDU_CLIENT.test(source)) {
      violations.push({
        file: rel,
        rule: 'imports the edu client from outside a repository',
        fix: 'Call a function on apps/web/lib/edu.repository.ts. The client is not a public surface.',
      });
    }

    if (!repository && !SQL_ALLOWLIST.has(rel) && EDU_SQL.test(source)) {
      violations.push({
        file: rel,
        rule: 'writes SQL against the edu schema from outside a repository',
        fix: 'Move the query into apps/web/lib/edu.repository.ts and export the operation, not the SQL.',
      });
    }

    if (FEATURE_ROOTS.some((prefix) => rel.startsWith(`${prefix}/`))) {
      if (RAW_DRIVER.test(source)) {
        violations.push({
          file: rel,
          rule: 'a feature or service holds the raw database driver',
          fix: 'Take a port as an argument and let the composition root inject a repository (see features/tutor/session.service.ts).',
        });
      }
      if (EDU_CLIENT.test(source) || EDU_SQL.test(source)) {
        violations.push({
          file: rel,
          rule: 'a feature or service reaches the educational store directly',
          fix: 'Declare a port type on the service and inject the repository. Identity comes from ctx, never from the query.',
        });
      }
    }
  }
}

if (violations.length > 0) {
  console.error('\ncheck-store-separation — the educational store is reachable from the wrong place.\n');
  console.error(
    'Doc 12 §3: the three-store separation is enforced by the repository layer and this check,\n' +
      'not by three databases. One store, one door — and the door is a repository.\n',
  );
  for (const violation of violations) {
    console.error(`  ${violation.file}`);
    console.error(`    ${violation.rule}`);
    console.error(`    → ${violation.fix}\n`);
  }
  process.exit(1);
}

console.log(
  `store-separation OK — ${scanned} files scanned, ${repositories} repositories may reach the edu store, ` +
    `${SQL_ALLOWLIST.size} allowlisted non-repository SQL author(s)`,
);

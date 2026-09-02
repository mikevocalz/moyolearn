#!/usr/bin/env node
// Doc 31 §4.2: "**The CRM never reads incidents** — doc 23's wall applies;
// 'child had a safety incident' must never become a sales signal, structurally."
//
// Doc 23 §2 draws the wall one level up — "CRM rows hold relationship,
// scheduling, attendance, and billing context — never learning content" — and
// §4 extends it to automations: "the automation engine cannot even *reference*
// mastery fields, because they don't exist in its schema." Safety is the sharper
// case of the same rule. A mastery signal in a sales funnel is a bad product; a
// safety incident in one is a family finding out that their child's worst day
// generated a retention email.
//
// THIS IS THE STRUCTURAL HALF. `tooling/check-store-separation.mjs` is the
// sibling that keeps the educational store behind one door; this one keeps the
// incident store out of one wing. The rule it enforces is a property of the
// MODULE GRAPH, not of a schema: the CRM's schema separation is real (incidents
// are their own collection with their own repository), and what a schema cannot
// stop is a lead surface adding one import.
//
// TWO CHECKS, BECAUSE THERE ARE TWO WAYS IN AND A GRAPH WALK ONLY CATCHES ONE:
//
//   1. REACHABILITY. From each CRM root, every relative and `@/`-aliased import
//      is walked transitively. If that closure contains an incident module, the
//      wall is down — even if the file that imports it is three hops away and
//      nobody meant it.
//
//   2. NAMING. `@acme/app/server` is a SHARED barrel: the ops routes import
//      `listLeads` from it and the guardian routes import `guardianIncidents`
//      from it, so a graph walk cannot tell them apart — every CRM file "reaches"
//      the incident service through the barrel and always will. So the second
//      check is over what a CRM-reachable file NAMES: the incident bindings, the
//      collection slug, and the row type. Importing `listLeads` from the barrel
//      is fine; naming `guardianIncidents` in an ops file is the violation.
//
// TEXTUAL, like its sibling, and for the same reason: the question is "does this
// file name that thing", which is a property of the source. `pnpm lint`.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.2 · docs/pack/23-crm-spec.md §2 §4 · tooling/check-store-separation.mjs
// SOT-KEYWORDS: crm wall incident reports sales signal ops leads module graph import path no read path build check doc 23
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/**
 * The CRM, by directory.
 *
 * These are the Operations Cloud surfaces doc 23 and doc 28 describe: the lead
 * pipeline, the ops dashboard, the org objects, and the routes behind them.
 * Listed explicitly rather than matched by a name pattern, because "is this the
 * CRM" is a product question and a regex would answer it by accident.
 */
const CRM_ROOTS = [
  'packages/app/features/ops',
  'packages/app/features/org',
  'apps/web/app/api/ops',
  'apps/web/lib/leads.repository.ts',
  'apps/web/lib/org.repository.ts',
];

/**
 * The incident system, by module.
 *
 * A path that matches any of these is an incident module, and no CRM root may
 * reach one. `features/safety/` is the domain service, the two `apps/web/lib`
 * files are the store and the intake, and the collection is the table itself.
 */
const INCIDENT_MODULES = [
  /packages\/app\/features\/safety\//,
  /apps\/web\/lib\/incident\.(repository|service)\.ts$/,
  /packages\/payload\/src\/collections\/IncidentReports\.ts$/,
  /apps\/web\/app\/api\/safety\/incidents\//,
  /apps\/web\/app\/api\/tutor\/incidents\//,
  /*
    Doc 34 §3 extends the same wall to session summaries: "CRM sales surfaces
    never read summaries." A safety incident in a sales funnel is a family's
    worst day as a retention signal; a session report in one is the §1 flattery
    machine industrialised — the report exists to be HONEST with a parent, and
    honesty does not survive being a renewal instrument. Same wall, second
    wing.
  */
  /packages\/app\/features\/summary\//,
  /apps\/web\/lib\/summary\.repository\.ts$/,
  /packages\/payload\/src\/collections\/SessionSummaries\.ts$/,
  /apps\/web\/app\/api\/guardian\/reports\//,
  /apps\/web\/app\/api\/summary\//,
  /apps\/web\/app\/api\/share\/report\//,
];

/**
 * Names that mean "this file is looking at incidents", however it imported them.
 *
 * `incidentReports` is the Payload slug — a `payload.find({ collection:
 * 'incidentReports' })` inside the CRM would bypass every module edge this file
 * walks. The rest are the service and repository bindings that travel through
 * shared barrels, where reachability cannot distinguish them from `listLeads`.
 */
const INCIDENT_NAMES = [
  'incidentReports',
  'incident_reports',
  'guardianIncidents',
  'guardianIncidentsFrom',
  'acknowledgeGuardianIncident',
  'incidentTriageQueue',
  'triageIncident',
  'triageQueueFrom',
  'submitIncident',
  'loadIncident',
  'loadIncidentQueue',
  'loadGuardianIncidents',
  'loadTutorIncidents',
  'tutorIncidents',
  'tutorIncidentsFrom',
  'appendTutorIncidentNote',
  'TutorIncidentView',
  'saveIncident',
  'incidentFromSafetyEvent',
  'incidentFromSubmission',
  'enqueueIncidentFanOut',
  'escalateAndFile',
  'IncidentReport',
  'IncidentTimelineEntry',
  /*
    Doc 34 §3's wing of the wall, by name — the bindings that travel through
    the shared `@acme/app/server` barrel, where reachability cannot tell them
    from `listLeads`, plus the Payload slug a raw `payload.find` would name.
  */
  'sessionSummaries',
  'session_summaries',
  'SessionSummaryReport',
  'SessionSummary',
  'guardianSummaries',
  'guardianSummariesFrom',
  'guardianSummaryReport',
  'generateSessionSummary',
  'summaryQueue',
  'approveSummaryDraft',
  'suppressSummary',
  'createTeacherShare',
  'revokeTeacherShare',
  'sharedSummaryView',
  'loadGuardianSummaries',
  'loadSummaryBySession',
  'loadSummaryQueue',
  'saveSummaryReport',
  'forgetSessionSummaries',
  'enqueueSummary',
];

const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.expo', '.turbo']);
const SOURCE = /\.(ts|tsx|mjs|cjs|js|jsx)$/;

/** Extension candidates in Metro/TS resolution order, platform forks included. */
const CANDIDATES = [
  '',
  '.ts',
  '.tsx',
  '.mjs',
  '.js',
  '.web.ts',
  '.web.tsx',
  '.native.ts',
  '.native.tsx',
  '/index.ts',
  '/index.tsx',
  '/index.web.ts',
  '/index.native.ts',
];

const IMPORT_FROM = /(?:^|\n)\s*(?:export|import)\s[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const IMPORT_SIDE_EFFECT = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE.test(entry)) out.push(full);
  }
  return out;
}

/** Every source file under a root, whether the root is a file or a directory. */
function filesUnder(rootRel) {
  const full = join(ROOT, rootRel);
  if (!existsSync(full)) return [];
  return statSync(full).isDirectory() ? walk(full) : [full];
}

/**
 * Resolves one specifier to a file inside this repository, or `null`.
 *
 * Relative paths and the `@/` alias (which `apps/web/tsconfig.json` maps to
 * `apps/web`) are the two edges a CRM file can use to reach a module in this
 * repository without going through a package barrel. A bare specifier leaves the
 * package and ends the walk — that case is what check 2 covers.
 */
function resolveSpecifier(fromFile, specifier) {
  let base;
  if (specifier.startsWith('.')) base = join(dirname(fromFile), specifier);
  else if (specifier.startsWith('@/')) base = join(ROOT, 'apps/web', specifier.slice(2));
  else return null;

  for (const ext of CANDIDATES) {
    const path = base + ext;
    if (existsSync(path) && statSync(path).isFile()) return path;
  }
  return null;
}

const rel = (file) => relative(ROOT, file).split(sep).join('/');

const violations = [];

// ── check 1 · reachability ───────────────────────────────────────────────────
const seeds = CRM_ROOTS.flatMap(filesUnder);
const seen = new Set(seeds.map((file) => resolve(file)));
const queue = [...seeds.map((file) => ({ file: resolve(file), via: [] }))];
const reachable = [];

while (queue.length > 0) {
  const { file, via } = queue.shift();
  reachable.push(file);
  const source = readFileSync(file, 'utf8');

  for (const pattern of [IMPORT_FROM, IMPORT_SIDE_EFFECT]) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const target = resolveSpecifier(file, match[1]);
      if (target === null) continue;

      const targetRel = rel(target);
      if (INCIDENT_MODULES.some((incident) => incident.test(targetRel))) {
        violations.push({
          file: rel(file),
          rule: `reaches the incident system at ${targetRel}`,
          path: [...via.map(rel), rel(file), targetRel],
          fix: 'Doc 31 §4.2: the CRM never reads incidents. Delete the edge — there is no supported way to surface a safety record on a sales pipeline.',
        });
        continue;
      }

      const key = resolve(target);
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ file: key, via: [...via, file] });
    }
  }
}

// ── check 2 · naming ─────────────────────────────────────────────────────────
/*
  Only the SEEDS are named-checked, not the whole reachable closure. A shared
  module the CRM happens to reach — a formatter, a date helper — is not CRM code
  and naming an incident type inside one would be a false positive. The seeds are
  the files that ARE the Operations Cloud, and they are the ones the wall is
  drawn around.
*/
for (const file of seeds) {
  const source = readFileSync(file, 'utf8');
  // Comments blanked out, so a file that EXPLAINS the wall does not fail it —
  // a check that fails on its own documentation gets deleted rather than obeyed.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|\n)\s*\/\/[^\n]*/g, '$1');

  for (const name of INCIDENT_NAMES) {
    if (new RegExp(`\\b${name}\\b`).test(code)) {
      violations.push({
        file: rel(file),
        rule: `names \`${name}\` — the incident system, through a shared barrel or a collection slug`,
        path: [rel(file)],
        fix: 'Doc 31 §4.2: "child had a safety incident" must never become a sales signal. The CRM has no incident surface; take the field out.',
      });
    }
  }
}

if (violations.length > 0) {
  console.error('\ncheck-crm-wall — doc 23’s wall no longer holds for safety incidents.\n');
  console.error(
    'Doc 31 §4.2: THE CRM NEVER READS INCIDENTS. "Child had a safety incident" must never\n' +
      'become a sales signal, and the guarantee is structural — no import path, no collection\n' +
      'slug, no shared binding — because a rule that lives in a review comment is one PR from\n' +
      'not existing, and the PR that ends it will not look like it.\n',
  );
  for (const violation of violations) {
    console.error(`  ${violation.file}`);
    console.error(`    ${violation.rule}`);
    if (violation.path.length > 1) console.error(`    path: ${violation.path.join(' → ')}`);
    console.error(`    → ${violation.fix}\n`);
  }
  process.exit(1);
}

console.log(
  `crm-wall OK — ${seeds.length} CRM file(s), ${reachable.length} module(s) reachable from them, ` +
    `0 reach the incident system and 0 name it`,
);

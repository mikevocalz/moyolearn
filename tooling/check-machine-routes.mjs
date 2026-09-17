#!/usr/bin/env node
// The proxy's public list and the routes that defend themselves must be the
// SAME SET. This check holds that equality in both directions.
//
// WHAT WENT WRONG. `apps/web/proxy.ts` puts every path outside `PUBLIC_PATHS`
// behind a Better Auth session. A cron and a workflow do not carry a session —
// they carry `Authorization: Bearer <secret>` — so every machine-shaped route
// answered 401 at the proxy, before its own bearer check ever ran. Nothing
// about that is visible: the deploy is green, the route file is correct, the
// secret is set, and the 401 is returned by a file nobody edits when they add
// a route. It ran that way for about seventeen days — `jobs-drain` failed on
// every scheduled tick, the daily media and retention sweeps declared in
// `apps/web/vercel.json` never ran in production, and `/api/health/jobs`, the
// dead-man switch built to catch exactly this, was gated too and so reported
// none of it. A retention promise on a child's data looked kept and was not.
//
// DIRECTION 1 — a machine route the world can reach must be public. A "machine
// route" is detected by what the file DOES: it compares the `Authorization`
// header against a `process.env.*SECRET*`. Not by a name, not by a path
// allowlist, so `/api/reindex/cron` written next month is seen on the day it is
// written rather than on the day someone remembers this file.
//
// Not every machine route needs a public path, and the difference is WHO CALLS
// IT. `POST /api/media/sweep` and `POST /api/retention/sweep` are bearer routes
// that the proxy gates on purpose (proxy.ts says so: opening `/api/media` to
// reach one cron would take `presign`, `video`, `view` and `voice-note` with
// it) — and they still work, because their only caller is `apps/web/lib/jobs.ts`,
// which imports their `POST` and calls it IN PROCESS. The proxy is not on that
// path. So the rule is: a machine route must be public unless every caller of
// it is in-process, and any machine route an HTTP caller declared in this repo
// names — a `vercel.json` cron path, a workflow's URL or the bearer secret a
// workflow holds — must be public whatever else calls it.
//
// The default is conservative on purpose: a machine route with NO caller this
// file can find is required to be public. A new door whose caller lives outside
// the repo fails here until someone states which it is, which is the cheap end
// of the mistake.
//
// DIRECTION 2 — nothing rides into the public list without defending itself.
// A prefix is an opening, not a door: `/api/jobs` publishes everything under
// `apps/web/app/api/jobs`, today and forever. So every route beneath a prefix
// that was opened for machine doors must either run its own bearer check or say
// in its header that it is UNAUTHENTICATED BY DESIGN — the words `/api/health/jobs`
// uses, with its reasoning attached (an uptime prober cannot hold a secret worth
// having; the body is queue names and booleans). Read from the file, not
// hardcoded here, so the declaration lives where the next author will see it.
//
// Which prefixes those are is also derived rather than listed: a `PUBLIC_PATHS`
// entry under `/api/` counts as a machine door when something beneath it
// defends itself. That is what "this prefix was opened for machine traffic"
// looks like from the outside, and it leaves `/api/auth` and `/api/marketing`
// — public for their own reasons, neither of them bearer-shaped — out of scope.
//
// Direction 1 alone lets someone open `/api/media` to fix a cron and publish a
// child's presign endpoint. Direction 2 alone lets the original outage happen
// again. Both, or neither is worth running.
//
// Every read here is of comment-stripped source. These files argue about
// bearers and name these paths in prose — proxy.ts's own comment lists
// `/api/health/jobs`, and the cron doors' headers spell out which secret signs
// what — so a line-oriented scan would find its own documentation and pass.
//
// Usage: pnpm check:machine
// SOT: apps/web/proxy.ts · apps/web/vercel.json · .github/workflows/jobs-drain.yml ·
//      apps/web/lib/jobs.ts · docs/design/jobs.md §4.2 §8.2
// SOT-KEYWORDS: machine route bearer secret cron proxy public paths session gate 401 drain sweep health dead man switch
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const WEB = join(ROOT, 'apps/web');
const APP_DIR = join(WEB, 'app');
const API_DIR = join(APP_DIR, 'api');
const PROXY = join(WEB, 'proxy.ts');
const VERCEL = join(WEB, 'vercel.json');
const WORKFLOWS = join(ROOT, '.github/workflows');

/** Where a caller of a route handler could live. `@/` resolves inside `apps/web`. */
const CALLER_ROOTS = ['apps/web', 'packages'];

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', '.expo', '.turbo', 'build']);

const ROUTE_FILE = /^route\.(?:ts|tsx|js|mjs)$/;
const SOURCE_FILE = /\.(?:ts|tsx|mts|js|mjs)$/;

/** How many leading lines count as the header block a declaration must live in. */
const HEADER_LINES = 40;

/**
 * The declaration a route makes when it is public on purpose.
 *
 * Matched against the header rather than the whole file so the statement sits
 * where this codebase already puts intent, and so a passing mention further
 * down — "unlike the unauthenticated health route" — cannot publish a surface.
 */
const BY_DESIGN = /unauthenticated\s+by\s+design/i;

/** An env var worth comparing a bearer against. */
const SECRET_NAME = /SECRET|TOKEN|KEY/;

// ---------------------------------------------------------------------------

/**
 * Blanks comments, preserving every offset and every string.
 *
 * Strings survive because the answers live inside them — the `PUBLIC_PATHS`
 * entries, and the `` `Bearer ${secret}` `` a route compares against. Comments
 * do not survive because the answers are also DISCUSSED in them, at length, in
 * every file this reads.
 *
 * Strings and regex literals are skipped rather than scanned so a `//` inside
 * one cannot open a comment that swallows the rest of the file.
 */
function stripComments(source) {
  const out = source.split('');
  const blank = (from, to) => {
    for (let i = from; i < to && i < source.length; i += 1) {
      if (source[i] !== '\n') out[i] = ' ';
    }
  };

  const KEYWORDS = new Set(['return', 'typeof', 'in', 'of', 'case', 'do', 'else', 'yield', 'await']);
  const PREFIX = new Set([...'(,=:[!&|?{};+-*%^~<>']);

  let i = 0;
  let prevChar = '';
  let prevWord = '';

  const quoted = (open, from) => {
    let j = from;
    while (j < source.length) {
      if (source[j] === '\\') {
        j += 2;
        continue;
      }
      if (source[j] === open) return j + 1;
      if (source[j] === '\n' && open !== '`') return j;
      j += 1;
    }
    return source.length;
  };

  while (i < source.length) {
    const c = source[i];

    if (c === '/' && source[i + 1] === '/') {
      const end = source.indexOf('\n', i);
      const stop = end < 0 ? source.length : end;
      blank(i, stop);
      i = stop;
      continue;
    }

    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      i = quoted(c, i + 1);
      prevChar = c;
      prevWord = '';
      continue;
    }

    // A `/` opens a regex only where a value may begin; anywhere else it divides.
    if (c === '/' && (prevChar === '' || PREFIX.has(prevChar) || KEYWORDS.has(prevWord))) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length) {
        const ch = source[j];
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) break;
        else if (ch === '\n') break;
        j += 1;
      }
      prevChar = '/';
      prevWord = '';
      i = Math.min(j + 1, source.length);
      continue;
    }

    if (!/\s/.test(c)) {
      prevChar = c;
      prevWord = /[A-Za-z0-9_$]/.test(c) ? prevWord + c : '';
    }
    i += 1;
  }

  return out.join('');
}

function walk(dir, matches, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), matches, out);
    } else if (matches(entry.name)) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** `app/api/jobs/drain/cron/route.ts` → `/api/jobs/drain/cron`, route groups dropped. */
function urlPath(file) {
  const segments = relative(APP_DIR, dirname(file))
    .split(sep)
    .filter((segment) => segment.length > 0 && !/^\(.*\)$/.test(segment));
  return `/${segments.join('/')}`;
}


// ---------------------------------------------------------------------------
// The proxy: what it publishes, and whether it still publishes it the way this
// check believes it does.

const proxySource = readFileSync(PROXY, 'utf8');
const proxyCode = stripComments(proxySource);

const listStart = proxyCode.indexOf('PUBLIC_PATHS');
const listEnd = proxyCode.indexOf(']', listStart);
if (listStart < 0 || listEnd < 0) {
  console.error('\ncheck-machine-routes — no PUBLIC_PATHS array in apps/web/proxy.ts.\n');
  console.error('The proxy is the whole subject of this check. Either it moved, or the gate is\n');
  console.error('now reading a file that cannot answer the question.\n');
  process.exit(1);
}

const PUBLIC_PATHS = [...proxyCode.slice(listStart, listEnd).matchAll(/'([^']+)'|"([^"]+)"/g)].map(
  (match) => match[1] ?? match[2],
);

if (PUBLIC_PATHS.length === 0) {
  console.error('\ncheck-machine-routes — PUBLIC_PATHS parsed as empty.\n');
  console.error('A probe that reads nothing reports a clean repo forever. Fix the parse.\n');
  process.exit(1);
}

/*
  Mirrors proxy.ts's own matcher. If the proxy stops matching this way — a
  regex list, an exact-match set, a rewrite — every coverage answer below is
  computed against a rule that is no longer enforced, and the failure would be a
  silent pass. So the shape is asserted rather than assumed.
*/
if (!/PUBLIC_PATHS\.some/.test(proxyCode) || !/startsWith\(/.test(proxyCode)) {
  console.error('\ncheck-machine-routes — the proxy no longer matches PUBLIC_PATHS by prefix.\n');
  console.error('This gate models that matcher. Update `covered()` here to whatever replaced it\n');
  console.error('before trusting another green run.\n');
  process.exit(1);
}

const coveredBy = (prefix, path) => path === prefix || path.startsWith(`${prefix}/`);

const covered = (path) => PUBLIC_PATHS.some((prefix) => coveredBy(prefix, path));

// ---------------------------------------------------------------------------
// Every route under app/api, and what it does about authentication.

const routeFiles = walk(API_DIR, (name) => ROUTE_FILE.test(name));
if (routeFiles.length === 0) {
  console.error('\ncheck-machine-routes — no route handlers found under apps/web/app/api.\n');
  console.error('The walk is broken; it is not that the app has no API.\n');
  process.exit(1);
}

const failures = [];
const fail = (message) => failures.push(message);

/**
 * The env secrets a file compares the `Authorization` header against.
 *
 * `[]` means it takes no bearer. `null` means it compares the header against
 * something this file could not trace back to `process.env` — which is NOT a
 * pass: an untraceable bearer check is a machine route the gate cannot classify,
 * and a gate that shrugs is the failure mode it exists to prevent.
 */
function bearerSecrets(code) {
  const authReads = [...code.matchAll(/headers\s*\.\s*get\(\s*(['"])authorization\1\s*\)/gi)];
  if (authReads.length === 0) return [];

  const secrets = new Set();
  let untraceable = false;

  for (const read of authReads) {
    // The enclosing statement: enough context to see the comparison, little
    // enough that the next check's secret cannot be read as this one's.
    //
    // `${…}` is stepped over rather than treated as a brace. The whole point of
    // the scan is to reach `` `Bearer ${secret}` ``, and a scan that stops at
    // the first `{` stops one character short of the answer every time.
    let from = read.index;
    while (from > 0 && !';{}'.includes(code[from - 1])) from -= 1;
    let to = read.index;
    let depth = 0;
    while (to < code.length) {
      if (code[to] === '$' && code[to + 1] === '{') {
        depth += 1;
        to += 2;
        continue;
      }
      if (depth > 0 && code[to] === '}') {
        depth -= 1;
        to += 1;
        continue;
      }
      if (depth === 0 && ';{}'.includes(code[to])) break;
      to += 1;
    }
    const statement = code.slice(from, to);

    if (!/[=!]==?/.test(statement)) continue;

    const direct = [...statement.matchAll(/Bearer\s*\$\{\s*process\.env\.([A-Z0-9_]+)/g)];
    for (const match of direct) secrets.add(match[1]);

    const indirect = [...statement.matchAll(/Bearer\s*\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g)];
    for (const match of indirect) {
      const binding = new RegExp(
        `\\b(?:const|let|var)\\s+${match[1]}\\b[^=;]*=\\s*process\\.env(?:\\.([A-Z0-9_]+)|\\[\\s*['"]([A-Z0-9_]+)['"]\\s*\\])`,
      ).exec(code);
      if (binding) secrets.add(binding[1] ?? binding[2]);
      else untraceable = true;
    }

    if (direct.length === 0 && indirect.length === 0) untraceable = true;
  }

  if (secrets.size === 0) return untraceable ? null : [];
  return [...secrets].filter((name) => SECRET_NAME.test(name));
}

const routes = routeFiles.map((file) => {
  const source = readFileSync(file, 'utf8');
  const code = stripComments(source);
  const secrets = bearerSecrets(code);
  return {
    file,
    rel: relative(ROOT, file),
    path: urlPath(file),
    code,
    secrets,
    byDesign: BY_DESIGN.test(source.split('\n').slice(0, HEADER_LINES).join('\n')),
  };
});

for (const route of routes) {
  if (route.secrets !== null) continue;
  fail(
    `${route.rel} — compares the Authorization header against something this gate cannot trace\n` +
      '    to process.env. Bind the secret first (`const secret = process.env.X_SECRET;`) so the\n' +
      '    check can tell a machine door from a learner route, because it will not guess.',
  );
}

const machineRoutes = routes.filter((route) => route.secrets !== null && route.secrets.length > 0);
const defends = (route) => (route.secrets !== null && route.secrets.length > 0) || route.byDesign;

if (machineRoutes.length === 0 && failures.length === 0) {
  console.error('\ncheck-machine-routes — no bearer-authenticated route found under app/api.\n');
  console.error('The drain and the two sweeps are bearer routes. Finding none means the detector\n');
  console.error('has stopped recognising them, not that they are gone.\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Who calls a machine route, and over what.

/**
 * HTTP callers this repo declares: the Vercel cron table, and the workflows.
 *
 * A workflow's `/api/...` URL is read out of the whole file INCLUDING comments,
 * which is the opposite of the rule everywhere else here and is deliberate:
 * `jobs-drain.yml` holds its target in `JOBS_DRAIN_URL`, a repo secret, so the
 * documented shape in the header is the only form of the path that exists in
 * version control. A workflow comment naming an endpoint is a declaration, not
 * prose about one. The secret NAME is the load-bearing signal either way — it
 * appears in a real `env:` key, and it is what ties a workflow to the route
 * that checks that exact secret.
 */
function httpCallers() {
  const paths = new Set();
  const secrets = new Set();

  if (existsSync(VERCEL)) {
    const crons = JSON.parse(readFileSync(VERCEL, 'utf8')).crons ?? [];
    for (const cron of crons) if (cron.path) paths.add(cron.path);
  }

  if (existsSync(WORKFLOWS)) {
    for (const file of walk(WORKFLOWS, (name) => /\.ya?ml$/.test(name))) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\/api\/[A-Za-z0-9_\-[\]/.]*[A-Za-z0-9_\-[\]]/g)) {
        paths.add(match[0]);
      }
      for (const match of source.matchAll(/\b[A-Z][A-Z0-9_]*(?:SECRET|TOKEN|KEY)[A-Z0-9_]*\b/g)) {
        secrets.add(match[0]);
      }
    }
  }

  return { paths, secrets };
}

const http = httpCallers();
if (http.paths.size === 0) {
  console.error('\ncheck-machine-routes — no scheduled HTTP caller found.\n');
  console.error('apps/web/vercel.json declares crons and .github/workflows holds the drain tick.\n');
  console.error('Reading neither means the probe broke, not that nothing is scheduled.\n');
  process.exit(1);
}

/**
 * Handlers imported and invoked inside the deployment.
 *
 * `apps/web/lib/jobs.ts` runs both sweeps this way — `import { POST as mediaSweep }`,
 * called with a hand-built `NextRequest` — and that call never leaves the
 * process, so the proxy never sees it and no public path is needed. Resolution
 * is textual because the question is only "does this specifier land on that
 * route file", and a specifier is either `@/…`, relative, or irrelevant here.
 */
function inProcessCallers(routesByFile) {
  const called = new Set();

  for (const root of CALLER_ROOTS) {
    const dir = join(ROOT, root);
    if (!existsSync(dir)) continue;
    for (const file of walk(dir, (name) => SOURCE_FILE.test(name))) {
      const code = stripComments(readFileSync(file, 'utf8'));
      for (const match of code.matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g)) {
        const spec = match[1] ?? match[2];
        if (!spec.includes('/route') && !spec.endsWith('route')) continue;

        const base = spec.startsWith('@/')
          ? join(WEB, spec.slice(2))
          : spec.startsWith('.')
            ? resolve(dirname(file), spec)
            : null;
        if (base === null) continue;

        for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`]) {
          if (routesByFile.has(candidate) && candidate !== file) called.add(candidate);
        }
      }
    }
  }

  return called;
}

const routesByFile = new Set(routeFiles);
const inProcess = inProcessCallers(routesByFile);

// ---------------------------------------------------------------------------
// Direction 1: a machine route the world can reach must be in PUBLIC_PATHS.

let publicMachineRoutes = 0;
let inProcessOnly = 0;

for (const route of machineRoutes) {
  const reachedBy = [];
  if (http.paths.has(route.path)) reachedBy.push('a scheduled HTTP caller names this path');
  for (const secret of route.secrets) {
    if (http.secrets.has(secret)) reachedBy.push(`a workflow holds ${secret}`);
  }
  if (reachedBy.length === 0 && !inProcess.has(route.file)) {
    reachedBy.push('nothing in this repo calls it in process, so its caller is over HTTP');
  }

  if (covered(route.path)) {
    publicMachineRoutes += 1;
    continue;
  }
  if (reachedBy.length === 0) {
    inProcessOnly += 1;
    continue;
  }

  fail(
    `${route.rel} — ${route.path} checks a bearer (${route.secrets.join(', ')}) and is NOT in\n` +
      `    PUBLIC_PATHS, but ${reachedBy[0]}. The proxy answers 401 before this handler runs,\n` +
      '    on every call, with a green deploy and a correct route file.\n' +
      `    Fix: add '${route.path}' to PUBLIC_PATHS in apps/web/proxy.ts — the exact path, not\n` +
      '    its parent prefix, which would publish every sibling under it too.',
  );
}

// ---------------------------------------------------------------------------
// Direction 2: everything under an opened prefix defends itself.

const machineDoors = PUBLIC_PATHS.filter(
  (prefix) =>
    prefix.startsWith('/api/') &&
    routes.some((route) => coveredBy(prefix, route.path) && defends(route)),
);

let guarded = 0;
let declared = 0;

for (const prefix of machineDoors) {
  for (const route of routes) {
    if (!coveredBy(prefix, route.path)) continue;
    if (route.secrets !== null && route.secrets.length > 0) {
      guarded += 1;
      continue;
    }
    if (route.byDesign) {
      declared += 1;
      continue;
    }
    fail(
      `${route.rel} — ${route.path} is published by '${prefix}' in PUBLIC_PATHS and defends\n` +
        '    nothing: no bearer check, no declaration. That is a public endpoint nobody decided\n' +
        '    to publish — the prefix was opened for the machine doors beside it and took this\n' +
        '    one with it.\n' +
        '    Fix: check a bearer against a process.env secret, or put the words UNAUTHENTICATED\n' +
        "    BY DESIGN in the file's header with the reasoning (see app/api/health/jobs/route.ts).",
    );
  }
}

// ---------------------------------------------------------------------------

if (failures.length > 0) {
  console.error('\ncheck-machine-routes — the proxy gate and the routes disagree.\n');
  console.error(
    'A bearer is not a session. Every machine-shaped route reachable over HTTP must be in\n' +
      "apps/web/proxy.ts's PUBLIC_PATHS, and everything published by those entries must defend\n" +
      'itself. Both halves failed silently once: seventeen days of dead crons behind green\n' +
      'deploys, with the dead-man switch gated too.\n',
  );
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(
  `machine-routes OK — ${machineRoutes.length} bearer routes (${publicMachineRoutes} public, ` +
    `${inProcessOnly} called in process only), ${machineDoors.length} opened prefixes covering ` +
    `${guarded} guarded and ${declared} by-design routes`,
);

/**
 * Dependency declaration checks for a pnpm-catalog workspace.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * I shipped the bug this catches. Adding the shader probe meant adding
 * `"esbuild": "catalog:"` and `"playwright": "catalog:"` to
 * `packages/avatar/package.json` — and never adding the matching entries to
 * `pnpm-workspace.yaml`. Nothing local complains: the package typechecks, the
 * tests pass, the probe runs. `pnpm install --frozen-lockfile` fails, on CI, on
 * the next person's branch.
 *
 * That is the whole shape of the problem. A catalog protocol makes "one version
 * per dependency" enforceable, and in exchange it introduces a reference that
 * only the installer resolves. Every check we run before the installer is blind
 * to it.
 *
 * ── THE TWO CHECKS ──────────────────────────────────────────────────────────
 *
 * 1. **Every `catalog:` reference resolves.** A dependency declared
 *    `catalog:` or `catalog:<name>` must exist in the workspace's `catalog:` /
 *    `catalogs:` block. This is the one that bit.
 *
 * 2. **Every bare import is declared.** Every non-relative import in a
 *    package's sources must appear in its own `dependencies`,
 *    `devDependencies` or `peerDependencies` — or be a `node:` builtin, or the
 *    package importing itself. Catches the other direction: code that works
 *    only because a transitive dependency happened to be hoisted, which breaks
 *    the moment someone else's tree changes.
 *
 * Neither is clever. Both are the sort of thing a monorepo silently accumulates
 * and then debugs at the worst possible moment.
 *
 * Usage: node tools/verify_deps.mjs [repoRoot]        (default: ../..)
 *
 * SOT: docs/pack/20-build-optimization-spec.md, docs/pack/11-architectural-guardrails.md
 * SOT-KEYWORDS: dependencies catalog pnpm workspace install undeclared imports monorepo guardrail
 */
import { existsSync, globSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(process.argv[2] ?? join(here, '../../..'));

const workspacePath = join(repoRoot, 'pnpm-workspace.yaml');
if (!existsSync(workspacePath)) {
  process.stderr.write(`no pnpm-workspace.yaml at ${repoRoot}\n`);
  process.exit(2);
}

/**
 * A deliberately small YAML reader: the catalog blocks are flat `name: version`
 * maps and nothing here needs a parser dependency. It reads `catalog:` and each
 * block under `catalogs:`, and stops at the first line that is not indented,
 * which is what ends a block in this file.
 */
function readCatalogs(text) {
  const lines = text.split('\n');
  const named = new Map();
  const readBlock = (start, indent) => {
    const names = new Set();
    for (let i = start; i < lines.length; ++i) {
      const line = lines[i];
      if (!line.trim() || line.trimStart().startsWith('#')) continue;
      const lead = line.length - line.trimStart().length;
      if (lead < indent) break;
      if (lead > indent) continue;
      const match = line.trim().match(/^"?([A-Za-z0-9@/._-]+)"?\s*:/);
      if (match) names.add(match[1]);
    }
    return names;
  };

  for (let i = 0; i < lines.length; ++i) {
    if (lines[i].trimStart().startsWith('#')) continue;
    if (lines[i].trimEnd() === 'catalog:') named.set('default', readBlock(i + 1, 2));
    if (lines[i].trimEnd() === 'catalogs:') {
      for (let j = i + 1; j < lines.length; ++j) {
        if (!lines[j].trim() || lines[j].trimStart().startsWith('#')) continue;
        const lead = lines[j].length - lines[j].trimStart().length;
        if (lead === 0) break;
        if (lead === 2) {
          const name = lines[j].trim().replace(/:$/, '');
          named.set(name, readBlock(j + 1, 4));
        }
      }
    }
  }
  return named;
}

const catalogs = readCatalogs(readFileSync(workspacePath, 'utf8'));

const packageFiles = [
  ...globSync(join(repoRoot, 'packages/*/package.json')),
  ...globSync(join(repoRoot, 'apps/*/package.json')),
];
if (!packageFiles.length) {
  process.stderr.write(`no workspace packages found under ${repoRoot}\n`);
  process.exit(2);
}

const BUILTINS = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
/**
 * Import specifiers in a source file.
 *
 * The static forms are anchored to the START OF A LINE, which matters more than
 * it looks. A loose `/(?:from|import)\s*['"]([^'"]+)['"]/` also matches import
 * statements written INSIDE string literals — and `src/assets.ts` legitimately
 * contains `"import 'fast-text-encoding'"` as documentation of what the RN
 * entry point must install. The first version of this tool duly reported
 * `fast-text-encoding` as an undeclared dependency of a package that never
 * imports it. A scanner that reads code inside strings invents work.
 */
function importsIn(text) {
  const found = [];
  const patterns = [
    /^\s*import\s+[^'"\n]*from\s*['"]([^'"\n]+)['"]/gm, // import x from 'y'
    /^\s*import\s*['"]([^'"\n]+)['"]/gm, // import 'y'
    /^\s*export\s+[^'"\n]*from\s*['"]([^'"\n]+)['"]/gm, // export … from 'y'
    /\bimport\(\s*['"]([^'"\n]+)['"]/g, // await import('y')
    /\brequire\(\s*['"]([^'"\n]+)['"]/g, // require('y')
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) found.push(match[1]);
  }
  return found;
}

/** `three/webgpu` → `three`; `@types/three/src/x` → `@types/three`. */
const packageOf = (specifier) => {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

const problems = [];
let checkedPackages = 0;
let checkedImports = 0;

for (const file of packageFiles) {
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const dir = dirname(file);
  const label = manifest.name ?? dir;
  checkedPackages += 1;

  const declared = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
    ...manifest.optionalDependencies,
  };

  // ---- check 1: every catalog: reference resolves -------------------------
  for (const [name, range] of Object.entries(declared)) {
    if (typeof range !== 'string' || !range.startsWith('catalog:')) continue;
    const which = range.slice('catalog:'.length) || 'default';
    const catalog = catalogs.get(which);
    if (!catalog) {
      problems.push(`${label}: "${name}": "${range}" — no catalog named '${which}' in pnpm-workspace.yaml`);
    } else if (!catalog.has(name)) {
      problems.push(
        `${label}: "${name}": "${range}" — '${name}' is not in the ` +
          `${which === 'default' ? 'catalog:' : `catalogs.${which}`} block. ` +
          'pnpm install --frozen-lockfile will fail.'
      );
    }
  }

  // ---- check 2: every bare import is declared -----------------------------
  const sources = globSync(join(dir, '**/*.{ts,tsx,mts,mjs,js,jsx}'), {
    exclude: (path) => /node_modules|[/\\]\.types[/\\]|[/\\]\.probe[/\\]|[/\\]dist[/\\]/.test(path),
  });
  const seen = new Set();
  for (const source of sources) {
    const text = readFileSync(source, 'utf8');
    for (const specifier of importsIn(text)) {
      if (specifier.startsWith('.') || specifier.startsWith('/')) continue;
      checkedImports += 1;
      const name = packageOf(specifier);
      // Any `node:`-prefixed specifier is a builtin. `builtinModules` omits the
      // prefix-only ones (`node:test`, `node:sqlite`, …), so testing membership
      // alone reports `node:test` as an undeclared package — which this tool
      // did on its first run.
      if (specifier.startsWith('node:') || BUILTINS.has(specifier) || BUILTINS.has(name)) continue;
      if (name === manifest.name) continue;
      if (declared[name]) continue;
      const key = `${label}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      problems.push(
        `${label}: imports '${specifier}' but does not declare '${name}' — ` +
          'it works only while something else hoists it'
      );
    }
  }
}

process.stdout.write(
  `\nchecked ${checkedPackages} package(s), ${checkedImports} bare import(s), ` +
    `${[...catalogs.values()].reduce((n, c) => n + c.size, 0)} catalog entries\n`
);

if (problems.length) {
  process.stderr.write(`\n${problems.length} problem(s):\n`);
  for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
  process.exit(1);
}
process.stdout.write('  all catalog references resolve; all bare imports are declared\n');

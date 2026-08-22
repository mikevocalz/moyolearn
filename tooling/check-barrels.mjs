#!/usr/bin/env node
// Barrel-completeness check — fails if a module exists but no entry point reaches it.
// An unexported component is invisible to the "search before you build" rule, so it
// gets rebuilt as a duplicate: this check is the mechanical catch for that slop (doc 11 §8).
// SOT: docs/pack/11-architectural-guardrails.md §8 · CLAUDE.md ("packages/ui/index.ts is the component index")
// SOT-KEYWORDS: barrel completeness index orphan export check duplicate-component
// ponytail: walks relative re-export edges only — a bundler-grade resolver is not needed
// to answer "is this file reachable from the package's public API".
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/** Packages to check, with the entry points declared in their package.json `exports`. */
const PACKAGES = ['packages/ui', 'packages/app'];

/** Never required to be exported: stories, tests, config, and build scripts. */
const EXEMPT = /(\.stories\.tsx?|\.test\.tsx?|\.spec\.tsx?|\.config\.(js|mjs|ts)|\.d\.ts)$/;

const SOURCE = /\.(ts|tsx)$/;

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (SOURCE.test(entry) && !EXEMPT.test(entry)) out.push(path);
  }
  return out;
};

/** Extension candidates in Metro/TS resolution order, platform forks included. */
const CANDIDATES = ['', '.ts', '.tsx', '.web.ts', '.web.tsx', '.native.ts', '.native.tsx',
  '/index.ts', '/index.tsx', '/index.web.ts', '/index.web.tsx', '/index.native.ts', '/index.native.tsx'];

const resolveSpecifier = (fromFile, specifier) => {
  const base = join(dirname(fromFile), specifier);
  const hits = [];
  for (const ext of CANDIDATES) {
    const path = base + ext;
    if (existsSync(path) && statSync(path).isFile()) hits.push(path);
  }
  // A bare './screen' anchor also covers its .native/.web siblings — all count as reached.
  return hits;
};

/**
 * Relative `import`/`export ... from './x'` edges, plus bare side-effect
 * `import './x'` — a shim reached only for its side effects is still reached.
 * Bare specifiers leave the package and end the walk.
 */
const RELATIVE_FROM = /(?:^|\n)\s*(?:export|import)\s[\s\S]*?from\s+['"](\.[^'"]+)['"]/g;
const RELATIVE_SIDE_EFFECT = /(?:^|\n)\s*import\s+['"](\.[^'"]+)['"]/g;

const entryPoints = (pkgDir) => {
  const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const found = new Set();
  const collect = (value) => {
    if (typeof value === 'string' && value.startsWith('.')) {
      for (const hit of resolveSpecifier(join(pkgDir, 'package.json'), value)) found.add(hit);
    } else if (value && typeof value === 'object') Object.values(value).forEach(collect);
  };
  collect(manifest.exports ?? {});
  collect(manifest.main);
  collect(manifest.types);
  return [...found];
};

let failures = 0;

for (const pkg of PACKAGES) {
  const pkgDir = join(ROOT, pkg);
  const entries = entryPoints(pkgDir);
  if (entries.length === 0) {
    console.error(`${pkg}: no entry points declared in package.json`);
    failures++;
    continue;
  }

  // Reachability: start at the entry points, follow relative re-export edges.
  const reached = new Set(entries);
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    const source = readFileSync(file, 'utf8');
    for (const pattern of [RELATIVE_FROM, RELATIVE_SIDE_EFFECT]) {
      for (const [, specifier] of source.matchAll(pattern)) {
        for (const target of resolveSpecifier(file, specifier)) {
          if (!reached.has(target)) {
            reached.add(target);
            queue.push(target);
          }
        }
      }
    }
  }

  const orphans = walk(pkgDir).filter((f) => !reached.has(f));
  if (orphans.length) {
    failures += orphans.length;
    console.error(`\n${pkg} — ${orphans.length} module(s) not reachable from any entry point:`);
    for (const orphan of orphans.sort()) console.error(`  ${relative(ROOT, orphan)}`);
  } else {
    console.log(`${pkg} — barrel complete (${reached.size} modules reachable from ${entries.length} entry points)`);
  }
}

if (failures) {
  console.error(
    `\nExport them from the package index, or delete them. An unexported module cannot be found` +
      ` by search, so the next session builds a duplicate instead.`,
  );
  process.exit(1);
}

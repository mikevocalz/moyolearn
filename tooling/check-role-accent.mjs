#!/usr/bin/env node
// Role-accent placement gate (doc 36 §5 · PR-141). The accent is what makes the
// five shells read as five doors on ONE product — and it stays true only if the
// accent never leaves its five slots: active tab/nav indicator underlay, avatar
// ring, login/onboarding hero band, shell header underline, email header band.
// The moment an accent colours body text, a border, or the primary button, it
// starts carrying meaning, collides with the schoolhouse marks (redpen/grade),
// and the "same product, different colour" claim quietly dies.
//
// Mechanism: the tokens are only reachable through `*-role-*` utility classes
// (bg-role-accent, bg-role-guardian-underlay, ...), so placement is greppable.
//   1. text/border-family prefixes on a role token fail EVERYWHERE — those are
//      the doc's "never" list, no allowlist entry can legalise them.
//   2. every other prefix (bg-, ring-, fill-, ...) is legal only in files
//      allowlisted below, each entry naming which §5 slot it implements.
// Bare `role-<name>` scope classes are exempt on purpose: the scope paints
// nothing — it only re-points the generic pair for the subtree (RoleScope.tsx).
//
// Proven red before landing: a `text-`-prefixed role class planted in
// Heading.tsx and a `bg-` one in Button.tsx both failed this gate.
// SOT: docs/pack/36-role-navigation-flows.md §5 · packages/theme/tokens.ts
// SOT-KEYWORDS: role accent allowlist gate check lint five doors shell slots
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP_DIR = /node_modules|\.next|\.turbo|dist|build/;

/**
 * The §5 slots, as files. A new consumer of a role-accent class is a design
 * decision, so it lands here with the slot it implements — anything else is a
 * failure by default. Shell slot files (PR-138..140) join this map as they land.
 */
const ALLOWLIST = new Map([
  ['packages/ui/RoleScope.stories.tsx', 'kit review surface — all five doors on one skeleton'],
]);

/**
 * The doc's "never" list. Text-family and border-family utilities may not touch
 * a role token in ANY file: accents are underlay/ring/band fills, not marks.
 * (`divide`/`outline`/`decoration`/`caret` are borders and text by other names.)
 */
const BANNED_PREFIX = /^(?:text|border|divide|outline|decoration|caret|placeholder)(?:-[a-z]+)*$/;

/** Any utility whose colour segment is a role token, e.g. bg-role-tutor-underlay. */
const ROLE_CLASS = /\b([a-z][a-z-]*?)-role-(?:accent|learner|guardian|tutor|org|district)(?:-underlay)?\b/g;

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIP_DIR.test(full)) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
};

const failures = [];

for (const dir of ['packages', 'apps']) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    // The mint itself: tokens.ts and the css generator legitimately name every
    // role token, and their output is not className usage.
    if (rel.startsWith('packages/theme/')) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const code = line.trim();
      if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return;
      for (const match of code.matchAll(ROLE_CLASS)) {
        const prefix = match[1];
        if (BANNED_PREFIX.test(prefix)) {
          failures.push(
            `${rel}:${i + 1}  ${match[0]}\n    role accents are never text or border colour (doc 36 §5) — ` +
              'use an underlay/ring/band fill in an allowlisted slot, or a schoolhouse mark if this carries meaning.',
          );
        } else if (!ALLOWLIST.has(rel)) {
          failures.push(
            `${rel}:${i + 1}  ${match[0]}\n    file is not an allowlisted role-accent slot. The accent may appear ` +
              'ONLY in: active tab/nav indicator underlay, avatar ring, login/onboarding hero band, shell header ' +
              'underline, email header band — if this file IS one of those, add it to ALLOWLIST in ' +
              'tooling/check-role-accent.mjs with the slot named.',
          );
        }
      }
    });
  }
}

if (failures.length) {
  console.error(`role-accent gate: ${failures.length} violation(s)\n`);
  failures.forEach((f) => console.error(`  ${f}\n`));
  process.exit(1);
}
console.log('role-accent OK — accent classes confined to allowlisted slots, none as text/border/button');

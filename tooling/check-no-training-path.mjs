#!/usr/bin/env node
// Doc 07 §4: "the training/eval pipeline has no read path to the educational
// store. A build-time check fails if one is introduced. 'We can't' beats 'we
// won't' in a deposition."
//
// This is that check. It is currently VACUOUS — no training or eval pipeline
// exists yet — and saying so in the output is the point: a gate that silently
// passes because it is guarding an empty room reads identically to one that is
// working, and the day someone adds `packages/training/` is the day nobody
// remembers this file exists. It prints what it scanned either way.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4
// SOT-KEYWORDS: training pipeline no read path educational store gate deposition eval
// ponytail: a grep with a stated scope beats a dependency-graph walk here — the
// rule is "these directories may not import those packages", which is textual.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/**
 * Anywhere a training or evaluation pipeline would plausibly live. Listed by
 * name rather than detected, so adding one under a new name means adding it
 * here — a reviewer's decision, not an accident.
 */
const TRAINING_ROOTS = [
  'packages/training',
  'packages/evals',
  'packages/eval',
  'packages/fine-tune',
  'tooling/training',
  'tooling/evals',
];

/**
 * The educational store: everything holding a real child's work. `@acme/safety`
 * is on the list because safety events are the one category doc 07 §3 layer 7
 * keeps out of the pedagogical model entirely — a training job reading them
 * would be the worst version of this bug, not an exception to it.
 */
const FORBIDDEN = [
  '@acme/payload',
  '@acme/auth',
  '@acme/safety',
  'features/', // the app's learner-facing surfaces and their data
  'repositories/',
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

const present = TRAINING_ROOTS.filter((rel) => existsSync(join(ROOT, rel)));
const violations = [];
let scanned = 0;

for (const rel of present) {
  for (const file of walk(join(ROOT, rel))) {
    scanned += 1;
    const source = readFileSync(file, 'utf8');
    for (const forbidden of FORBIDDEN) {
      // Import specifiers only: a mention in a comment explaining the rule is
      // not a read path, and failing on prose would get the rule commented out.
      const pattern = new RegExp(
        `(?:from|import|require\\()\\s*['"\`][^'"\`]*${forbidden.replace(/[/\\]/g, '\\$&')}`,
      );
      if (pattern.test(source)) {
        violations.push(`${relative(ROOT, file)} → ${forbidden}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('\ncheck-no-training-path — a training/eval path can read the educational store.\n');
  console.error(
    'Doc 07 §4: child conversations never enter any training pipeline, and the architecture is\n' +
      'what enforces it. Route through de-identified aggregates instead, or this stops being a\n' +
      'thing we CAN say.\n',
  );
  for (const violation of violations) console.error(`  ${violation}`);
  console.error('');
  process.exit(1);
}

console.log(
  present.length === 0
    ? `no-training-path OK — no training/eval pipeline exists (watching ${TRAINING_ROOTS.length} paths)`
    : `no-training-path OK — ${scanned} files across ${present.length} pipeline path(s) read nothing from the educational store`,
);

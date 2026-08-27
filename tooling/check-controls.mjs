// Interactive controls share one corner radius.
//
// This exists because a `rounded-md` button sat next to a `rounded-card` input
// in the tutor composer and read as two components from two different systems
// in the same row. Nobody notices a 4px radius delta in review; a build does.
// Doc 08 §2: a control's shape is structure, and structure is consistent or it
// is noise.
//
// The rule: any file under packages/ui that renders a control may set a corner
// radius only via `rounded-control` (or `rounded-full`, which is a deliberate
// pill and a different shape decision). Containers — cards, sheets, panels —
// are unaffected and keep their own radii.
// SOT: CLAUDE.md §UI · docs/pack/08-visual-hierarchy-spacing-spec.md §2
// SOT-KEYWORDS: check controls radius gate lint consistency button input composer

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const uiDir = join(root, 'packages/ui');

/** Files whose whole job is an interactive control. */
/*
  Controls, plus the surfaces that sit flush against them.

  `TutorThread` is not a control, and it is here anyway: its bubbles stack
  directly above the composer, so a bubble at `card` (10px) over a Send key at
  `control` (6px) produces exactly the two-systems-in-one-column effect this
  gate exists to prevent. Proximity is what makes a radius mismatch visible, not
  category — a Card elsewhere on a page has no neighbour to disagree with.
*/
const CONTROLS = [
  'Button.tsx',
  'Composer.tsx',
  'TutorThread.tsx',
  'Input.tsx',
  'Textarea.tsx',
  'Select.tsx',
  'Checkbox.tsx',
  'Switch.tsx',
  'SegmentedControl.tsx',
];

const ALLOWED = new Set(['rounded-control', 'rounded-full', 'rounded-none']);
const RADIUS = /\brounded-(?!control\b|full\b|none\b)[a-z0-9-]+/g;

/**
 * Blank out comments while keeping line numbers intact.
 *
 * The old check skipped lines STARTING with `//`, `*` or `/*`, which misses the
 * body of a free-form block comment — a continuation line beginning with a
 * backtick or a word looks like code. It flagged a comment that existed to
 * explain why `rounded-card` is NOT used, which is the worst kind of false
 * positive: it punishes the person who documented the decision.
 *
 * Newlines are preserved so the reported line number still points at the real
 * line.
 */
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));

const present = new Set(readdirSync(uiDir));
const problems = [];

for (const file of CONTROLS) {
  if (!present.has(file)) continue;
  const raw = readFileSync(join(uiDir, file), 'utf8').split('\n');
  /*
    Two views of the same line. Radii are matched against the STRIPPED source so
    a comment explaining the rule is not read as breaking it — but the
    `radius-exempt:` marker is looked up in the RAW line, because that marker
    deliberately lives inside a block comment embedded in a className. Stripping
    first erased the exemptions along with the prose.
  */
  stripComments(raw.join('\n')).split('\n').forEach((line, i) => {
    // A nested part (a switch thumb, a selected pill) is inside another control
    // and must NOT share its radius — matching radii fill the parent's corners.
    // Exempting one is a design decision, so it has to be stated in the line.
    if (raw[i]?.includes('radius-exempt:')) return;
    for (const hit of line.match(RADIUS) ?? []) {
      problems.push(`  packages/ui/${file}:${i + 1}  ${hit}`);
    }
  });
}

if (problems.length > 0) {
  console.error(
    `\ncheck-controls — ${problems.length} control(s) set a radius outside the shared token.\n\n` +
      `Interactive controls must use \`rounded-control\` so a button and the input beside it\n` +
      `are the same shape. Allowed: ${[...ALLOWED].join(', ')}.\n\n` +
      problems.join('\n') +
      '\n',
  );
  process.exit(1);
}

console.log(`controls OK — ${CONTROLS.filter((f) => present.has(f)).length} control(s) share one radius`);

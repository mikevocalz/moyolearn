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
const CONTROLS = [
  'Button.tsx',
  'Composer.tsx',
  'Input.tsx',
  'Textarea.tsx',
  'Select.tsx',
  'Checkbox.tsx',
  'Switch.tsx',
  'SegmentedControl.tsx',
];

const ALLOWED = new Set(['rounded-control', 'rounded-full', 'rounded-none']);
const RADIUS = /\brounded-(?!control\b|full\b|none\b)[a-z0-9-]+/g;

const present = new Set(readdirSync(uiDir));
const problems = [];

for (const file of CONTROLS) {
  if (!present.has(file)) continue;
  const source = readFileSync(join(uiDir, file), 'utf8');
  source.split('\n').forEach((line, i) => {
    // Comments explain the rule; they are not the rule being broken.
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    // A nested part (a switch thumb, a selected pill) is inside another control
    // and must NOT share its radius — matching radii fill the parent's corners.
    // Exempting one is a design decision, so it has to be stated in the line.
    if (line.includes('radius-exempt:')) return;
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

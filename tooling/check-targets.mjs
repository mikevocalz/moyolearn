#!/usr/bin/env node
// Touch-target gate: every interactive size variant must declare a min-height
// from an age-band target token, and every target token must clear the WCAG 2.2
// AA floor. Doc 08 §4.1 asks for "a CI assertion that every size × dial meets
// its target token"; doc 08 §2.4 supplies the bands.
//
// Static, not rendered: the failure this prevents is someone adding a size (or
// tightening the type ramp) so a control's height quietly stops clearing 44 —
// which a screenshot review would not catch and a child's thumb would.
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §2.4, §4.1
// SOT-KEYWORDS: target size touch a11y wcag check gate age-band button
// ponytail: reads the source for the class name rather than booting a renderer —
// the question is "did the variant declare a target", which is textual.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { targets } from '../packages/theme/tokens.ts';

const ROOT = join(import.meta.dirname, '..');
const REM = 16;
const px = (value) => (value.endsWith('rem') ? parseFloat(value) * REM : parseFloat(value));

/** WCAG 2.2 AA (2.5.8) minimum, and the NN/g-derived bands above it. */
const WCAG_AA_FLOOR = 24;

/**
 * Components whose size variants must each declare a target min-height.
 * `interactive` names the tv() variant group that produces tappable sizes.
 */
const COMPONENTS = [{ file: 'packages/ui/Button.tsx', variant: 'size' }];

let failures = 0;

// 1. Every declared band clears the WCAG floor.
for (const [band, value] of Object.entries(targets)) {
  const size = px(value);
  if (size < WCAG_AA_FLOOR) {
    console.error(`target-${band} is ${size}px — below the WCAG 2.2 AA floor of ${WCAG_AA_FLOOR}px`);
    failures++;
  }
}

// 2. Every size variant declares one of them.
const TARGET_CLASS = /min-h-target-([a-z]+)/;

for (const { file, variant } of COMPONENTS) {
  const source = readFileSync(join(ROOT, file), 'utf8');
  // Slice the variant group: `size: { ... },` up to the line that closes it.
  const start = source.indexOf(`${variant}: {`);
  if (start === -1) {
    console.error(`${file}: no \`${variant}\` variant group found — did the component change shape?`);
    failures++;
    continue;
  }
  let depth = 0;
  let end = start;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = source.slice(start, end);

  // Each `name: { root: '…' }` entry inside the group is one size.
  for (const [, name, classes] of block.matchAll(/(\w+):\s*\{\s*root:\s*'([^']*)'/g)) {
    const hit = classes.match(TARGET_CLASS);
    if (!hit) {
      console.error(
        `${file}: size "${name}" declares no min-h-target-* class. Padding is not a target — ` +
          'a tightened type ramp shrinks it silently.',
      );
      failures++;
      continue;
    }
    const band = hit[1];
    if (!(band in targets)) {
      console.error(`${file}: size "${name}" references unknown band "target-${band}".`);
      failures++;
      continue;
    }
    const size = px(targets[band]);
    if (size < WCAG_AA_FLOOR) {
      console.error(`${file}: size "${name}" uses target-${band} (${size}px), below the AA floor.`);
      failures++;
    }
  }
}

if (failures) {
  console.error(`\n${failures} touch-target failure(s).`);
  process.exit(1);
}
console.log(
  `targets OK — ${Object.keys(targets).length} bands clear ${WCAG_AA_FLOOR}px; ` +
    `every size variant in ${COMPONENTS.length} component(s) declares one`,
);

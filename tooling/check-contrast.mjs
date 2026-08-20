#!/usr/bin/env node
// WCAG contrast gate over every foreground/background token pair, both themes.
// Doc 02 §7.2: "automated WCAG contrast check over every fg/bg token pair;
// failing pair fails the build." A palette that only looks accessible is a
// child-outcome problem, so this runs in `pnpm lint`, not in review.
// SOT: docs/pack/02-adaptive-screens-design-spec.md §7.2 · packages/theme/tokens.ts
// SOT-KEYWORDS: contrast wcag accessibility a11y tokens colour check gate
// ponytail: the maths is eight lines of sRGB — a colour library would be a
// dependency to avoid writing them.
import { semantic } from '../packages/theme/tokens.ts';

/** WCAG 2.1 relative luminance. Accepts #rgb, #rrggbb, and rgba() over a known backdrop. */
const channels = (colour) => {
  const hex = colour.trim();
  if (hex.startsWith('#')) {
    const h = hex.slice(1);
    const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).concat(1);
  }
  const m = hex.match(/rgba?\(([^)]+)\)/i);
  if (!m) return null;
  const parts = m[1].split(',').map((n) => parseFloat(n));
  return [parts[0] / 255, parts[1] / 255, parts[2] / 255, parts.length > 3 ? parts[3] : 1];
};

/** Composite a possibly-translucent colour over its backdrop before measuring. */
const flatten = (fg, bg) => {
  const f = channels(fg);
  const b = channels(bg);
  if (!f || !b) return null;
  const a = f[3];
  return [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a));
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (fg, bg) => {
  const f = flatten(fg, bg);
  const b = channels(bg);
  if (!f || !b) return null;
  const [l1, l2] = [luminance(f), luminance(b.slice(0, 3))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

/**
 * Declared pairs. `min` is the bar this pair must clear:
 *   4.5 — WCAG AA body text
 *   3.0 — AA large text (>=18.66px bold / 24px) and UI component boundaries (1.4.11)
 * Pairs are declared rather than derived from a cartesian product: most token
 * combinations are never rendered together, and a check that reports impossible
 * failures gets muted, which is worse than no check.
 */
const PAIRS = [
  // body text on every surface it can land on
  ['text', 'surface', 4.5],
  ['text', 'surface-raised', 4.5],
  ['text', 'surface-sunken', 4.5],
  ['text-muted', 'surface', 4.5],
  ['text-muted', 'surface-raised', 4.5],
  ['text-muted', 'surface-sunken', 4.5],
  ['text-inverse', 'text', 4.5],
  // filled controls carry their own foreground
  ['on-primary', 'primary', 4.5],
  ['on-primary', 'primary-pressed', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-accent', 'accent-pressed', 4.5],
  ['on-danger', 'danger', 4.5],
  ['on-highlighter', 'highlighter', 4.5],
  // schoolhouse marks are drawn ON paper, so each must survive both surfaces
  ['ballpoint', 'surface', 4.5],
  ['ballpoint', 'surface-raised', 4.5],
  ['redpen', 'surface', 4.5],
  ['redpen', 'surface-raised', 4.5],
  ['grade', 'surface', 4.5],
  ['grade', 'surface-raised', 4.5],
  // non-text boundaries: WCAG 1.4.11 asks 3:1 of anything carrying meaning
  ['border', 'surface', 3],
  ['border-strong', 'surface', 3],
  ['border-soft', 'surface', 3],
  ['focus', 'surface', 3],
  ['danger', 'surface', 3],
];

/**
 * `border-faint` is the Cool dial's 10% shadow ink. It is deliberately invisible
 * and carries no meaning on its own, so it is exempt — named here so the
 * exemption is a decision on the record rather than an oversight.
 */
const EXEMPT = new Set(['border-faint']);

const THEMES = ['light', 'dark'];
let failures = 0;
let checked = 0;

for (const theme of THEMES) {
  const rows = [];
  for (const [fgName, bgName, min] of PAIRS) {
    if (EXEMPT.has(fgName) || EXEMPT.has(bgName)) continue;
    const fg = semantic[fgName]?.[theme];
    const bg = semantic[bgName]?.[theme];
    if (!fg || !bg) {
      console.error(`unknown token in pair: ${fgName} on ${bgName}`);
      failures++;
      continue;
    }
    const r = ratio(fg, bg);
    if (r === null) {
      console.error(`could not parse colour for ${fgName} on ${bgName} (${fg} / ${bg})`);
      failures++;
      continue;
    }
    checked++;
    if (r < min) {
      failures++;
      rows.push(`  FAIL  ${fgName} on ${bgName}  ${r.toFixed(2)}:1  (needs ${min}:1)`);
    }
  }
  if (rows.length) {
    console.error(`\n${theme}:`);
    rows.forEach((r) => console.error(r));
  }
}

if (failures) {
  console.error(
    `\n${failures} contrast failure(s). Fix the value in packages/theme/tokens.ts — ` +
      'not the threshold, and not by hoping the surface underneath is lighter in practice.',
  );
  process.exit(1);
}
console.log(`contrast OK — ${checked} token pairs across ${THEMES.join(' + ')} meet WCAG AA`);

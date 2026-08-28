#!/usr/bin/env node
// Contract between the spec's token NAMES and the classes Tailwind actually
// generates. Three separate bugs this repo has already had were the same shape:
// a token emitted correctly, a class written correctly per the spec, and no
// utility in between — so the class silently did nothing and only a screenshot
// showed it.
//
// Tailwind v4 builds a utility as <property-prefix>-<token suffix>, where the
// suffix is whatever follows the namespace in the custom property. So
// `--spacing-gap-stack` yields `gap-gap-stack`, NOT `gap-stack`, and
// `--text-title` must exist in @theme (not only inside a .dial-* scope) or
// `text-title` is never generated at all.
// SOT: docs/pack/08-visual-hierarchy-spacing-spec.md §2.1, §2.4, §3.1
// SOT-KEYWORDS: utilities tailwind tokens inert class check gate spacing ramp
// ponytail: asserts a fixed list rather than parsing every className in the
// repo — a scanner needs an allowlist of stock Tailwind names, and a check that
// cries wolf gets muted, which is worse than no check.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const css = readFileSync(join(ROOT, 'packages/theme/theme.css'), 'utf8');

/**
 * Only @theme counts. A variable declared solely in a .dial-* scope re-points a
 * utility that already exists; it cannot bring one into being.
 *
 * EVERY @theme block, not just the first. `build-css.mjs` emits a second one,
 * `@theme static`, for the marketing site's colours: Tailwind v4 prunes a theme
 * variable nothing "uses", and the globe chapter resolves its fills through
 * `getComputedStyle` at runtime, which no scanner can see. `static` is what
 * stops those colours being pruned. Reading only `@theme {` made this gate
 * report fourteen live utilities as inert — a check that is wrong about the
 * thing it exists to check is worse than no check.
 */
const themeBlocks = [...css.matchAll(/@theme[^{]*\{([\s\S]*?)\n\}/g)].map((m) => m[1]);
const declared = new Set(
  themeBlocks.flatMap((block) => [...block.matchAll(/--([a-z0-9-]+):/g)].map((m) => m[1])),
);

/**
 * The classes the spec tells people to write, and the custom property each one
 * requires. Adding a tier or ramp step means adding it here too — that is the
 * point: the doc's vocabulary and the emitted tokens stay provably in step.
 */
const CONTRACT = [
  // doc 08 §2.1 — spacing tiers
  ['p-inset-tight', 'spacing-inset-tight'],
  ['p-inset', 'spacing-inset'],
  ['p-inset-roomy', 'spacing-inset-roomy'],
  ['gap-element', 'spacing-element'],
  ['gap-stack', 'spacing-stack'],
  ['gap-group', 'spacing-group'],
  ['gap-section', 'spacing-section'],
  // doc 08 §2.4 — age-band targets
  ['min-h-target-floor', 'spacing-target-floor'],
  ['min-h-target-adult', 'spacing-target-adult'],
  ['min-h-target-teen', 'spacing-target-teen'],
  ['min-h-target-child', 'spacing-target-child'],
  ['min-h-target-young', 'spacing-target-young'],
  // doc 08 §3.1 — the UI ramp
  ['text-title-lg', 'text-title-lg'],
  ['text-title', 'text-title'],
  ['text-body-lg', 'text-body-lg'],
  ['text-body', 'text-body'],
  ['text-label', 'text-label'],
  ['text-caption', 'text-caption'],
  ['text-data', 'text-data'],
  ['text-data-lg', 'text-data-lg'],
  // doc 02 §5.3 — dial chrome the scope re-points
  ['rounded-card', 'radius-card'],
  ['shadow-card', 'shadow-card'],
  // doc 36 §5 / PR-141 — the role-accent pair the .role-* scopes re-point.
  // The generic name must exist in @theme or every slot class is inert.
  ['bg-role-accent', 'color-role-accent'],
  ['bg-role-accent-underlay', 'color-role-accent-underlay'],
  // PR-0 — schoolhouse aliases
  ['bg-highlighter', 'color-highlighter'],
  ['text-on-highlighter', 'color-on-highlighter'],
  ['text-ballpoint', 'color-ballpoint'],
  ['text-redpen', 'color-redpen'],
  ['text-grade', 'color-grade'],
  ['font-mono', 'font-mono'],
  /*
    Marketing site layer (site spec §5.1/§5.2). Web output only, so this is also
    the check that catches the site tokens being emitted into the wrong file:
    they are read out of theme.css, and moving them under the shared emitter
    would not fail here, but dropping them would.

    `border-moyo-*` is deliberately ABSENT. Tailwind has no border-width theme
    namespace, so those are real classes in the base layer rather than utilities
    — asserting a @theme variable for them would assert the wrong thing.
  */
  ['bg-moyo-paper', 'color-moyo-paper'],
  ['bg-moyo-paper-raised', 'color-moyo-paper-raised'],
  ['bg-moyo-paper-sunken', 'color-moyo-paper-sunken'],
  ['text-moyo-ink', 'color-moyo-ink'],
  ['text-moyo-ink-muted', 'color-moyo-ink-muted'],
  ['border-moyo-outline', 'color-moyo-outline'],
  ['bg-moyo-primary', 'color-moyo-primary'],
  ['text-moyo-secondary', 'color-moyo-secondary'],
  ['bg-moyo-heart', 'color-moyo-heart'],
  ['bg-moyo-sun', 'color-moyo-sun'],
  ['bg-moyo-earth', 'color-moyo-earth'],
  ['bg-moyo-leaf', 'color-moyo-leaf'],
  ['text-moyo-on-primary', 'color-moyo-on-primary'],
  ['text-moyo-on-sun', 'color-moyo-on-sun'],
  ['font-moyo-display', 'font-moyo-display'],
  ['font-moyo-text', 'font-moyo-text'],
  ['font-moyo-serif', 'font-moyo-serif'],
  ['font-moyo-hand', 'font-moyo-hand'],
  ['text-site-hero', 'text-site-hero'],
  ['text-site-chapter', 'text-site-chapter'],
  ['text-site-title', 'text-site-title'],
  ['text-site-subtitle', 'text-site-subtitle'],
  ['text-site-lead', 'text-site-lead'],
  ['text-site-body', 'text-site-body'],
  ['text-site-label', 'text-site-label'],
  ['text-site-quote', 'text-site-quote'],
  ['text-site-note', 'text-site-note'],
  ['shadow-moyo-1', 'shadow-moyo-1'],
  ['shadow-moyo-2', 'shadow-moyo-2'],
  ['shadow-moyo-3', 'shadow-moyo-3'],
  ['shadow-moyo-4', 'shadow-moyo-4'],
  ['rounded-moyo-square', 'radius-moyo-square'],
  ['rounded-moyo-card', 'radius-moyo-card'],
];

let failures = 0;
for (const [utility, property] of CONTRACT) {
  if (!declared.has(property)) {
    console.error(
      `\`${utility}\` is inert — it needs \`--${property}\` in @theme, which is not declared.`,
    );
    failures++;
  }
}

/**
 * The mistake that produced the bug, caught directly: a spacing token whose own
 * name starts with a property prefix doubles it up in the generated class.
 */
for (const name of declared) {
  const doubled = /^spacing-(gap|p|m|w|h)-/.exec(name);
  if (doubled) {
    console.error(
      `--${name} generates \`${doubled[1]}-${name.replace('spacing-', '')}\` — the property ` +
        `prefix is inside the token name. Name tiers for the ROLE and let the property add it.`,
    );
    failures++;
  }
}

if (failures) {
  console.error(`\n${failures} inert-utility problem(s). Fix packages/theme/tokens.ts.`);
  process.exit(1);
}
console.log(`utilities OK — ${CONTRACT.length} spec-named classes all resolve to @theme tokens`);

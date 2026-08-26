#!/usr/bin/env node
// Classes that LOOK like they use our tokens but do nothing at runtime.
//
// `check-utilities.mjs` proves a utility is GENERATED. It cannot prove the class
// survives to the screen, and three separate bugs shipped this way — each one
// invisible in review, because the class name reads correctly:
//
//   z-nav / z-overlay   Tailwind builds z-index from bare numbers, not from a
//                       `--z-*` namespace. Both were inert, so an open drawer
//                       rendered underneath its own scrim.
//   h-dvh on a kit View react-native-css compiles kit components to inline
//                       styles and drops `dvh`. The shell sized to its content
//                       (1890px in a 773px window) and the sidebar scrolled
//                       with the page.
//   text-title-lg beside a colour
//                       tailwind-merge classifies unknown `text-*` as a COLOUR,
//                       so one of the pair was deleted and the whole type ramp
//                       silently collapsed to inherited 14px.
//
// Three rules, each tied to a bug that actually shipped. Deliberately NOT a
// general className scanner: check-utilities.mjs already explains why one would
// need an allowlist of every stock Tailwind name, and a check that cries wolf
// gets muted.
// SOT: packages/theme/tokens.ts · packages/ui/tv.ts
// SOT-KEYWORDS: check gate inert classes runtime z-index dvh tailwind-merge ramp
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const SKIP_DIR = /node_modules|\.next|\.turbo|dist|build/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIP_DIR.test(full)) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

const failures = [];
const report = (file, line, msg) =>
  failures.push(`${relative(ROOT, file)}:${line}\n    ${msg}`);

// ---- 1. z-<word> is always inert ------------------------------------------
// Tailwind v4 generates z-index from bare numbers (`z-50`) and the keywords
// `z-auto`. There is no `--z-*` theme namespace, so `z-nav` produces no CSS.
const Z_TOKENISH = /\bz-(?!auto\b|\[)([a-z][a-z-]*)\b/g;

// ---- 2. viewport units inside RNW-rendered packages ------------------------
// Fine on a real DOM element in apps/web/app; dropped on anything the kit
// renders, because those go through react-native-css.
const VIEWPORT_UNIT = /\b(?:min-|max-)?[whwb]-(?:d|s|l)v(?:h|w)\b/g;

for (const dir of ['packages/ui', 'packages/app']) {
  for (const file of walk(join(ROOT, dir))) {
    const src = readFileSync(file, 'utf8');
    /*
      A real comment state machine, not a per-line heuristic. The files that
      explain these bugs describe them in prose — "`h-dvh` here silently did
      nothing" — and a continuation line inside a block comment does not start
      with `*`, so the first version of this gate flagged its own documentation.
      A gate that fires on the comment warning you about the bug is a gate
      someone deletes.
    */
    let inBlock = false;
    src.split('\n').forEach((raw, i) => {
      let text = raw;
      if (inBlock) {
        const close = text.indexOf('*/');
        if (close === -1) return;
        text = text.slice(close + 2);
        inBlock = false;
      }
      const open = text.indexOf('/*');
      if (open !== -1) {
        const close = text.indexOf('*/', open + 2);
        if (close === -1) {
          inBlock = true;
          text = text.slice(0, open);
        } else {
          text = text.slice(0, open) + text.slice(close + 2);
        }
      }
      const lineComment = text.indexOf('//');
      if (lineComment !== -1) text = text.slice(0, lineComment);
      if (!text.trim()) return;

      for (const m of text.matchAll(Z_TOKENISH)) {
        report(
          file,
          i + 1,
          `\`z-${m[1]}\` generates no CSS — Tailwind builds z-index from bare numbers. Use z-40 / z-50.`,
        );
      }
      for (const m of text.matchAll(VIEWPORT_UNIT)) {
        report(
          file,
          i + 1,
          `\`${m[0]}\` is dropped by react-native-css on kit components. Size against a real DOM parent and use h-full here.`,
        );
      }
    });
  }
}

// ---- 3. the tailwind-merge font-size list must cover the whole ramp --------
const { uiRamp, typeScale } = await import('../packages/theme/tokens.ts');
const tvSrc = readFileSync(join(ROOT, 'packages/ui/tv.ts'), 'utf8');
const registered = new Set(
  [...(tvSrc.match(/RAMP_FONT_SIZES = \[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
    (m) => m[1],
  ),
);

for (const step of [...Object.keys(uiRamp), ...Object.keys(typeScale)]) {
  if (!registered.has(step)) {
    failures.push(
      `packages/ui/tv.ts\n    \`text-${step}\` is missing from RAMP_FONT_SIZES — tailwind-merge will read it as a\n    COLOUR and delete it whenever the same element also sets a text colour.`,
    );
  }
}

if (failures.length) {
  console.error(`\ncheck-runtime-classes — ${failures.length} class(es) that do nothing at runtime.\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log('check-runtime-classes — no inert classes found.');

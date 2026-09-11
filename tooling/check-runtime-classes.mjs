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
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
/*
  Native build output is not source. `ios/Pods` alone is tens of thousands of
  files with no `.tsx` among them, and it carries symlinks into frameworks that
  a machine without a matching `pod install` does not have — which is how this
  walk used to die on a `stat` of a Sentry xcframework instead of reporting a
  clean run.
*/
const SKIP_DIR = /node_modules|\.next|\.turbo|\.expo|\.gradle|dist|build|ios\/Pods|ios\/DerivedData/;

/*
  `withFileTypes` answers "directory?" from the entry the OS already returned,
  so nothing here follows a symlink. A plain `statSync` does follow one, and a
  dangling link then throws ENOENT and takes the whole gate down.
*/
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (SKIP_DIR.test(full)) continue;
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && /\.tsx?$/.test(full)) out.push(full);
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

// ---- 2b. a colour utility naming a token that is never emitted -------------
/*
  `text-inverse` shipped and rendered NOTHING. The token is called
  `text-inverse`, so Tailwind's colour prefix stacks on top of it and the
  utility is `text-text-inverse`; written short it names a colour `inverse`,
  which no `--color-*` variable defines, so no declaration is emitted at all.
  The icon on the whiteboard's selected key went invisible on its own pale fill.

  Nothing caught it. This gate only knew about `z-*` and viewport units, and
  the utilities check reads a fixed spec list rather than every class in the
  source. A colour that resolves to no variable is the same defect class as an
  inert `z-nav` — it type-checks, it lints, and it draws nothing.
*/
/*
  `text-` and `bg-` ONLY, and that restraint is the point. The first version
  included `shadow-`, `ring-`, `border-` and the rest, and reported 33 failures
  of which the `shadow-*` ones were wrong: Tailwind gives box-shadow its own
  `--shadow-*` namespace, so `shadow-raised` resolves to `--shadow-raised` and
  is perfectly live. A gate that cries wolf on a third of its output is a gate
  someone turns off. These two prefixes read `--color-*` and nothing else.
*/
// The lookbehind is load bearing: `\b` alone matches the `text-muted` INSIDE
// `border-text-muted`, which is a perfectly good utility, and the gate reported
// it as inert. A hyphen before the prefix means this is the tail of a longer
// class, not the start of one.
const COLOUR_UTILITY = /(?<![\w-])(?:text|bg)-(?!\[)([a-z][a-z0-9-]*)\b/g;
const emittedColours = new Set();
for (const css of ['packages/theme/theme.css', 'packages/theme/theme-native.css']) {
  const text = readFileSync(join(ROOT, css), 'utf8');
  for (const m of text.matchAll(/--color-([a-z0-9-]+)\s*:/g)) emittedColours.add(m[1]);
}
if (emittedColours.size === 0) {
  failures.push('parsed zero --color-* variables — the theme CSS moved and this check is blind');
}
/*
  Tailwind's own scale words and the utilities that share these prefixes without
  naming a colour. Listed rather than inferred: a bare allowlist is auditable,
  where a clever regex that tries to tell `border-2` from `border-strong` is the
  thing that breaks silently on the next utility someone adds.
*/
const NOT_A_COLOUR = new Set([
  'transparent', 'current', 'inherit', 'black', 'white', 'none', 'auto',
  'solid', 'dashed', 'dotted', 'double', 'hidden', 'clip', 'ellipsis', 'wrap',
  'nowrap', 'balance', 'pretty', 'left', 'center', 'right', 'justify', 'start', 'end',
  'top', 'bottom', 'middle', 'baseline', 'sub', 'super', 'x', 'y', 'b', 't', 'l', 'r', 'e', 's',
  'sm', 'md', 'lg', 'xl', 'full', 'card', 'control', 'inset', 'offset',
]);

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
      for (const m of text.matchAll(COLOUR_UTILITY)) {
        const name = m[1];
        if (NOT_A_COLOUR.has(name) || /^\d/.test(name) || emittedColours.has(name)) continue;
        // Only flag a name that LOOKS like one of ours — a token we define
        // under another prefix. Anything else is a utility this list does not
        // model, and guessing about it would make the gate noise.
        const looksLikeOurs = [...emittedColours].some(
          (c) => c.endsWith(`-${name}`) || c === `text-${name}` || c === `surface-${name}`,
        );
        if (!looksLikeOurs) continue;
        report(
          file,
          i + 1,
          `\`${m[0]}\` resolves to no --color-${name}, so it emits nothing. Did you mean \`${m[0].split('-')[0]}-${[...emittedColours].find((c) => c.endsWith(`-${name}`))}\`?`,
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
const { uiRamp, typeScale, siteTypeScale } = await import('../packages/theme/tokens.ts');
const tvSrc = readFileSync(join(ROOT, 'packages/ui/tv.ts'), 'utf8');
const registered = new Set(
  [...(tvSrc.match(/RAMP_FONT_SIZES = \[([\s\S]*?)\]/)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
    (m) => m[1],
  ),
);

for (const step of [
  ...Object.keys(uiRamp),
  ...Object.keys(typeScale),
  ...Object.keys(siteTypeScale),
]) {
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

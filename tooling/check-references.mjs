#!/usr/bin/env node
// Reference gate: doc 09 §7 makes pulling 3–5 real-app Mobbin references a
// STANDING RULE before building any screen, and says "every brief's Research
// line gains a `Mobbin:` entry citing the reference URLs used". A standing rule
// nobody can forget is a check; a standing rule in prose is a suggestion.
//
// So: every screen-level surface and every kit component must carry a
// `Mobbin:` line in its header comment naming the references its STRUCTURE came
// from. Style is locked by docs 02/08 and is explicitly not what a reference
// supplies — the citation records where the layout bones came from, which is
// the thing that is otherwise unauditable six months later.
// SOT: docs/pack/09-screens-first-build-order.md §7
// SOT-KEYWORDS: mobbin reference gate screens components research citation
// ponytail: textual — the question is "did this surface cite its references",
// which lives in the header, not in a render.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const HEADER_LINES = 40;

// Where a "surface" lives: feature screens and the shared kit.
const ROOTS = ['packages/app/features', 'packages/ui'];

// Not surfaces: tests, stories, types, platform forks (the base file carries the
// citation), barrels, and machinery with no visual design to reference.
//
// `screen.tsx` is on that list for the same reason the forks are, one level up:
// in this codebase it is always a TS resolution anchor that re-exports
// `screen.web`, and the design lives in the `*-content.tsx` it renders. Asking
// an anchor to cite references would put the citation on the one file nobody
// reads when they change how a screen looks.
const SKIP =
  /\.(test|spec|stories|types)\.tsx?$|\.(web|native|ios|android)\.tsx?$|(^|\/)(index|store|steps|keys|screen)\.tsx?$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(entry) && !SKIP.test(full) && !isHeadless(full)) out.push(full);
  }
  return out;
}

// A ratchet, not a cliff (doc 20's CI-ratchet idiom): 119 surfaces predate this
// gate, and blocking every one of them behind a Mobbin pull would just get the
// gate switched off. Baselined files are allowed to lack a citation; ANY new or
// renamed surface must cite. The baseline may only shrink — citing a baselined
// file and leaving it listed is itself a failure, so the list cannot rot.
/*
  A component that renders nothing is not a surface.

  Providers, task registrars and store bridges live in `.tsx` because they use
  hooks, not because they have a design. Asking them for Mobbin references
  produces invented citations — a reference to a screen the file does not draw —
  and that is worse than no citation, because the next reader trusts it.

  Detected by what the file DOES (returns null and paints nothing) rather than
  by a name convention, so it cannot be gamed by calling something a provider.
*/
const isHeadless = (file) => {
  const src = readFileSync(file, 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  /*
    No JSX anywhere means the file draws nothing, whatever it is called. This is
    the SKIP list's `screen.tsx` anchor rule, held behaviourally: a feature
    folder with two screens names its second anchor `foo-screen.tsx`, and a
    name-based skip missed it — demanding a citation from a pure re-export puts
    it on the one file nobody reads when they change how the screen looks.
  */
  // A file that returns null on one branch and renders JSX on another is
  // still a surface — only a file with no JSX at all escapes.
  return !/<[A-Z][A-Za-z]*[\s/>]/.test(code);
};

const BASELINE = join(ROOT, 'tooling/references-baseline.json');
const baseline = new Set(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : []);

const missing = [];
const nowCited = [];
let checked = 0;

for (const rel of ROOTS) {
  const dir = join(ROOT, rel);
  for (const file of walk(dir)) {
    const header = readFileSync(file, 'utf8').split('\n').slice(0, HEADER_LINES).join('\n');
    checked += 1;
    const rel_ = relative(ROOT, file);
    const cited = /Mobbin:/.test(header);
    if (!cited && !baseline.has(rel_)) missing.push(rel_);
    if (cited && baseline.has(rel_)) nowCited.push(rel_);
  }
}

if (process.argv.includes('--write-baseline')) {
  writeFileSync(BASELINE, `${JSON.stringify(missing.sort(), null, 2)}\n`);
  console.log(`check-references — baselined ${missing.length} pre-existing surfaces`);
  process.exit(0);
}

if (nowCited.length > 0) {
  console.error(
    `\ncheck-references — ${nowCited.length} baselined surfaces now cite references.\n` +
      `Remove them from tooling/references-baseline.json; the baseline only shrinks.\n`,
  );
  for (const file of nowCited) console.error(`  ${file}`);
  console.error('');
  process.exit(1);
}

if (missing.length > 0) {
  console.error(
    `\ncheck-references — ${missing.length} of ${checked} surfaces cite no Mobbin reference.\n\n` +
      `Doc 09 §7: pull 3–5 real-app references BEFORE building, then record them in the\n` +
      `header as a "Mobbin:" line with the URLs. Structure only — never style.\n\n` +
      `  // Mobbin: <url> (what the structure gave us) · <url> (…)\n`,
  );
  for (const file of missing) console.error(`  ${file}`);
  console.error('');
  process.exit(1);
}

console.log(
  `check-references — ${checked - baseline.size} surfaces cite their references, ` +
    `${baseline.size} baselined (doc 09 §7 debt, shrink me)`,
);

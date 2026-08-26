#!/usr/bin/env node
// Measures the shared-UI surface and how far call sites have drifted from it.
//
// This exists because the numbers in docs/design/ui-*.md are only worth reading
// if anyone can regenerate them. Run it before trusting a figure in those docs;
// if it disagrees with them, the docs are stale, not this.
//
// The exclusions are load-bearing and are the reason this is a script rather
// than a grep someone retypes. A recursive grep over `packages/app` descends
// into `packages/app/node_modules` and reports React Native's own typings as
// application code — the first run of this analysis claimed 30 FlatList
// violations that way, when the true count is 0.
//
// Usage: pnpm ui:sweep [--json]
// SOT: docs/design/ui-drift-report.md · docs/design/ui-inventory.md
// SOT-KEYWORDS: ui sweep drift inventory tokens overrides design system audit
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/*
  grep exits 1 for "no match" and 2 for "bad usage", and the difference matters:
  swallowing both as an empty string made a broken pattern indistinguishable
  from a clean result. That is exactly how this script once reported all 91
  exports as unused — a quoting error inside the pattern, silently returning
  nothing, read as a finding. Exit 1 is data; anything else is a bug and stops
  the run.
*/
const sh = (c) => {
  try {
    return execSync(c, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch (error) {
    if (error.status === 1) return '';
    throw new Error(`sweep probe failed (exit ${error.status}): ${c}\n${error.stderr ?? ''}`);
  }
};
const lines = (o) => (o ? o.split('\n').filter(Boolean) : []);

const EXCLUDE = '--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=.expo';
/*
  Every package, not just app + ui. The first version scoped to
  `packages/app packages/ui apps` and silently skipped the other eight
  workspaces — `packages/avatar` imports the kit, so its call sites were missing
  from every count. A scope that names its members drifts the moment a package
  is added; `packages` does not.
*/
const SCOPE = `packages apps --include=*.tsx --include=*.ts ${EXCLUDE}`;
const TSX = `packages apps --include=*.tsx ${EXCLUDE}`;

/* ---- 1. What the kit exports, and who outside the kit uses it -------------- */

const barrels = lines(sh('ls packages/ui/index.ts packages/ui/*/index.ts 2>/dev/null'));
const exports = new Map();
for (const file of barrels) {
  const src = readFileSync(`${ROOT}/${file}`, 'utf8');
  const re = /export\s+(?:\{([^}]*)\}|(?:const|function|class)\s+(\w+))/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) {
      for (const raw of m[1].split(',')) {
        const t = raw.trim();
        if (!t) continue;
        const name = t.replace(/^type\s+/, '').split(/\s+as\s+/).pop().trim();
        if (name && /^[A-Za-z_]/.test(name)) {
          exports.set(name, { kind: t.startsWith('type ') ? 'type' : 'value', from: file });
        }
      }
    } else if (m[2]) exports.set(m[2], { kind: 'value', from: file });
  }
}

const inventory = [...exports].map(([name, meta]) => ({
  name,
  ...meta,
  // Consumers OUTSIDE the kit. Zero does NOT mean dead — it usually means the
  // component is composed inside packages/ui and should not be public.
  /*
    Counts IMPORT EDGES, not identifier matches.

    Matching the bare name counted any file that happened to use the same word.
    `packages/avatar` defines its own unrelated `summarise` and its own
    `TutorStage`, so both looked like kit consumers and neither is one — the
    error only appeared once the scope widened past `packages/app`, which is a
    good argument for not trusting a number that has never been stressed.

    A file counts only if it imports the name FROM the kit. Multi-line import
    blocks are the common shape here, so the file is read rather than grepped
    line by line.
  */
  external: (() => {
    const candidates = lines(
      // `.` for the quote — an escaped double quote inside this double-quoted
      // shell argument terminates it and breaks the whole pattern.
      sh(`grep -rlE "from .@acme/ui" packages apps --include=*.ts --include=*.tsx ${EXCLUDE} | grep -v '^packages/ui/'`),
    );
    return candidates.filter((f) => {
      let src = '';
      try {
        src = readFileSync(`${ROOT}/${f}`, 'utf8');
      } catch {
        return false;
      }
      // Each `import { ... } from '@acme/ui...'` block, braces included.
      for (const m of src.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]@acme\/ui[^'"]*['"]/g)) {
        const names = m[1].split(',').map((t) => t.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim());
        if (names.includes(name)) return true;
      }
      return false;
    }).length;
  })(),
}));

const values = inventory.filter((r) => r.kind === 'value');

/* ---- 2. Drift from the house rules ---------------------------------------- */

const probes = {
  'Heading className override': `grep -rnE "<Heading[^>]*className=" ${SCOPE}`,
  'Text className override': `grep -rnE "<Text[^>]*className=" ${SCOPE}`,
  'arbitrary Tailwind value': `grep -rnE "\\b(p|m|gap|w|h|text|rounded)-\\[" ${SCOPE}`,
  'hardcoded text-white/black': `grep -rnE "\\btext-(white|black)\\b" ${SCOPE}`,
  'raw <div>': `grep -rnE "<div[ >]" ${SCOPE}`,
  'FlatList (LegendList is the primitive)': `grep -rnE "\\bFlatList\\b" ${SCOPE}`,
  'React useState (Zustand only)': `grep -rnE "\\buseState\\(" ${SCOPE}`,
  /*
    Only React Native's. Matching the bare component name reported six false
    positives — every hit was `react-native-keyboard-controller`'s version (the
    one the repo standardised on) or a comment explaining why RN's is avoided.
    A probe that flags the correct choice as a violation trains people to ignore
    the report, so it matches the import source, not the identifier.
  */
  'RN KeyboardAvoidingView': `grep -rnE "KeyboardAvoidingView[^\\n]*from ['\\"]react-native['\\"]" ${SCOPE}`,
  'moti import (use @legendapp/motion)': `grep -rnE "from ['\\"]moti" ${SCOPE}`,
  'numeric gap-N instead of a tier': `grep -rnE "\\bgap-[0-9]" ${SCOPE}`,
};

const drift = {};
for (const [label, cmd] of Object.entries(probes)) {
  const hits = lines(sh(cmd));
  const product = hits.filter((h) => !/\.stories\.|\.test\./.test(h));
  drift[label] = { hits: hits.length, files: new Set(hits.map((h) => h.split(':')[0])).size, product: product.length };
}

/* ---- 3. Are the overrides one missing variant, or a real long tail? -------- */

const TYPE_SCALE = /\b(text-(xs|sm|base|lg|xl|[2-9]xl|display|title|body|caption|data|label)|font-(thin|light|normal|medium|semibold|bold|black)|leading-|tracking-)/;
const repetition = {};
for (const tag of ['Heading', 'Text']) {
  const hits = lines(sh(`grep -rhoE "<${tag}[^>]*className=\\"[^\\"]*\\"" ${TSX}`));
  const freq = new Map();
  let typeScale = 0;
  for (const h of hits) {
    const cls = (/className="([^"]*)"/.exec(h)?.[1] ?? '').trim();
    if (!cls) continue;
    if (TYPE_SCALE.test(cls)) typeScale++;
    freq.set(cls, (freq.get(cls) ?? 0) + 1);
  }
  const sorted = [...freq].sort((a, b) => b[1] - a[1]);
  const top6 = sorted.slice(0, 6).reduce((n, [, c]) => n + c, 0);
  repetition[tag] = {
    overrides: hits.length,
    distinct: freq.size,
    touchingTypeScale: typeScale,
    top6Share: hits.length ? Math.round((top6 / hits.length) * 100) : 0,
    top: sorted.slice(0, 6),
  };
}

/* ---- 4. Overrides that retype a variant the component already has --------- */

/*
  The most actionable signal here, and the one the raw counts hide.
  `<Heading className="text-2xl font-semibold text-text md:text-3xl">` appears 16
  times — and it is character-for-character what `size="title"` already renders.
  Those sites do not need a new variant added; they need the existing one used.
  A report that cannot tell those two cases apart prescribes the wrong fix.

  Variants are read out of the component's own `tv()` block rather than listed
  here, so a variant added tomorrow is checked tomorrow without editing this.
*/
const redundant = {};
for (const tag of ['Heading', 'Text']) {
  const src = sh(`cat packages/ui/${tag}.tsx 2>/dev/null`);
  if (!src) continue;

  const classesOf = (group) => {
    const block = new RegExp(`${group}:\\s*\\{([\\s\\S]*?)\\n\\s{4}\\}`).exec(src)?.[1] ?? '';
    const out = new Map();
    for (const m of block.matchAll(/['"]?([\w-]+)['"]?:\s*'([^']*)'/g)) out.set(m[1], m[2]);
    return out;
  };
  const sizes = classesOf('size');
  const tones = classesOf('tone');
  const defaultTone = /defaultVariants:\s*\{[^}]*tone:\s*'([^']+)'/.exec(src)?.[1];
  const defaultToneClasses = defaultTone ? (tones.get(defaultTone) ?? '') : '';

  const norm = (c) => c.trim().split(/\s+/).filter(Boolean).sort().join(' ');
  // Every combination the component can already produce, normalised.
  const reachable = new Map();
  for (const [sizeName, sizeClasses] of sizes) {
    reachable.set(norm(`${sizeClasses} ${defaultToneClasses}`), `size="${sizeName}"`);
    for (const [toneName, toneClasses] of tones) {
      reachable.set(norm(`${sizeClasses} ${toneClasses}`), `size="${sizeName}" tone="${toneName}"`);
    }
  }

  const hits = lines(sh(`grep -rhoE "<${tag}[^>]*className=\\"[^\\"]*\\"" ${TSX}`));
  const matches = new Map();
  for (const h of hits) {
    const cls = (/className="([^"]*)"/.exec(h)?.[1] ?? '').trim();
    if (!cls) continue;
    const already = reachable.get(norm(cls));
    if (already) matches.set(already, (matches.get(already) ?? 0) + 1);
  }
  redundant[tag] = {
    total: [...matches.values()].reduce((a, b) => a + b, 0),
    byVariant: [...matches].sort((a, b) => b[1] - a[1]),
  };
}

const result = {
  exports: { total: inventory.length, value: values.length, type: inventory.length - values.length },
  noExternalConsumer: values.filter((r) => r.external === 0).map((r) => r.name),
  singleConsumer: values.filter((r) => r.external === 1).map((r) => r.name),
  drift,
  repetition,
  redundant,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(`exports        ${result.exports.total} (${result.exports.value} value, ${result.exports.type} type)`);
console.log(`no external use ${result.noExternalConsumer.length}  ← narrow the barrel, do NOT delete: these are used inside packages/ui`);
console.log(`single consumer ${result.singleConsumer.length}\n`);
for (const [label, d] of Object.entries(drift)) {
  console.log(`${String(d.hits).padStart(4)} hits  ${String(d.files).padStart(3)} files  ${String(d.product).padStart(4)} in product code   ${label}`);
}
console.log();
for (const [tag, r] of Object.entries(repetition)) {
  console.log(
    `${tag}: ${r.overrides} overrides · ${r.distinct} distinct strings · ${r.touchingTypeScale} touch the type scale · top 6 cover ${r.top6Share}%`,
  );
}

console.log('\noverrides that retype an EXISTING variant (use it, do not add one):');
for (const [tag, r] of Object.entries(redundant)) {
  if (r.total === 0) {
    console.log(`  ${tag}: none`);
    continue;
  }
  console.log(`  ${tag}: ${r.total}`);
  for (const [variant, n] of r.byVariant) console.log(`      ${String(n).padStart(3)}x  ${variant}`);
}

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
const sh = (c) => {
  try {
    return execSync(c, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim();
  } catch {
    return ''; // grep exits 1 on no match, which is a valid answer here.
  }
};
const lines = (o) => (o ? o.split('\n').filter(Boolean) : []);

const EXCLUDE = '--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=.expo';
const SCOPE = `packages/app packages/ui apps --include=*.tsx --include=*.ts ${EXCLUDE}`;
const TSX = `packages/app packages/ui apps --include=*.tsx ${EXCLUDE}`;

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
  external: lines(sh(`grep -rlE "\\b${name}\\b" packages/app apps --include=*.ts --include=*.tsx ${EXCLUDE}`)).length,
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
  'RN KeyboardAvoidingView': `grep -rnE "\\bKeyboardAvoidingView\\b" ${SCOPE}`,
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

const result = {
  exports: { total: inventory.length, value: values.length, type: inventory.length - values.length },
  noExternalConsumer: values.filter((r) => r.external === 0).map((r) => r.name),
  singleConsumer: values.filter((r) => r.external === 1).map((r) => r.name),
  drift,
  repetition,
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

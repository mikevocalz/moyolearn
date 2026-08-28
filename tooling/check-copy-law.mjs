#!/usr/bin/env node
// The marketing site's copy laws, enforced instead of remembered.
//
// Doc 33 §8.2 makes three promises non-goals — no social features, no voice
// input in v1, and no "answer mode" ever — and doc 05 §2.2/§2.3 keeps business
// tiers off every surface a parent reads. Those are the four rules below.
//
// WHY A GATE AND NOT A REVIEW NOTE: every one of these fails silently. A
// sentence promising answers reads *better* than the honest one — "get instant
// answers" is the sentence a marketer writes on a good day, and it is the exact
// thing this product refuses to be. Nobody catches it in review because it does
// not look like a mistake. `docs/site/copy-deck.md` §12 flagged thirteen such
// strings before they shipped; this file is what stops the fourteenth.
//
// WHAT IT SCANS: `apps/web-vite/src/**` only — the strings that actually ship.
// The copy deck is deliberately NOT scanned: it carries "Rejected — do not
// ship" tables that quote the forbidden phrasing on purpose, and a gate that
// cannot tell a specimen from a shipment is a gate people switch off.
//
// NEGATION-AWARE, because the sanctioned line contains the banned words. Moyo's
// required sentence is "Moyo never just gives the answer — it teaches the next
// step." A gate that greps for "gives the answer" would fail on the one line
// the spec mandates. So a promissory match is cleared when a negation governs
// it within the same clause. The rule is "do not PROMISE answers", not "do not
// say the word".
// SOT: docs/pack/33-moyo-learn-prd.md §8.2 · docs/pack/05-monetization-access-spec.md §2.2 §2.3 · docs/site/copy-deck.md §12
// SOT-KEYWORDS: copy law marketing site answers non-goal business tier parent surface voice input social gdpr build check
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SITE_SRC = join(ROOT, 'apps/web-vite/src');

// A negation anywhere in the 60 characters before the match clears it. That
// window is a clause, not a sentence: it catches "never just gives the answer"
// and "instead of handing over the answer" without clearing a banned promise
// that merely shares a paragraph with an unrelated "not".
const NEGATION = /\b(never|not|n't|without|rather than|instead of|no)\b[^.!?]{0,60}$/i;

const RULES = [
  {
    id: 'answers',
    law: 'Moyo guides, it never just gives answers (doc 33 §8.2 — "no answer mode ever")',
    negatable: true,
    patterns: [
      /\b(get|gets|getting|give|gives|giving|hand|hands|provide|provides|reveal|reveals|show|shows)\s+(you\s+|them\s+|your\s+child\s+)?(the\s+|an\s+)?answers?\b/i,
      /\banswer\s+keys?\b/i,
      /\binstant\s+answers?\b/i,
      /\banswers?\s+in\s+seconds\b/i,
      /\b(does|do|doing)\s+(your|the|their)\s+homework\b/i,
      /\bsolves?\s+it\s+for\s+(you|them)\b/i,
    ],
  },
  {
    id: 'business-pricing',
    law: 'Business tiers are never rendered where a parent reads; /schools is "talk to us", not a price grid (doc 05 §2.2)',
    negatable: false,
    patterns: [
      // The doc 05 business prices, as literals. The family prices ($11 /
      // $15.99) are deliberately absent from this list — those are the only
      // numbers the site is allowed to print.
      /\$\s?19\b(?!\.\d)/,
      /\$\s?99\b(?!\.\d)/,
      /\$\s?299\b/,
      /\bOps\s*[·.\-–]\s*(Solo|Studio|Scale)\b/i,
      /\bper[- ]seat\b/i,
      /\$\s?\d+\s*\/\s*(student|seat)\b/i,
    ],
  },
  {
    id: 'non-goals',
    law: 'No voice input and no social features in v1 (doc 33 §8.2)',
    negatable: true,
    patterns: [
      // Targets voice as an INPUT affordance. Bare "voice" is legitimate and
      // common here — Natalie has one, and chapter 05's "voice that teaches"
      // is sanctioned copy — so only imperative capture phrasing is banned.
      /\bvoice\s+input\b/i,
      /\b(speak|say|talk)\s+(it\s+)?(to\s+)?(natalie|your\s+tutor)\b/i,
      /\b(speak|say|ask)\s+(your|the)\s+(question|problem)\b/i,
      /\btap\s+to\s+(speak|talk)\b/i,
      /\bleaderboards?\b/i,
      // "compete with" alone is ordinary English — it caught a comment about
      // two preloaded fonts competing for bandwidth. The banned promise is
      // competition between CHILDREN, so the object has to be named.
      /\bcompete\s+(with|against)\s+(friends|classmates|other\s+(kids|children|students|learners))\b/i,
      /\b(share|compare)\s+(it\s+|progress\s+|scores?\s+)?with\s+(friends|classmates)\b/i,
    ],
  },
  {
    id: 'us-framing',
    law: 'Compliance framing is US-only — COPPA / FERPA / state student-privacy (site brief §3)',
    negatable: false,
    patterns: [/\bGDPR\b/, /\bEU\s+(data|privacy|regulation)/i, /\bGeneral\s+Data\s+Protection\b/i],
  },
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(tsx?|mdx?)$/.test(entry) && !entry.endsWith('.gen.ts')) {
      out.push(full);
    }
  }
  return out;
}

let files;
try {
  files = walk(SITE_SRC);
} catch {
  // The site is a workspace app like any other; if it is not checked out there
  // is nothing to police and that is not a failure.
  console.log('copy-law skipped — apps/web-vite/src not present');
  process.exit(0);
}

const violations = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');

  lines.forEach((line, i) => {
    // Comments and import paths are not shipped copy. A header block explaining
    // *why* Moyo refuses answer-mode necessarily contains the phrasing it
    // refuses, and a citation names documents that collide with the patterns.
    // Scoping to what a visitor can read is the difference between a gate that
    // holds and one that gets an ignore-comment on its second failure.
    // Only MODULE SPECIFIER lines are skipped — a path may legitimately contain
    // a banned word. Skipping every line that merely starts with `export` would
    // blind the gate to most of a component file, which is exactly the false
    // negative this comment exists to prevent from coming back.
    if (/^\s*import\s+['"]/.test(line)) return;
    if (/^\s*(import|export)\b[^'"`]*\bfrom\s*['"]/.test(line)) return;
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) return;

    for (const rule of RULES) {
      for (const pattern of rule.patterns) {
        const match = pattern.exec(line);
        if (!match) continue;
        if (rule.negatable && NEGATION.test(line.slice(0, match.index))) continue;
        violations.push({
          file: relative(ROOT, file),
          line: i + 1,
          rule,
          text: line.trim().slice(0, 120),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`copy-law FAILED — ${violations.length} violation(s):\n`);
  const byRule = new Map();
  for (const v of violations) {
    if (!byRule.has(v.rule.id)) byRule.set(v.rule.id, { law: v.rule.law, hits: [] });
    byRule.get(v.rule.id).hits.push(v);
  }
  for (const [id, { law, hits }] of byRule) {
    console.error(`  [${id}] ${law}`);
    for (const h of hits) console.error(`    ${h.file}:${h.line}  ${h.text}`);
    console.error('');
  }
  console.error('If a string is genuinely lawful, make the negation explicit in the copy');
  console.error('rather than widening a pattern — the law is the product, not the regex.');
  process.exit(1);
}

console.log(`copy-law OK — ${files.length} site files carry no banned promise`);

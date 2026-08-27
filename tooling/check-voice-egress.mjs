#!/usr/bin/env node
// Doc 32's structural rule, as a build failure: "nothing learner-authored may
// reach the TTS payload." The only text that reaches ElevenLabs is Natalie's
// output — already screened by the Safety Plane and MAC-verified as
// server-emitted — and the frozen baked scripts. That is true today because of
// three import-direction facts, and this check is what keeps each one a fact
// rather than a habit (sibling of `check-no-training-path.mjs`, same textual
// posture: the rule is "these files may not name those things").
//
//   1. THE CREDENTIAL HAS ONE HOME. `ELEVENLABS_API_KEY` is read in
//      `packages/voice/src/eleven.ts` and nowhere else — a second reader is a
//      second egress the routing, budget and verification would not cover.
//   2. THE EGRESS HAS NAMED IMPORTERS. `@acme/voice` may be imported only by
//      the voice API routes, the web voice libs, the ledger repository (port
//      types), and the bake script. A feature — anything under `features/`,
//      anything on the learner-message path — importing it directly would be
//      a call site where learner text and the TTS client meet in one scope.
//   3. THE EGRESS CANNOT READ LEARNER INPUT. `packages/voice` may not import
//      the app package, features, repositories, or the stores — the same
//      "holds the credential, must not also hold a read path" posture the
//      inference gateway lives under.
//
// It prints what it scanned either way, because a gate that silently passes
// reads identically to one that is working.
// SOT: docs/pack/32-tutor-voice-tone.md §3 · tooling/check-no-training-path.mjs
// SOT-KEYWORDS: voice egress check elevenlabs key sole importers learner authored tts payload gate
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

/** The one file that may read the credential. */
const KEY_HOME = 'packages/voice/src/eleven.ts';

/**
 * The egress's own suite sets a FAKE key so the code under test can run; that
 * is naming the variable, not a second reader of the real one. Nothing outside
 * the package gets the same grace.
 */
const KEY_NAMERS = new Set([KEY_HOME, 'packages/voice/src/voice.test.ts']);

/**
 * Rule 2's allowlist, by name so growing it is a reviewer's decision. The
 * repository entry is for the PORT TYPES (`VoiceBudgetLedger`) — the durable
 * ledger implements @acme/voice's port for the same reason
 * `budget-ledger.repository.ts` implements @acme/inference's.
 */
const ALLOWED_IMPORTERS = [
  'packages/voice/',
  'apps/web/app/api/tutor/voice/',
  'apps/web/lib/voice.ts',
  'apps/web/lib/voice-baked.ts',
  'apps/web/lib/voice-utterance.ts',
  'apps/web/lib/budget-ledger.repository.ts',
  'apps/web/scripts/voice-bake.mts',
];

/**
 * Rule 3's forbidden list: everything holding or moving learner input, plus
 * the other credential holder. `@acme/safety` is deliberately ABSENT — the
 * voice package imports `S4_SCRIPTS` so crisis audio renders from the exact
 * frozen strings, and the safety package is fixed data and pure screens, not
 * learner text. `@acme/student-model` is absent for its `VoiceBand` type.
 */
const VOICE_FORBIDDEN = [
  '@acme/app',
  '@acme/auth',
  '@acme/inference',
  '@acme/jobs',
  '@acme/payload',
  '@acme/ui',
  'features/',
  'repositories/',
  '.repository',
];

const SCAN_ROOTS = ['apps', 'packages'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.expo', '.turbo']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(entry)) out.push(full);
  }
  return out;
}

const importPattern = (name) =>
  new RegExp(`(?:from|import|require\\()\\s*['"\`][^'"\`]*${name.replace(/[/\\.]/g, '\\$&')}`);

const violations = [];
let scanned = 0;
let voiceFiles = 0;

for (const rootRel of SCAN_ROOTS) {
  const rootDir = join(ROOT, rootRel);
  if (!existsSync(rootDir)) continue;

  for (const file of walk(rootDir)) {
    scanned += 1;
    const rel = relative(ROOT, file);
    const source = readFileSync(file, 'utf8');

    // Rule 1 — the key. Matched as a bare token, not as an import: reading it
    // off `process.env` under any spelling of access is the thing being
    // forbidden. `.env*` files are not scanned (not source), and docs aren't
    // either, so a mention here is a mention in code.
    if (source.includes('ELEVENLABS_API_KEY') && !KEY_NAMERS.has(rel)) {
      violations.push(`${rel} → names ELEVENLABS_API_KEY (only ${KEY_HOME} may)`);
    }

    // Rule 2 — who may import the egress.
    if (!rel.startsWith('packages/voice/') && importPattern('@acme/voice').test(source)) {
      if (!ALLOWED_IMPORTERS.some((allowed) => rel === allowed || rel.startsWith(allowed))) {
        violations.push(
          `${rel} → imports @acme/voice. Features and the learner-message path take the voice\n` +
            '    ports from the service boundary; only the named voice surfaces hold the egress.',
        );
      }
    }

    // Rule 3 — what the egress may import.
    if (rel.startsWith('packages/voice/')) {
      voiceFiles += 1;
      for (const forbidden of VOICE_FORBIDDEN) {
        if (importPattern(forbidden).test(source)) {
          violations.push(
            `${rel} → ${forbidden} (the voice egress holds the credential and must not also ` +
              'hold a path to learner input)',
          );
        }
      }
    }
  }
}

if (violations.length > 0) {
  console.error('\ncheck-voice-egress — learner text can meet the TTS credential.\n');
  console.error(
    'Doc 32: the only text that reaches ElevenLabs is Natalie’s screened output and the\n' +
      'frozen baked scripts, and the architecture is what enforces it. Route through the\n' +
      'voice service’s ports instead, or this stops being a thing we CAN say.\n',
  );
  for (const violation of violations) console.error(`  ${violation}`);
  console.error('');
  process.exit(1);
}

console.log(
  `voice-egress OK — ${scanned} files scanned; the key lives only in ${KEY_HOME}; ` +
    `${voiceFiles} egress files reach no learner input; importers held to ${ALLOWED_IMPORTERS.length} named surfaces`,
);

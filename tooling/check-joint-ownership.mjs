#!/usr/bin/env node
/*
  Three invariants for the pose layers, all of them failures that are otherwise
  silent for as long as it takes someone to notice the character looks wrong.

  1. EVERY BONE THE WRITER NAMES EXISTS IN EVERY SHIPPED ASSET.
     `pose()` no-ops on a null bone, so a name that does not resolve produces a
     presence that mounts, steps every frame and writes nothing — the mesh
     renders in its BIND pose, which on this asset is arms out at 45 degrees
     with the elbows up and the fists closed. That has been reported as a
     character bug, and no error anywhere explained it. Three copies of the
     asset ship (marketing, phone, and the web app's public copy) and the
     manifest audits two of them, so this reads the files rather than the
     manifest.

  2. EXACTLY ONE OWNER PER JOINT, AND NO MODULATOR ON AN UNOWNED JOINT.
     Delegated to `ownershipProblems` so the check and the unit test assert one
     implementation instead of two similar ones.

  3. NO CLAIMED JOINT TYPED OUTSIDE THE TWO FILES THAT DERIVE THE NAMES.
     A claimed bone name typed into a third file is a name that drifts from the
     asset, and drift here is invisible: the code runs, the tests pass, the
     joint does not move. Only CLAIMED joints, deliberately — naming an unowned
     bone is how a test asserts something about one, and `DEF-pelvis`,
     `DEF-jaw` and `DEF-teeth.T` are named precisely because they carry no
     weight. Banning every `DEF-` string would ban that assertion. Whole
     string literals only, for the same reason: a bone named inside a test
     title is prose describing the assertion, not a reference that can drift.
*/
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS = [
  'packages/avatar/assets/humano-marketing.glb',
  'packages/avatar/assets/natalie-phone/natalie.gltf',
  'apps/web/public/natalie/natalie.gltf',
];
/** Where a `DEF-` string may legitimately appear in source. */
const NAME_SOURCES = ['packages/avatar/src/presence/humano.ts', 'packages/avatar/src/presence/ownership.ts'];

const failures = [];

const { CLAIMED_JOINTS, LAYERS, ownershipProblems } = await import(
  '../packages/avatar/src/presence/ownership.ts'
);

// 1 — the names resolve, in every shipped copy.
for (const path of ASSETS) {
  let text;
  try {
    text = readFileSync(path).toString('latin1');
  } catch {
    failures.push(`${path}: not found — the writer's bones cannot be verified against it`);
    continue;
  }
  /*
    Tolerant of whitespace on purpose. A `"name":"x"` pattern silently matches
    nothing in a pretty-printed glTF, and "nothing matched" reads exactly like
    "every bone is missing" — which it did, on two assets that were fine.
  */
  const present = new Set(
    [...text.matchAll(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]),
  );
  if (present.size === 0) {
    failures.push(`${path}: parsed zero node names — the check cannot see this asset, treat as unverified`);
    continue;
  }
  const absent = CLAIMED_JOINTS.filter((j) => !present.has(j));
  if (absent.length > 0) {
    failures.push(
      `${path}: ${absent.length}/${CLAIMED_JOINTS.length} claimed joints absent — she will render in her ` +
        `bind pose (arms out, hands closed). Missing: ${absent.slice(0, 6).join(', ')}` +
        (absent.length > 6 ? ` +${absent.length - 6} more` : ''),
    );
  }
}

// 2 — ownership.
for (const p of ownershipProblems(LAYERS)) {
  failures.push(
    p.kind === 'double-owned'
      ? `${p.joint}: owned by ${p.layers.join(' and ')} — decide which, do not blend`
      : `${p.joint}: modulated by ${p.layers[0]} but owned by nobody — the delta has no base`,
  );
}

// 3 — no bone names typed elsewhere.
const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (entry === 'node_modules' || entry.startsWith('.')) return [];
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
for (const path of walk('packages/avatar/src')) {
  if (!/\.tsx?$/.test(path) || NAME_SOURCES.includes(path)) continue;
  const claimed = new Set(CLAIMED_JOINTS);
  const names = [...readFileSync(path, 'utf8').matchAll(/(['"`])(DEF-[\w.]+)\1/g)]
    .map((m) => m[2])
    .filter((n) => claimed.has(n));
  if (names.length > 0) {
    failures.push(
      `${path}: bone names typed here (${[...new Set(names)].slice(0, 3).join(', ')}) — ` +
        'import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset',
    );
  }
}

if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(
  `joint ownership clean: ${CLAIMED_JOINTS.length} joints, ${LAYERS.length} layers, ` +
    `verified against ${ASSETS.length} shipped assets`,
);

#!/usr/bin/env node
/*
  A material that reads an input nothing produces cannot be applied, and it
  fails silently in both directions that matter: `attribute()` on a name the
  geometry does not carry is a bind failure at draw time, and a typecheck, a
  unit test and a code review all pass over it without a word. The materials
  layer accumulated six of these before anyone noticed, every one of them
  pointing at a Python tool that was never committed — `find . -name "*.py"`
  returns nothing, repo-wide.

  So this is a RATCHET, not a pass/fail. The gaps are listed with what each one
  needs, the list may not grow, and an entry that stops being true fails the
  build so the ledger cannot rot into fiction of its own. That last direction is
  the one a ledger normally lacks and the reason this one is trustworthy: a
  stale entry is as misleading as a missing one.

  SOT: packages/avatar/src/materials/ · audit/motion/realism-2026-09-10.md
  SOT-KEYWORDS: material inputs attribute producer ratchet bake tool missing gltf
*/
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'packages/avatar';

/** Attribute -> the committed module that computes it. The path must exist. */
const PRODUCERS = {
  aCurvature: 'packages/avatar/src/materials/skin-aux.ts',
  aThickness: 'packages/avatar/src/materials/skin-aux.ts',
  positionStorage: 'packages/avatar/src/compute/head.ts',
};

/**
 * Attribute -> why there is no producer and what one would have to do. Shrink
 * this; never grow it. Every entry was verified against all three shipped
 * assets, none of which carries any attribute beyond POSITION, NORMAL,
 * TEXCOORD_0, COLOR_0, JOINTS_0 and WEIGHTS_0.
 */
const MISSING = {
  aHairT:
    'hair.ts binds it in positionNode, so the braid sway cannot run on the real body. ' +
    'Derivable at load: V of the hair card UV runs root-to-tip, once cards are separated by connected components over the index buffer.',
  aHairPhase:
    'Same bind as aHairT. A per-card hash would do it; it needs the same connected-component pass.',
  aTip:
    'brow.ts has no producer at all — no ribbon builder exists, though the header claims the strand geometry "ports unchanged". avatar-manifest.json promises gnm/brow-strands.bin.',
  aCavity:
    'buildCavityAttribute in mouth.ts is real and correct; its MouthCavity input is not. That comes from gnm/mouth-cavity.json, cited to a tool that does not exist.',
  aEyeAux:
    'No producer and no cited tool. avatar-manifest.json carries a sha256 for gnm/eye-aux.json that nothing in the repo writes or parses.',
  garmentRestPosition:
    'denim.ts needs the SMPL-X rest position per vertex so the wear does not swim. Absent from every shipped asset; the body ships as one mesh with clothing baked in, so denim.ts has no surface to apply to either.',
};

/**
 * Tool paths cited in source that do not exist. Same rule: shrink, never grow,
 * and an entry whose file appears must be removed.
 */
const ABSENT_TOOLS = {
  'tools/bake_skin_aux.py': 'Cited by skin-aux.ts as the thing it REPLACES. The reference is deliberate and historical.',
  'tools/bake_lash_lines.py': 'lashes.ts needs per-eye lid-margin polylines. No producer.',
  'tools/bake_mouth_cavity.py': 'Produces the gnm/mouth-cavity.json that aCavity needs.',
  'tools/bake_identity.py': 'Identity bake, referenced by the GNM path.',
  'tools/bake_neck_align.py': 'Neck alignment bake.',
  'tools/bake_runtime_container.py': 'Runtime container bake.',
  'tools/export_body.py': 'The body export that would emit the custom attributes above.',
  'tools/export_gnm_web.py': 'The GNM web export.',
  'tools/verify_runtime_bake.ts':
    'rebake-entry.ts inherits its sub-millimetre vertex figures from this tool. It is not here, so those numbers cannot be reproduced on this branch and the header says so.',
};

const failures = [];
const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    if (entry === 'node_modules' || entry === '.types' || entry.startsWith('.')) return [];
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const sources = walk(join(ROOT, 'src')).filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p));

// 1 — every declared attribute is accounted for, one way or the other.
const declared = new Map();
for (const path of sources) {
  for (const m of readFileSync(path, 'utf8').matchAll(/export const \w*ATTRIBUTE\s*=\s*'([^']+)'/g)) {
    declared.set(m[1], path);
  }
}
if (declared.size === 0) failures.push('parsed zero attribute declarations — the shape of the materials changed');

for (const [name, path] of declared) {
  const produced = Object.hasOwn(PRODUCERS, name);
  const missing = Object.hasOwn(MISSING, name);
  if (produced && missing) failures.push(`${name}: listed as both produced and missing`);
  if (!produced && !missing) {
    failures.push(
      `${name} (${path}): declared with no producer and no ledger entry — ` +
        'either add the producer to PRODUCERS or record the gap in MISSING with what it needs',
    );
  }
}
for (const [name, path] of Object.entries(PRODUCERS)) {
  if (!declared.has(name)) failures.push(`PRODUCERS lists ${name}, which no material declares any more — stale entry`);
  else if (!existsSync(path)) failures.push(`${name}: producer ${path} does not exist`);
}
for (const name of Object.keys(MISSING)) {
  if (!declared.has(name)) failures.push(`MISSING lists ${name}, which no material declares any more — stale entry`);
}

// 2 — a cited tool exists, or is recorded as absent with a reason.
const cited = new Map();
for (const path of [...sources, ...walk(join(ROOT, 'tools')).filter((p) => /\.(mjs|ts)$/.test(p))]) {
  for (const m of readFileSync(path, 'utf8').matchAll(/\btools\/[A-Za-z0-9_.-]+\.(?:py|mjs|ts|js)\b/g)) {
    if (!cited.has(m[0])) cited.set(m[0], path);
  }
}
for (const [tool, path] of cited) {
  if (existsSync(join(ROOT, tool))) continue;
  if (Object.hasOwn(ABSENT_TOOLS, tool)) continue;
  failures.push(
    `${path} cites ${tool}, which does not exist — fix the reference, or record it in ABSENT_TOOLS with why`,
  );
}
for (const tool of Object.keys(ABSENT_TOOLS)) {
  if (existsSync(join(ROOT, tool))) failures.push(`${tool} exists now — remove it from ABSENT_TOOLS`);
  else if (!cited.has(tool)) failures.push(`ABSENT_TOOLS lists ${tool}, which nothing cites any more — stale entry`);
}

if (failures.length > 0) {
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(
  `material inputs OK — ${declared.size} attributes: ${Object.keys(PRODUCERS).length} produced, ` +
    `${Object.keys(MISSING).length} gaps recorded · ${Object.keys(ABSENT_TOOLS).length} absent tools recorded`,
);

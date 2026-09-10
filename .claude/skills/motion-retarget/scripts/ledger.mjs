#!/usr/bin/env node
// The motion-asset ledger: what a clip is, where it came from, and what the
// terms allow.
//
// This is not paperwork for its own sake. A ledger is how you PROVE an asset is
// yours to ship — the receipt, the seat count, the redistribution scope — and
// the question always arrives long after the person who bought it has forgotten
// the terms. Recording it once at import is cheaper than reconstructing it under
// pressure.
//
// `--check` fails when a clip is present in the manifest with no entry here, so
// an unrecorded asset cannot reach a build quietly.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const LEDGER = 'packages/avatar/motion-ledger.json';

const REQUIRED = [
  'id',            // matches the clip id in the asset manifest
  'source',        // where it came from: vendor, commission, capture session
  'license',       // the terms' NAME, e.g. "Humano Studio Standard", "CC BY-NC 4.0"
  'licenseUrl',    // where those terms can be read
  'redistribution', // 'none' | 'built-artifact-only' | 'source-and-built'
  'acquiredAt',    // when
  'checkedBy',     // who read the terms
];

const load = () => (existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : { version: 1, entries: [] });

const [, , cmd, ...rest] = process.argv;

if (cmd === '--check') {
  const ledger = load();
  const byId = new Map(ledger.entries.map((e) => [e.id, e]));
  const manifestPath = rest[0] ?? 'packages/avatar/assets/avatar-manifest.json';
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const problems = [];
  for (const asset of manifest.assets ?? []) {
    const entry = byId.get(asset.id);
    if (!entry) {
      problems.push(`${asset.id}: no ledger entry`);
      continue;
    }
    const missing = REQUIRED.filter((k) => entry[k] === undefined || entry[k] === '');
    if (missing.length > 0) problems.push(`${asset.id}: missing ${missing.join(', ')}`);
  }

  /*
    The redistribution field is the one that decides whether a file may sit in a
    public repository at all. `none` and `built-artifact-only` both mean the
    editable source does not go in git — it ships from the CDN the manifest
    already points at.
  */
  const publiclyCommitted = (manifest.assets ?? []).filter((a) => {
    const entry = byId.get(a.id);
    return entry && entry.redistribution !== 'source-and-built' && entry.committed === true;
  });
  for (const a of publiclyCommitted) {
    problems.push(`${a.id}: committed to the repo, but its terms do not allow redistributing the source`);
  }

  if (problems.length > 0) {
    for (const p of problems) console.error(`  FAIL ${p}`);
    console.error(`\n${problems.length} asset(s) unrecorded or out of scope. Add entries to ${LEDGER}.`);
    process.exit(1);
  }
  console.log(`ledger clean: ${manifest.assets?.length ?? 0} asset(s), all recorded`);
  process.exit(0);
}

if (cmd === '--init') {
  if (existsSync(LEDGER)) {
    console.error(`${LEDGER} already exists — edit it rather than regenerating`);
    process.exit(1);
  }
  writeFileSync(
    LEDGER,
    `${JSON.stringify({ version: 1, $comment: `Required per entry: ${REQUIRED.join(', ')}`, entries: [] }, null, 2)}\n`,
  );
  console.log(`created ${LEDGER}`);
  process.exit(0);
}

console.error('usage: ledger.mjs --check [manifest.json] | --init');
process.exit(1);

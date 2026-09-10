#!/usr/bin/env node
// Rights gate: every avatar asset says where it came from and what may be done
// with it, or the build stops.
//
// This is not paperwork. A rights record is how you PROVE an asset is yours to
// ship, and the question arrives long after whoever acquired it has forgotten
// the terms. It also separates two permissions that are routinely conflated:
// embedding an asset in a build, and redistributing its source. Most character
// and motion licences grant the first and refuse the second — and a public
// repository is a redistribution channel whether or not it was meant as one.
//
// The licence DOCUMENT never enters the repository. `evidence` is a reference
// to wherever invoices are held.
// SOT: packages/avatar/src/assets.ts `AssetRights` · .claude/skills/motion-retarget
// SOT-KEYWORDS: asset ledger rights licence check gate avatar manifest provenance
import { readFileSync } from 'node:fs';

const MANIFEST = 'packages/avatar/assets/avatar-manifest.json';
const REQUIRED = ['source', 'license', 'permits', 'acquiredOn', 'evidence', 'checkedBy'];

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const assets = manifest.assets ?? [];

const unrecorded = [];
const incomplete = [];
for (const asset of assets) {
  const r = asset.rights;
  if (!r) {
    unrecorded.push(asset.id);
    continue;
  }
  const missing = REQUIRED.filter((k) => r[k] === undefined || r[k] === '');
  if (missing.length > 0) incomplete.push(`${asset.id}: missing ${missing.join(', ')}`);
  else if (typeof r.permits !== 'object' || ['embed', 'distributeSource', 'modify'].some((k) => typeof r.permits[k] !== 'boolean')) {
    incomplete.push(`${asset.id}: permits needs embed/distributeSource/modify as booleans`);
  }
}

/*
  The check that actually protects something. An asset committed to this
  repository whose terms do not permit redistributing its source is the failure
  mode worth a build break — it is public the moment it is pushed, and git
  history keeps it public after a delete.
*/
const overreach = assets
  .filter((a) => a.rights?.permits && a.rights.permits.distributeSource === false && a.rights.committed !== false)
  .filter((a) => a.rights.source !== 'authored')
  .map((a) => a.id);

const recorded = assets.length - unrecorded.length;
if (unrecorded.length === 0 && incomplete.length === 0 && overreach.length === 0) {
  console.log(`asset-ledger OK — ${assets.length} asset(s), all rights recorded`);
  process.exit(0);
}

console.error(`\ncheck-asset-ledger — ${recorded} of ${assets.length} asset(s) have a rights record.\n`);
console.error('Every avatar asset states its source, licence and what the terms permit.');
console.error(`Add a \`rights\` block per \`AssetRights\` in packages/avatar/src/assets.ts.`);
console.error('The licence document stays out of this repo — `evidence` is a reference to it.\n');
if (unrecorded.length > 0) console.error(`  unrecorded (${unrecorded.length}): ${unrecorded.join(', ')}`);
for (const i of incomplete) console.error(`  incomplete: ${i}`);
for (const o of overreach) console.error(`  OVERREACH: ${o} is committed but its terms forbid redistributing source`);
process.exit(1);

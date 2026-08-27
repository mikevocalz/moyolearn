// Learner content must not be shadowed by a Payload version table.
//
// This canary defaults `versions` ON (recorded in Leads.ts), and Payload mirrors
// every write into `_<table>_v`. The retention sweep targets `expires_at` on the
// MAIN table only, so a transcript survives its own deletion in the shadow copy:
// docs 19 and 24 promise learner content inherits the erasure cascade, and a
// guarantee that isn't enforced in the database isn't a guarantee.
//
// Measured when this was found: 1,294 shadow rows, including 1,119 in
// `_student_model_facts_v_texts` against 49 live — a 23x copy of derived facts
// nothing was going to sweep. Nine of eleven collections had inherited the
// default; the two that had not were the two someone had already been bitten by.
//
// Versions are an editorial feature — draft/publish, revert, who-changed-what.
// None of that applies to an append-only record of a child's session.
// SOT: docs/pack/12-systems-design.md §11.1 · docs/pack/07-security-child-ai-safety-spec.md §4
// SOT-KEYWORDS: versions erasure cascade retention learner content payload shadow table check
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'packages/payload/src/collections';

/*
  Every collection is checked, not a learner-content allowlist. An allowlist is a
  judgement that has to be revisited every time a collection is added, by someone
  who may not know why the list exists — and the failure mode is silent. If a
  collection genuinely needs versions, it has to say so here, in front of a
  reviewer, rather than inherit them from a canary default.
*/
const offenders = [];
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.ts'))) {
  const source = readFileSync(join(DIR, file), 'utf8');
  if (!/^\s*versions:\s*false\s*,/m.test(source)) offenders.push(file.replace(/\.ts$/, ''));
}

if (offenders.length > 0) {
  console.error(
    `\n${offenders.length} Payload collection(s) inherit the canary's versions-ON default:\n` +
      offenders.map((o) => `  ${o}`).join('\n') +
      '\n\nEvery write is mirrored into `_<table>_v`, which the retention sweep never\n' +
      'touches — so "delete my child\'s data" does not delete it. Set `versions: false`,\n' +
      'or if this collection truly needs history, say why here and exempt it explicitly.\n',
  );
  process.exit(1);
}

console.log(`check-versions-off: ${readdirSync(DIR).filter((f) => f.endsWith('.ts')).length} collections, none shadowed`);

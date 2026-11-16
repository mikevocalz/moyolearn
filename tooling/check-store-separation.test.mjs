// Exercise the CLI on isolated product trees, including misplaced real imports.
// SOT: tooling/check-store-separation.mjs · docs/pack/11-architectural-guardrails.md §6
// SOT-KEYWORDS: store separation repository server-only driver edu mutation regression
import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const marker = "import 'server-only';\n";
const driver = "import { Pool } from 'pg';\n";
const sharedRepository = 'packages/app/marketing/repository/marketing.repository.ts';
const operationalQuery = "const query = 'SELECT id FROM payload.marketing_inquiries';\n";

function check(file, source) {
  const fixture = mkdtempSync(join(tmpdir(), 'moyo-store-separation-'));
  try {
    const script = join(fixture, 'tooling/check-store-separation.mjs');
    mkdirSync(dirname(script), { recursive: true });
    copyFileSync(new URL('./check-store-separation.mjs', import.meta.url), script);
    const product = join(fixture, file);
    mkdirSync(dirname(product), { recursive: true });
    writeFileSync(product, source);
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8' });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    return { status: result.status, output: result.stdout + result.stderr };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

test('a marked generated repository may use the operational driver', () => {
  const result = check(sharedRepository, marker + driver + operationalQuery);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /store-separation OK/);
});

for (const [name, file, source] of [
  ['service instead of repository', 'packages/app/marketing/services/marketing.service.ts', marker + driver],
  ['missing marker', sharedRepository, driver],
  ['marker after a leading comment', sharedRepository, '// not the first line\n' + marker + driver],
  ['marker only inside a comment', sharedRepository, "// import 'server-only';\n" + driver],
]) {
  test(`raw driver fails closed with ${name}`, () => {
    const result = check(file, source);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /holds the raw database driver/);
  });
}

for (const [name, source] of [
  ['SQL', marker + driver + "const query = 'SELECT id FROM edu.transcripts';\n"],
  ['client import', marker + "import { connection } from './edu.client';\n"],
]) {
  test(`even a marked app repository cannot reach educational ${name}`, () => {
    const result = check(sharedRepository, source);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, /reaches the educational store directly/);
  });
}

test('the existing host educational repository remains the store boundary', () => {
  const result = check(
    'apps/web/lib/edu.repository.ts',
    marker + "import { connection } from './edu.client';\nconst query = 'SELECT id FROM edu.transcripts';\n",
  );
  assert.equal(result.status, 0, result.output);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('export patterns reach platform forks while private modules remain checked', () => {
  const root = mkdtempSync(join(tmpdir(), 'moyo-barrels-'));
  try {
    for (const pkg of ['ui', 'app']) {
      const dir = join(root, 'packages', pkg);
      mkdirSync(join(dir, 'features/tutor'), { recursive: true });
      writeFileSync(join(dir, 'package.json'), JSON.stringify({
        exports: { '.': './index.ts', './features/*': './features/*' },
      }));
      writeFileSync(join(dir, 'index.ts'), 'export {};');
      writeFileSync(join(dir, 'features/tutor/local.native.ts'), 'export const local = true;');
      writeFileSync(join(dir, 'features/tutor/local.web.ts'), 'export const local = false;');
    }
    const check = () => spawnSync(process.execPath,
      [join(import.meta.dirname, 'check-barrels.mjs'), root], { encoding: 'utf8' });
    assert.equal(check().status, 0);
    writeFileSync(join(root, 'packages/ui/private.ts'), 'export const privateValue = true;');
    const result = check();
    assert.equal(result.status, 1);
    assert.match(result.stderr, /packages\/ui\/private\.ts/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

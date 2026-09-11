/**
 * The builder must not eat authored data, and a client budget must not count
 * files no client fetches.
 *
 * Both bugs are the same shape: a generated file was treated as a place to
 * store decisions. Rights blocks lived in the manifest the builder overwrites,
 * so a rebuild deleted them; and every manifest row was assumed to be a
 * download, so a 352 MB motion corpus counted against a phone's 4 MB budget.
 *
 * SOT: ../tools/build_asset_manifest.mjs · ../assets/asset-ledger.json
 * SOT-KEYWORDS: asset ledger builder idempotence rights delivery budget pipeline-source pending
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { assetsForTier, downloadBytesForTier, validateManifest, type AssetManifest } from './assets.ts';

const pkg = new URL('../', import.meta.url).pathname;
const build = (out: string): AssetManifest => {
  execFileSync('node', ['tools/build_asset_manifest.mjs', '--out', out], { cwd: pkg, stdio: 'pipe' });
  return JSON.parse(readFileSync(out, 'utf8')) as AssetManifest;
};

describe('the asset manifest builder', () => {
  it('is idempotent — a second build changes nothing', () => {
    const a = join(tmpdir(), `moyo-manifest-a-${process.pid}.json`);
    const b = join(tmpdir(), `moyo-manifest-b-${process.pid}.json`);
    try {
      build(a);
      build(b);
      assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'));
    } finally {
      rmSync(a, { force: true });
      rmSync(b, { force: true });
    }
  });

  it('carries the authored rights through a rebuild', () => {
    const out = join(tmpdir(), `moyo-manifest-r-${process.pid}.json`);
    try {
      const manifest = build(out);
      for (const id of ['lash-strands', 'staystill-idle-corpus']) {
        const entry = manifest.assets.find((a) => a.id === id);
        assert.ok(entry, `${id} vanished from the manifest`);
        assert.ok(entry.rights, `${id} lost its rights block on rebuild — this is the bug`);
        assert.ok(entry.rights.license.length > 0);
      }
    } finally {
      rmSync(out, { force: true });
    }
  });

  it('says it is generated, so nobody edits it by hand', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../assets/avatar-manifest.json', import.meta.url), 'utf8'),
    ) as AssetManifest & { $generated?: string };
    assert.match(manifest.$generated ?? '', /DO NOT EDIT/);
  });

  it('classes every asset — an unclassified one is a decision nobody made', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../assets/avatar-manifest.json', import.meta.url), 'utf8'),
    ) as AssetManifest;
    const unclassed = manifest.assets.filter((a) => !a.delivery).map((a) => a.id);
    assert.deepEqual(unclassed, []);
    validateManifest(manifest);
  });

  it('keeps a pipeline source out of every client budget', () => {
    const manifest = JSON.parse(
      readFileSync(new URL('../assets/avatar-manifest.json', import.meta.url), 'utf8'),
    ) as AssetManifest;
    const corpus = manifest.assets.find((a) => a.id === 'staystill-idle-corpus');
    assert.ok(corpus && corpus.bytes > 300_000_000, 'expected the 352 MB corpus');
    assert.equal(corpus.delivery, 'pipeline-source');

    for (const tier of ['phone', 'tablet', 'studio'] as const) {
      assert.ok(
        !assetsForTier(manifest, tier).some((a) => a.id === corpus.id),
        `${tier} would download a pipeline source`,
      );
    }
    /*
      The number this replaces was 354.08 MB against a 4 MB ceiling — a build
      failure describing a file no phone would ever ask for.
    */
    const phoneBundle = downloadBytesForTier(manifest, 'phone', 'bundle');
    assert.ok(phoneBundle < 4 * 1024 * 1024, `phone bundle is ${(phoneBundle / 1024 / 1024).toFixed(2)} MB`);
  });
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { verifyQuestApk } from './verify-quest-apk.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function archive(file, entries) {
  execFileSync('python3', ['-c', [
    'import base64, json, sys, zipfile',
    'with zipfile.ZipFile(sys.argv[1], "w") as archive:',
    '  for name, content in json.loads(sys.argv[2]): archive.writestr(name, base64.b64decode(content))',
  ].join('\n'), file, JSON.stringify(entries.map(([name, bytes]) => [name, Buffer.from(bytes).toString('base64')]))], { stdio: ['ignore', 'pipe', 'pipe'] });
}
async function fixture(t, { source = 'candidate renderer', packaged = source, manifest = true, duplicate = false } = {}) {
  const repoRoot = await mkdtemp(path.join(tmpdir(), 'moyo-apk-test-'));
  t.after(() => rm(repoRoot, { recursive: true, force: true }));
  await mkdir(path.join(repoRoot, 'apps/mobile/plugins'), { recursive: true });
  await mkdir(path.join(repoRoot, 'vendors'));
  const aarPath = path.join(repoRoot, 'vendors/renderer.aar');
  await archive(aarPath, [['jni/arm64-v8a/libviro_renderer.so', source]]);
  const aarSha = sha256(await readFile(aarPath));
  await writeFile(path.join(repoRoot, 'apps/mobile/plugins/renderer-pin.js'), `module.exports = ${JSON.stringify({ rendererPath: '../../../vendors/renderer.aar', rendererSha256: aarSha })};`);
  await writeFile(path.join(repoRoot, 'vendors/renderer.provenance.json'), JSON.stringify({
    file: 'renderer.aar', aar_sha256: aarSha, renderer_sha256: sha256(source), source_commit: 'a'.repeat(40),
  }));
  const apkPath = path.join(repoRoot, 'quest-debug.apk');
  const members = [['lib/arm64-v8a/libviro_renderer.so', packaged]];
  if (manifest) members.push(['AndroidManifest.xml', 'fixture manifest']);
  if (duplicate) members.push(['lib/arm64-v8a/libviro_renderer.so', 'old renderer']);
  await archive(apkPath, members);
  return { repoRoot, apkPath, sourceRevision: 'b'.repeat(40) };
}

test('records the exact packaged candidate and checkout without claiming device acceptance', async (t) => {
  const options = await fixture(t);
  const report = await verifyQuestApk(options);
  assert.equal(report.source_revision, options.sourceRevision);
  assert.equal(report.renderer_packaged_sha256, sha256('candidate renderer'));
  assert.equal(report.apk_sha256, sha256(await readFile(options.apkPath)));
  assert.equal(report.renderer_packaging_transform, 'identical');
  assert.equal(report.requires_metro, true);
  assert.match(report.device_acceptance, /not performed/);
});

test('rejects a previously built APK with the old renderer', async (t) => {
  await assert.rejects(verifyQuestApk(await fixture(t, { packaged: 'old renderer' })), /Packaged renderer differs/);
});

test('rejects a modified AAR even when an APK matches its original renderer', async (t) => {
  const options = await fixture(t);
  await archive(path.join(options.repoRoot, 'vendors/renderer.aar'), [['jni/arm64-v8a/libviro_renderer.so', 'modified renderer']]);
  await assert.rejects(verifyQuestApk(options), /AAR checksum mismatch/);
});

test('rejects missing manifests and ambiguous duplicate renderer entries', async (t) => {
  await assert.rejects(verifyQuestApk(await fixture(t, { manifest: false })), /Expected one AndroidManifest/);
  await assert.rejects(verifyQuestApk(await fixture(t, { duplicate: true })), /Expected one lib\/arm64-v8a\/libviro_renderer/);
});

test('accepts the reproducible strip transform and still rejects a different ELF', async (t) => {
  const build = await mkdtemp(path.join(tmpdir(), 'moyo-elf-test-'));
  t.after(() => rm(build, { recursive: true, force: true }));
  const cpp = path.join(build, 'renderer.cpp');
  const original = path.join(build, 'original.so');
  const stripped = path.join(build, 'stripped.so');
  await writeFile(cpp, 'extern "C" int renderer_version() { return 1; }\n');
  execFileSync('c++', ['-g', '-shared', '-fPIC', cpp, '-o', original]);
  execFileSync('strip', ['--strip-unneeded', '-o', stripped, original]);
  const options = await fixture(t, { source: await readFile(original), packaged: await readFile(stripped) });
  options.stripTool = 'strip';
  const report = await verifyQuestApk(options);
  assert.equal(report.renderer_packaging_transform, 'strip-unneeded');
  assert.notEqual(report.renderer_source_sha256, report.renderer_packaged_sha256);

  await writeFile(cpp, 'extern "C" int renderer_version() { return 2; }\n');
  execFileSync('c++', ['-g', '-shared', '-fPIC', cpp, '-o', original]);
  execFileSync('strip', ['--strip-unneeded', '-o', stripped, original]);
  await archive(options.apkPath, [['lib/arm64-v8a/libviro_renderer.so', await readFile(stripped)], ['AndroidManifest.xml', 'fixture manifest']]);
  await assert.rejects(verifyQuestApk(options), /APK does not contain the selected renderer/);
});

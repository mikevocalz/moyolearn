import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fileSha256(file) {
  const digest = createHash('sha256');
  for await (const bytes of createReadStream(file)) digest.update(bytes);
  return digest.digest('hex');
}

function archiveMember(archive, member) {
  const entries = execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8' }).trim().split('\n');
  assert.equal(entries.filter((entry) => entry === member).length, 1, `Expected one ${member} in ${archive}`);
  return execFileSync('unzip', ['-p', archive, member], { maxBuffer: 128 * 1024 * 1024 });
}

/** Verify the APK's actual renderer against the selected, immutable AAR. */
export async function verifyQuestApk({ repoRoot = defaultRoot, apkPath, stripTool, sourceRevision }) {
  const { rendererPath, rendererSha256 } = require(path.join(repoRoot, 'apps/mobile/plugins/renderer-pin.js'));
  const aarPath = path.resolve(repoRoot, 'apps/mobile/android', rendererPath);
  const provenancePath = aarPath.replace(/\.aar$/, '.provenance.json');
  assert.notEqual(provenancePath, aarPath, 'Renderer pin must select an AAR');
  const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
  assert.equal(path.basename(aarPath), provenance.file, 'Renderer provenance filename differs from the selected pin');
  assert.equal(await fileSha256(aarPath), rendererSha256, 'Selected renderer AAR checksum mismatch');
  assert.equal(rendererSha256, provenance.aar_sha256, 'Selected renderer pin and provenance disagree');

  const sourceRenderer = archiveMember(aarPath, 'jni/arm64-v8a/libviro_renderer.so');
  assert.equal(sha256(sourceRenderer), provenance.renderer_sha256, 'Renderer member checksum differs from provenance');
  const packagedRenderer = archiveMember(apkPath, 'lib/arm64-v8a/libviro_renderer.so');
  const packagedSha = sha256(packagedRenderer);
  let transform = 'identical';
  if (packagedSha !== provenance.renderer_sha256) {
    // AGP may strip symbols during packaging. Reproduce that exact transform;
    // do not accept an arbitrary library just because its filename matches.
    assert.ok(stripTool, 'Packaged renderer differs from the selected AAR; a pinned NDK strip tool is required');
    const temporary = await mkdtemp(path.join(tmpdir(), 'moyo-renderer-verify-'));
    try {
      const input = path.join(temporary, 'source.so');
      const output = path.join(temporary, 'stripped.so');
      await writeFile(input, sourceRenderer);
      execFileSync(stripTool, ['--strip-unneeded', '-o', output, input]);
      assert.equal(packagedSha, await fileSha256(output), 'APK does not contain the selected renderer, including after NDK stripping');
      transform = 'strip-unneeded';
    } finally {
      await rm(temporary, { recursive: true, force: true });
    }
  }
  archiveMember(apkPath, 'AndroidManifest.xml');
  return {
    source_revision: sourceRevision ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    apk: path.relative(repoRoot, apkPath),
    apk_sha256: await fileSha256(apkPath),
    renderer_source_commit: provenance.source_commit,
    renderer_aar: path.relative(repoRoot, aarPath),
    renderer_aar_sha256: rendererSha256,
    renderer_source_sha256: provenance.renderer_sha256,
    renderer_packaged_sha256: packagedSha,
    renderer_packaging_transform: transform,
    requires_metro: true,
    device_acceptance: 'not performed by this packaging check',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: {
      apk: { type: 'string' },
      'strip-tool': { type: 'string' },
      output: { type: 'string' },
    } });
    assert.ok(values.apk && values.output, 'Usage: node tooling/verify-quest-apk.mjs --apk <APK> --output <JSON> [--strip-tool <llvm-strip>]');
    const report = await verifyQuestApk({ apkPath: path.resolve(values.apk), stripTool: values['strip-tool'] });
    await writeFile(values.output, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

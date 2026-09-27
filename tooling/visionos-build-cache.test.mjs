import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { hasVisionOSBuild, visionOSBuildKey } from './visionos-build-cache.mjs';

const toolchain = { coreCommit: 'abc', xcode: 'Xcode 26.6\nBuild version 17F113', deviceSDK: '26.5', simulatorSDK: '26.5' };
test('source, Xcode build, and both SDKs identify native output', () => {
  const key = visionOSBuildKey(toolchain);
  assert.equal(key, visionOSBuildKey({ ...toolchain, deviceSDK: '26.5\n' }));
  for (const field of Object.keys(toolchain)) {
    assert.notEqual(key, visionOSBuildKey({ ...toolchain, [field]: 'changed' }));
  }
});
test('interrupted or incomplete output never qualifies as a cached build', (t) => {
  const output = mkdtempSync(join(tmpdir(), 'visionos-cache-'));
  t.after(() => rmSync(output, { recursive: true, force: true }));
  const key = visionOSBuildKey(toolchain);
  mkdirSync(join(output, 'ViroKit.xcframework'));
  for (const file of ['source-commit', 'ViroKit.xcframework/Info.plist', 'ViroShadersSource.txt']) {
    assert.equal(hasVisionOSBuild(output, key), false);
    writeFileSync(join(output, file), file === 'source-commit' ? key : 'fixture');
  }
  assert.equal(hasVisionOSBuild(output, key), true);
  assert.equal(hasVisionOSBuild(output, visionOSBuildKey({ ...toolchain, xcode: 'new' })), false);
  rmSync(join(output, 'ViroShadersSource.txt'));
  assert.equal(hasVisionOSBuild(output, key), false);
});

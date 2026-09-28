import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// A source SHA alone cannot identify native output: changing Xcode or either SDK
// requires a new framework, and interrupted builds must never look complete.
export function visionOSBuildKey({ coreCommit, xcode, deviceSDK, simulatorSDK }) {
  return JSON.stringify({ coreCommit, xcode: xcode.trim(), deviceSDK: deviceSDK.trim(), simulatorSDK: simulatorSDK.trim() });
}

export function hasVisionOSBuild(output, key) {
  const required = [
    'source-commit',
    'ViroKit.xcframework/Info.plist',
    'ViroShadersSource.txt',
  ];
  return required.every((path) => existsSync(join(output, path))) &&
    readFileSync(join(output, 'source-commit'), 'utf8').trim() === key;
}

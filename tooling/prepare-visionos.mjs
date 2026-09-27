import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { hasVisionOSBuild, visionOSBuildKey } from './visionos-build-cache.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mobile = join(root, 'apps/mobile');
const require = createRequire(join(mobile, 'package.json'));
const coreCommit = 'd4e098408a7f2a2ea4eda134ba8702a41179a228';
function run(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, { cwd, stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(command + ' failed: ' + result.status);
  return result.stdout;
}
if (process.platform !== 'darwin') throw new Error('visionOS preparation requires macOS and Xcode with the visionOS SDK.');
const buildKey = visionOSBuildKey({
  coreCommit,
  xcode: run('xcodebuild', ['-version'], root, true),
  deviceSDK: run('xcrun', ['--sdk', 'xros', '--show-sdk-version'], root, true),
  simulatorSDK: run('xcrun', ['--sdk', 'xrsimulator', '--show-sdk-version'], root, true),
});
const viro = dirname(require.resolve('@reactvision/react-viro/package.json'));
const renderer = join(viro, 'ios/dist/ViroRendererVisionOS');
const cache = join(root, '.cache/visionos');
const core = join(cache, 'virocore');
const output = join(cache, 'viro/ios/dist/ViroRendererVisionOS');
mkdirSync(output, { recursive: true });
if (!existsSync(join(core, '.git'))) {
  mkdirSync(core, { recursive: true });
  run('git', ['init'], core);
  run('git', ['remote', 'add', 'origin', 'https://github.com/mikevocalz/virocore.git'], core);
}
const stamp = join(output, 'source-commit');
if (!hasVisionOSBuild(output, buildKey)) {
  rmSync(stamp, { force: true });
  run('git', ['fetch', '--depth=1', 'origin', coreCommit], core);
  run('git', ['checkout', '--detach', 'FETCH_HEAD'], core);
  run('bash', ['build_visionos.sh', 'Release'], join(core, 'ios'));
  if (!existsSync(join(output, 'ViroKit.xcframework/Info.plist')) ||
      !existsSync(join(output, 'ViroShadersSource.txt'))) {
    throw new Error('ViroKit build did not produce both the framework and shader source.');
  }
  writeFileSync(stamp, buildKey + '\n');
}
// Replace the old framework so removed SDK slices/headers cannot linger.
rmSync(join(renderer, 'ViroKit.xcframework'), { recursive: true, force: true });
mkdirSync(renderer, { recursive: true });
cpSync(join(output, 'ViroKit.xcframework'), join(renderer, 'ViroKit.xcframework'), { recursive: true, force: true });
cpSync(join(output, 'ViroShadersSource.txt'), join(renderer, 'ViroShadersSource.txt'));
run('pod', ['install'], join(mobile, 'visionos'));


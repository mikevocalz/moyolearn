// Offline contracts for diagnostics that must never change the native build gate.
// SOT: tooling/run-with-resource-heartbeat.sh
// SOT-KEYWORDS: android native runner resource heartbeat diagnostics tests
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tooling = dirname(fileURLToPath(import.meta.url));
const script = join(tooling, 'run-with-resource-heartbeat.sh');
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'moyo-heartbeat-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, 'bin'); mkdirSync(bin);
  for (const name of ['date', 'free', 'df', 'ps']) {
    writeFileSync(join(bin, name), `#!/bin/bash\nprintf '%s\\n' "$*" > '${root}/${name}.args'\nprintf '${name}-snapshot\\n'\n`, { mode: 0o755 });
  }
  writeFileSync(join(bin, 'sleep'), `#!/bin/bash\nprintf '%s\\n' "$$" > '${root}/pause.pid'\nexec /bin/sleep 300\n`, { mode: 0o755 });
  const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, PRIVATE_SENTINEL: 'secret-environment-value' };
  const waitForSampler = `for ((i=0; i<100; i++)); do [[ -f '${root}/pause.pid' ]] && break; /bin/sleep 0.02; done; [[ -f '${root}/pause.pid' ]] || exit 91; `;
  return { root, env, waitForSampler };
}
function assertStopped(root) {
  const pid = Number(readFileSync(join(root, 'pause.pid'), 'utf8'));
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
}

test('preserves success, command arguments and stdout without exposing arguments or environment', (t) => {
  const f = fixture(t);
  const result = spawnSync('bash', [script, 'bash', '-c', `${f.waitForSampler}[[ "$1" == 'private command argument' ]] || exit 92; printf 'build-output\\n'`, 'build', 'private command argument'], { env: f.env, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /resource-heartbeat:/);
  assert.match(result.stdout, /build-output/);
  assert.doesNotMatch(result.stdout + result.stderr, /private command argument|secret-environment-value/);
  assert.equal(readFileSync(join(f.root, 'ps.args'), 'utf8'), '-eo comm=,rss= --sort=-rss\n');
  assertStopped(f.root);
});
test('preserves nonzero build exit status and cleans up the sampler', (t) => {
  const f = fixture(t);
  const result = spawnSync('bash', [script, 'bash', '-c', `${f.waitForSampler}exit 23`], { env: f.env, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 23, result.stderr);
  assertStopped(f.root);
});
test('diagnostic command failure does not fail an otherwise successful build', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.root, 'bin/free'), '#!/bin/bash\nexit 17\n', { mode: 0o755 });
  const result = spawnSync('bash', [script, 'bash', '-c', `${f.waitForSampler}exit 0`], { env: f.env, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assertStopped(f.root);
});
for (const [signal, status] of [['SIGTERM', 143], ['SIGINT', 130]]) test(`${signal} is forwarded to the build and stops the sampler with signal exit status`, async (t) => {
  const f = fixture(t);
  const child = spawn('bash', [script, 'bash', '-c', `${f.waitForSampler}echo $$ > '${f.root}/build.pid'; exec /bin/sleep 300`], { env: f.env, stdio: 'ignore' });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  const completion = once(child, 'exit');
  for (let i = 0; i < 100 && !existsSync(join(f.root, 'build.pid')); i += 1) await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(existsSync(join(f.root, 'build.pid')), true);
  child.kill(signal);
  assert.deepEqual(await completion, [status, null]);
  const pid = Number(readFileSync(join(f.root, 'build.pid'), 'utf8'));
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  assertStopped(f.root);
});
test('rejects a missing command and keeps the workflow assembly gate intact', () => {
  assert.equal(spawnSync('bash', [script]).status, 64);
  const workflow = readFileSync(join(tooling, '../.github/workflows/android-native.yml'), 'utf8');
  assert.match(workflow, /run: bash "\$GITHUB_WORKSPACE\/tooling\/run-with-resource-heartbeat\.sh" bash gradlew :app:assembleQuestDebug --stacktrace --max-workers=1 --no-parallel -PreactNativeArchitectures=arm64-v8a '-Dorg\.gradle\.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=1g'/);
  assert.doesNotMatch(workflow, /continue-on-error/);
});

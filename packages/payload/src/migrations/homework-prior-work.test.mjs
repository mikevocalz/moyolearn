// Runs checked-in SQL on an isolated local PostgreSQL 18 cluster. Never loads .env.
// Run: node --test packages/payload/src/migrations/homework-prior-work.test.mjs
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statfsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const binaryDirectory = process.env.MOYO_PG_TEST_BIN ?? '/opt/homebrew/opt/postgresql@18/bin';
const binary = (name) => join(binaryDirectory, name);
const fixtures = new URL('./fixtures/', import.meta.url);
const migrations = new URL('../../migrations/', import.meta.url);
const fixture = (name) => readFileSync(new URL(name, fixtures), 'utf8');
const migration = (name) => readFileSync(new URL(name, migrations), 'utf8');

test('prior-work SQL preserves legacy data and guardian marks on a scratch-only PostgreSQL 18 rerun', {
  skip: ['postgres', 'initdb', 'pg_ctl', 'psql'].every((name) => existsSync(binary(name)))
    ? false : 'local PostgreSQL 18 binaries unavailable; set MOYO_PG_TEST_BIN',
}, (t) => {
  const disk = statfsSync('/private/tmp');
  assert.ok(disk.bavail * disk.bsize >= 1_250_000_000, 'need at least 1.25 GB free before initializing scratch cluster');
  const scratch = mkdtempSync('/private/tmp/moyo-homework-scratch-');
  const data = join(scratch, 'data');
  const socket = join(scratch, 'socket');
  mkdirSync(socket, { mode: 0o700 });
  const port = String(randomInt(49152, 65000));
  // Explicitly omit inherited PG/DATABASE variables and disable password/service files.
  const env = {
    PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', TZ: 'UTC',
    PGPASSFILE: '/dev/null', PGSERVICEFILE: '/dev/null', PGSYSCONFDIR: scratch,
  };
  const run = (name, args, input) => {
    const result = spawnSync(binary(name), args, { env, input, encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.error, undefined, `${name} failed: ${result.error?.message ?? ''}`);
    assert.equal(result.status, 0, `${name} exited ${result.status}\n${result.stdout}\n${result.stderr}`);
    return result.stdout.trim();
  };
  let cleanShutdown = true;
  let succeeded = false;
  try {
    const version = run('postgres', ['--version']);
    assert.match(version, /PostgreSQL\) 18\./);
    t.diagnostic(version);
    t.diagnostic(`private cluster=${scratch}; Unix socket only; port=${port}; no inherited connection environment`);
    run('initdb', ['-D', data, '--username=moyo_scratch', '--auth-local=trust', '--auth-host=reject', '--locale=C', '--encoding=UTF8', '--no-instructions']);
    run('pg_ctl', ['start', '-D', data, '-l', join(scratch, 'postgres.log'), '-w', '-t', '20', '-o',
      `-c listen_addresses='' -c unix_socket_directories=${socket} -p ${port} -c shared_buffers=16MB -c max_connections=10`]);
    const sql = [
      fixture('homework-admin-lock.sql'),
      migration('homework_additive.sql'),
      fixture('homework-legacy.sql'),
      migration('homework_prior_work_additive.sql'),
      fixture('homework-prior-work-assert.sql'),
      migration('homework_prior_work_additive.sql'),
      fixture('homework-prior-work-rerun-assert.sql'),
    ].join('\n');
    const output = run('psql', ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-h', socket, '-p', port,
      '-U', 'moyo_scratch', '-d', 'postgres', '-f', '-'], sql);
    assert.match(output, /PASS: legacy defaults/);
    t.diagnostic(output);
    t.diagnostic(`bootstrap fixture=${fileURLToPath(new URL('homework-admin-lock.sql', fixtures))}; full Payload bootstrap not claimed`);
    succeeded = true;
  } finally {
    // The path was minted by this test; never stop a shared/user PostgreSQL service.
    if (existsSync(join(data, 'postmaster.pid'))) {
      const stopped = spawnSync(binary('pg_ctl'), ['stop', '-D', data, '-m', 'fast', '-w', '-t', '20'], {
        env, encoding: 'utf8', timeout: 30_000,
      });
      cleanShutdown = stopped.status === 0 && !stopped.error;
      assert.ok(cleanShutdown, `scratch shutdown failed; inspect ${scratch}`);
      t.diagnostic('scratch PostgreSQL stopped cleanly');
    }
    if (cleanShutdown && succeeded) rmSync(scratch, { recursive: true, force: true });
  }
});

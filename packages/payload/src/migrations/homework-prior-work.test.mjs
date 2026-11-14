// Runs checked-in SQL on an isolated local PostgreSQL cluster. Never loads .env.
// Run: node --test packages/payload/src/migrations/homework-prior-work.test.mjs
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statfsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const requiredBinaries = ['postgres', 'initdb', 'pg_ctl', 'psql'];
const pgConfig = spawnSync('pg_config', ['--bindir'], { encoding: 'utf8', timeout: 5_000 });
const linuxDirectories = existsSync('/usr/lib/postgresql')
  ? readdirSync('/usr/lib/postgresql').sort((a, b) => Number(b) - Number(a)).map((version) => `/usr/lib/postgresql/${version}/bin`)
  : [];
const candidates = process.env.MOYO_PG_TEST_BIN ? [process.env.MOYO_PG_TEST_BIN] : [
  ...(pgConfig.status === 0 ? [pgConfig.stdout.trim()] : []),
  ...linuxDirectories,
  '/opt/homebrew/opt/postgresql@18/bin', '/usr/local/opt/postgresql@18/bin',
];
const binaryDirectory = candidates.find((directory) =>
  requiredBinaries.every((name) => existsSync(join(directory, name))),
);
const binary = (name) => join(binaryDirectory, name);
const fixtures = new URL('./fixtures/', import.meta.url);
const migrations = new URL('../../migrations/', import.meta.url);
const fixture = (name) => readFileSync(new URL(name, fixtures), 'utf8');
const migration = (name) => readFileSync(new URL(name, migrations), 'utf8');
const mode = process.env.MOYO_PG_TEST_MODE ?? 'socket';

test('prior-work SQL preserves legacy data, guardian marks and crop retention on an isolated PostgreSQL rerun', {
  skip: binaryDirectory || process.env.MOYO_PG_TEST_REQUIRED === '1'
    ? false : 'local PostgreSQL binaries unavailable; set MOYO_PG_TEST_BIN',
}, (t) => {
  assert.ok(binaryDirectory, 'PostgreSQL is required for this run; install it or set MOYO_PG_TEST_BIN');
  assert.ok(mode === 'socket' || mode === 'single', 'MOYO_PG_TEST_MODE must be socket or single');
  assert.ok(mode !== 'single' || process.env.MOYO_PG_TEST_REPOSITORY !== '1',
    'repository concurrency checks require socket mode; single-user mode proves SQL only');
  const temporaryDirectory = tmpdir();
  const disk = statfsSync(temporaryDirectory);
  assert.ok(disk.bavail * disk.bsize >= 1_250_000_000, 'need at least 1.25 GB free before initializing scratch cluster');
  const scratch = mkdtempSync(join(temporaryDirectory, 'moyo-homework-'));
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
    return `${result.stdout}\n${result.stderr}`.trim();
  };
  let cleanShutdown = true;
  let succeeded = false;
  try {
    const version = run('postgres', ['--version']);
    const major = Number(version.match(/PostgreSQL\) (\d+)\./)?.[1]);
    assert.ok(major >= 16, `PostgreSQL 16 or newer is required; found ${version}`);
    t.diagnostic(version);
    t.diagnostic(`private cluster=${scratch}; mode=${mode}; no inherited connection environment`);
    run('initdb', ['-D', data, '--username=moyo_scratch', '--auth-local=trust', '--auth-host=reject', '--locale=C', '--encoding=UTF8', '--no-instructions']);
    const sql = [
      fixture('homework-admin-lock.sql'),
      migration('homework_additive.sql'),
      fixture('homework-legacy.sql'),
      migration('homework_prior_work_additive.sql'),
      fixture('homework-prior-work-assert.sql'),
      migration('homework_prior_work_additive.sql'),
      fixture('homework-prior-work-rerun-assert.sql'),
      fixture('homework-prior-work-retention-setup.sql'),
      readFileSync(new URL('../retention/sweep.sql', import.meta.url), 'utf8'),
      fixture('homework-prior-work-retention-assert.sql'),
    ].join('\n');
    let output;
    if (mode === 'single') {
      // No listening process or socket. -j uses semicolon plus two newlines as
      // its command delimiter, so remove blank lines inside PL/pgSQL blocks.
      const batch = `BEGIN;\n${sql}\nCOMMIT;`.replace(/\n(?:[ \t]*\n)+/g, '\n');
      output = run('postgres', ['--single', '-D', data, '-j', 'postgres'], `${batch}\n\n`);
      assert.doesNotMatch(output, /\b(?:ERROR|FATAL|PANIC):/, 'single-user PostgreSQL reported an SQL error');
    } else {
      run('pg_ctl', ['start', '-D', data, '-l', join(scratch, 'postgres.log'), '-w', '-t', '20', '-o',
        `-c listen_addresses='' -c unix_socket_directories='${socket.replaceAll("'", "'\\''")}' -p ${port} -c shared_buffers=16MB -c max_connections=10`]);
      output = run('psql', ['-X', '-w', '-v', 'ON_ERROR_STOP=1', '-h', socket, '-p', port,
        '-U', 'moyo_scratch', '-d', 'postgres', '-f', '-'], sql);
    }
    assert.match(output, /PASS: legacy defaults/);
    assert.match(output, /PASS: expired crop removed/);
    t.diagnostic(output);
    if (process.env.MOYO_PG_TEST_REPOSITORY === '1') {
      const result = spawnSync(process.execPath, ['--experimental-vm-modules',
        fileURLToPath(new URL('homework-repository-check.mjs', fixtures)), socket, port],
      { env, encoding: 'utf8', timeout: 60_000 });
      assert.equal(result.error, undefined, `repository check failed: ${result.error?.message ?? ''}`);
      assert.equal(result.status, 0, `repository check exited ${result.status}\n${result.stdout}\n${result.stderr}`);
      assert.equal(result.stdout.match(/^PASS:/gm)?.length, 5, 'all repository scenarios must execute');
      t.diagnostic(result.stdout.trim());
    }
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

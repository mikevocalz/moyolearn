#!/usr/bin/env node
/**
 * Registry-backed inventory of ALL tracked workspace package dependencies.
 * Read-only with respect to npm; optional --write writes an audit Markdown file.
 * Does not edit dependency pins or override carefully reviewed native forks.
 *
 * Run from the monorepo root on a networked machine:
 *   node tooling/audit-npm-latest.mjs --write
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/architecture/npm-latest-audit-2026-11-02.md');
const EXCLUDE_SPECS = /^(?:catalog:|workspace:|file:|link:|git\+|https?:|npm:)/;
const RELEASE_FAMILIES = new Map([
  ['payload', 'Payload 4 beta family'],
  ['@payloadcms/db-postgres', 'Payload 4 beta family'],
  ['@payloadcms/next', 'Payload 4 beta family'],
  ['@payloadcms/plugin-mcp', 'Payload 4 beta family'],
  ['@payloadcms/ui', 'Payload 4 beta family'],
  ['@payloadcms/tanstack-start', 'Payload 4 beta family'],
  ['@delmaredigital/payload-better-auth', 'Payload 4 next adapter'],
  ['react-native-nitro-modules', 'Nitro alpha / vendored forks'],
  ['nitro-core', 'Nitro alpha / vendored forks'],
  ['nitrogen', 'Nitro alpha / vendored forks'],
]);

function packageJsonPaths() {
  return ['apps', 'packages'].flatMap(dir =>
    readdirSync(join(ROOT, dir), { withFileTypes: true })
      .filter(entry => entry.isDirectory()).map(entry => join(ROOT, dir, entry.name, 'package.json'))
  );
}

function parseCatalog(text) {
  const result = new Map();
  const lines = text.slice(text.indexOf('\ncatalog:') + 9).split(/\r?\n/);
  for (const line of lines) {
    const match = /^  (?:"([^"]+)"|([@\w./-]+)):\s+([^\s#]+)/.exec(line);
    if (!match) continue;
    result.set(match[1] ?? match[2], match[3]);
  }
  return result;
}

function findPinnedPackages() {
  const catalog = parseCatalog(readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8'));
  const packagePin = new Map(catalog);
  for (const filename of packageJsonPaths()) {
    let manifest;
    try { manifest = JSON.parse(readFileSync(filename, 'utf8')); }
    catch { continue; }
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, version] of Object.entries(manifest[section] ?? {})) {
        if (typeof version !== 'string' || EXCLUDE_SPECS.test(version)) continue;
        if (!packagePin.has(name)) packagePin.set(name, version);
      }
    }
  }
  return packagePin;
}

export function catalogRows(catalog) {
  return [...catalog.entries()].map(([name, current]) => ({ name, current }));
}

export async function lookupLatest(name, fetchImpl = fetch) {
  const url = 'https://registry.npmjs.org/' + encodeURIComponent(name) + '/latest';
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/vnd.npm.install-v1+json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const body = await response.json();
  if (!body || typeof body.version !== 'string') throw new Error('missing version');
  return body.version;
}

export function renderAudit(rows) {
  const escaped = value => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
  const lines = [
    '# Moyo npm release audit — ' + new Date().toISOString().slice(0, 10),
    '',
    'Source: npm registry /latest dist-tag. Reports versions, does not upgrade code.',
    'Payload 4, its adapter, Nitro alpha and other native forks require compatible release families rather than bare npm latest. A mismatch is a review request, not automatic approval.',
    '',
    '| Package | Current pin | npm latest | Assessment |',
    '| --- | --- | --- | --- |',
  ];
  for (const row of rows) {
    const note = RELEASE_FAMILIES.get(row.name);
    const status = row.error ? 'Registry lookup failed'
      : row.latest === row.current ? 'Current'
      : note ? 'Special track: ' + note
      : 'Review upgrade';
    lines.push('| ' + [row.name, row.current, row.latest ?? 'Unknown', status].map(escaped).join(' | ') + ' |');
  }
  lines.push('', 'These rows are informational. Native and auth migrations require full CI, device builds, data-schema reviews and the approved frozen lockfile.', '');
  return lines.join('\n');
}

async function main() {
  const packagePins = findPinnedPackages();
  const items = catalogRows(packagePins).sort((a, b) => a.name.localeCompare(b.name));
  const results = [];
  // Avoid hundreds of simultaneous registry requests.
  for (let i = 0; i < items.length; i += 6) {
    const chunk = await Promise.all(items.slice(i, i + 6).map(async entry => {
      try { return { ...entry, latest: await lookupLatest(entry.name) }; }
      catch (error) { return { ...entry, error: error instanceof Error ? error.message : 'Unknown' }; }
    }));
    results.push(...chunk);
  }
  const report = renderAudit(results);
  if (process.argv.includes('--write')) writeFileSync(OUT, report);
  else console.log(report);
  console.error('Checked', results.length, 'npm package pins; current:',
    results.filter(x => x.latest === x.current).length, 'lookup failures:', results.filter(x => x.error).length);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

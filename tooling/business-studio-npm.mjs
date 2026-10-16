// Latest means the npm registry's stable latest tag, resolved before installation.
// SOT: docs/business/npm-policy.md
// SOT-KEYWORDS: business studio dependency npm latest catalog evidence
import { readFile, writeFile, mkdir, glob } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const TARGETS = Object.freeze([
  'react-native-gesture-handler', 'react-native-reanimated', 'react-native-worklets',
  'react-native-skia', 'react-native-webgpu', 'typegpu',
  'react-native-skia-graphite-android', 'react-native-skia-graphite-apple-ios',
  'react-native-skia-graphite-apple-macos',
]);
const REQUIRED = TARGETS.slice(0, 3);
const STABLE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function packageReceipt(name, data, checkedAt) {
  if (!data || data.name !== name || !STABLE.test(data.version ?? '')) {
    throw new Error(`${name}: latest did not resolve to an exact stable version`);
  }
  if (data.deprecated) throw new Error(`${name}: latest is deprecated`);
  const integrity = data.dist?.integrity ?? '';
  const digest = integrity.startsWith('sha512-') ? integrity.slice(7) : '';
  const decoded = Buffer.from(digest, 'base64');
  if (!/^[A-Za-z0-9+/]{86}==$/.test(digest) || decoded.byteLength !== 64 || decoded.toString('base64') !== digest) {
    throw new Error(`${name}: invalid SHA-512 distribution integrity`);
  }
  const tarball = new URL(data.dist.tarball);
  if (tarball.origin !== 'https://registry.npmjs.org' || tarball.username || tarball.password) {
    throw new Error(`${name}: unexpected tarball origin`);
  }
  return {
    name, version: data.version, tag: 'latest', checkedAt,
    registry: `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`,
    integrity: data.dist.integrity, tarball: tarball.href,
    peerDependencies: data.peerDependencies ?? {}, engines: data.engines ?? {},
  };
}

export function updateCatalog(source, receipts) {
  // Deliberately bounded to the default catalog; refuse aliases/duplicate entries
  // rather than interpreting arbitrary YAML or rewriting unrelated SDK pins.
  const lines = source.split('\n');
  const begin = lines.findIndex((line) => line === 'catalog:');
  if (begin < 0) throw new Error('Default pnpm catalog not found');
  let end = lines.findIndex((line, index) => index > begin && /^[^\s#]/.test(line));
  if (end < 0) end = lines.length;
  const changes = [];
  for (const receipt of receipts) {
    const matches = [];
    for (let index = begin + 1; index < end; index += 1) {
      const match = /^(  )(?:(['"])([^'"]+)\2|([^\s:]+)):\s+([^\s#]+)(.*)$/.exec(lines[index]);
      if (match && (match[3] ?? match[4]) === receipt.name) matches.push({ index, match });
    }
    if (matches.length > 1) throw new Error(`${receipt.name}: duplicate catalog entries`);
    if (!matches.length) {
      if (REQUIRED.includes(receipt.name)) throw new Error(`${receipt.name}: required catalog entry missing`);
      changes.push({ name: receipt.name, previous: null, latest: receipt.version, installed: false });
      continue;
    }
    const { index, match } = matches[0];
    const key = match[2] ? `${match[2]}${receipt.name}${match[2]}` : receipt.name;
    changes.push({ name: receipt.name, previous: match[5], latest: receipt.version, installed: true });
    lines[index] = `  ${key}: ${receipt.version}${match[6]}`;
  }
  return { source: lines.join('\n'), changes };
}

// Every installed target must resolve through the audited default catalog.
// Direct pins and overrides otherwise bypass freshness even when the receipt
// correctly names npm latest. Peer ranges do not install packages by themselves.
export function validateManifestTargets(manifests, catalog) {
  for (const { path, manifest } of manifests) {
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
      for (const [name, specifier] of Object.entries(manifest[field] ?? {})) {
        if (!TARGETS.includes(name)) continue;
        const entry = catalog.find((item) => item.name === name);
        if (specifier !== 'catalog:' || !entry?.installed) {
          throw new Error(`${path}: ${name} must use an existing default catalog entry, not ${specifier}`);
        }
      }
    }
    for (const [selector, specifier] of Object.entries(manifest.pnpm?.overrides ?? {})) {
      if (TARGETS.some((name) => selector.split('>').some((part) => part.trim() === name || part.trim().startsWith(`${name}@`)))) {
        if (path === 'package.json' && TARGETS.includes(selector) && specifier === 'catalog:' && catalog.some((entry) => entry.name === selector && entry.installed)) continue;
        throw new Error(`${path}: override ${selector} bypasses studio catalog freshness`);
      }
    }
  }
}

// Frozen installs detect catalog/manifest drift, but they can still install
// an older optional peer alongside the exact latest version. Audit the resolved
// package section as well so all installed copies obey the same admission.
export function validateLockedTargets(source, receipts) {
  const packages = source.split('\npackages:\n')[1]?.split('\nsnapshots:\n')[0];
  if (!packages) throw new Error('pnpm lockfile package section not found');
  for (const line of packages.split('\n')) {
    const match = /^  (?:'([^']+)'|"([^"]+)"|([^\s:]+)):$/.exec(line);
    if (!match) continue;
    const key = match[1] ?? match[2] ?? match[3];
    for (const receipt of receipts) {
      if (key.startsWith(`${receipt.name}@`) && key !== `${receipt.name}@${receipt.version}`) {
        throw new Error(`${receipt.name}: lockfile contains nonlatest installed copy ${key}`);
      }
    }
  }
}

// The committed evidence must describe the same packages as today's registry
// and catalog. Historical previous pins and timestamps may differ, package
// identity, distribution integrity and requirements may not.
export function validateSavedReceipt(saved, receipts, catalog) {
  if (saved?.schema !== 1 || saved.tag !== 'latest' || typeof saved.checkedAt !== 'string' || !Number.isFinite(Date.parse(saved.checkedAt)) || !Array.isArray(saved.packages) || !Array.isArray(saved.catalog)) {
    throw new Error('Invalid committed npm receipt envelope');
  }
  if (saved.packages.length !== receipts.length || new Set(saved.packages.map((item) => item.name)).size !== receipts.length || saved.catalog.length !== catalog.length || new Set(saved.catalog.map((item) => item.name)).size !== catalog.length) {
    throw new Error('Committed npm receipt has missing or duplicate targets');
  }
  const requirements = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.values(value).some((item) => typeof item !== 'string')) throw new Error('Invalid package requirements in npm receipt');
    return Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  };
  for (const live of receipts) {
    const entry = saved.packages.find((item) => item.name === live.name);
    if (!entry || entry.checkedAt !== saved.checkedAt || entry.tag !== 'latest' || ['version', 'registry', 'integrity', 'tarball'].some((field) => entry[field] !== live[field]) || JSON.stringify(requirements(entry.peerDependencies)) !== JSON.stringify(requirements(live.peerDependencies)) || JSON.stringify(requirements(entry.engines)) !== JSON.stringify(requirements(live.engines))) {
      throw new Error(`${live.name}: committed npm receipt does not match registry evidence`);
    }
    const recorded = saved.catalog.find((item) => item.name === live.name);
    const current = catalog.find((item) => item.name === live.name);
    if (!recorded || !current || recorded.latest !== current.latest || recorded.installed !== current.installed || !(recorded.previous === null || typeof recorded.previous === 'string')) {
      throw new Error(`${live.name}: committed npm receipt does not match catalog admission`);
    }
  }
}

export async function fetchReceipt(name, fetcher = fetch, now = new Date().toISOString()) {
  const response = await fetcher(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, {
    redirect: 'error', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok || !response.body) throw new Error(`${name}: npm returned ${response.status}`);
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 512_000) throw new Error(`${name}: oversized registry response`);
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return packageReceipt(name, JSON.parse(Buffer.concat(chunks).toString('utf8')), now);
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1 || !['--check', '--write'].includes(args[0])) {
    throw new Error('Use --check (read-only) or --write (catalog + receipt; never installs)');
  }
  const checkedAt = new Date().toISOString();
  // Read every upstream result before writing anything; no fabricated fallback.
  const receipts = await Promise.all(TARGETS.map((name) => fetchReceipt(name, fetch, checkedAt)));
  const source = await readFile('pnpm-workspace.yaml', 'utf8');
  const result = updateCatalog(source, receipts);
  const manifests = [];
  for await (const path of glob(['package.json', 'apps/*/package.json', 'packages/*/package.json'])) {
    manifests.push({ path, manifest: JSON.parse(await readFile(path, 'utf8')) });
  }
  validateManifestTargets(manifests, result.changes);
  const report = { schema: 1, checkedAt, tag: 'latest', packages: receipts, catalog: result.changes };
  console.log(JSON.stringify(report, null, 2));
  await mkdir('artifacts/business-studio', { recursive: true });
  await writeFile('artifacts/business-studio/npm-latest.json', JSON.stringify(report, null, 2) + '\n');
  if (args[0] === '--write') {
    await writeFile('pnpm-workspace.yaml', result.source);
    await mkdir('docs/business', { recursive: true });
    await writeFile('docs/business/npm-latest.lock.json', JSON.stringify(report, null, 2) + '\n');
  } else {
    validateLockedTargets(await readFile('pnpm-lock.yaml', 'utf8'), receipts);
    validateSavedReceipt(JSON.parse(await readFile('docs/business/npm-latest.lock.json', 'utf8')), receipts, result.changes);
    const outdated = result.changes.filter((item) => item.installed && item.previous !== item.latest);
    if (outdated.length) throw new Error(`Not latest: ${outdated.map((item) => `${item.name} ${item.previous} -> ${item.latest}`).join(', ')}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

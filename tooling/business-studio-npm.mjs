// Latest means the npm registry's stable latest tag, resolved before installation.
// SOT: docs/business/npm-policy.md
// SOT-KEYWORDS: business studio dependency npm latest catalog evidence
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const TARGETS = Object.freeze([
  'react-native-gesture-handler', 'react-native-reanimated', 'react-native-worklets',
  '@shopify/react-native-skia', 'react-native-webgpu', 'typegpu',
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
  if (!/^sha512-[A-Za-z0-9+/]+=*$/.test(data.dist?.integrity ?? '')) {
    throw new Error(`${name}: missing SHA-512 distribution integrity`);
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
  const report = { schema: 1, checkedAt, tag: 'latest', packages: receipts, catalog: result.changes };
  console.log(JSON.stringify(report, null, 2));
  await mkdir('artifacts/business-studio', { recursive: true });
  await writeFile('artifacts/business-studio/npm-latest.json', JSON.stringify(report, null, 2) + '\n');
  if (args[0] === '--write') {
    await writeFile('pnpm-workspace.yaml', result.source);
    await mkdir('docs/business', { recursive: true });
    await writeFile('docs/business/npm-latest.lock.json', JSON.stringify(report, null, 2) + '\n');
  } else {
    const outdated = result.changes.filter((item) => item.installed && item.previous !== item.latest);
    if (outdated.length) throw new Error(`Not latest: ${outdated.map((item) => `${item.name} ${item.previous} -> ${item.latest}`).join(', ')}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}

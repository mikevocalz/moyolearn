#!/usr/bin/env node
// Artwork on an app surface comes from `packages/art/registry.ts` and nowhere else.
//
// The register carries alt text, licence, intrinsic size and band clearance
// beside each asset, so a component that takes an `ArtName` cannot render art
// with no alt, art with no recorded licence, or a photograph on a child's
// screen. A component that takes a URL or a `require()` can do all three, and
// none of it is visible in review — which is why the shape is gated here rather
// than trusted to a convention.
//
// Two things fail:
//   1. A remote image address built at a call site — `source={{ uri: … }}`.
//   2. A bundled image pulled in directly — `require('…/x.png')` or an import
//      of an image file.
//
// SCOPE. `packages/ui`, `packages/app` and the mobile/web app routes. Excluded:
// `apps/web-vite`, which has its own equivalent register in
// `src/components/photography.ts` and predates this one; `packages/avatar`,
// whose GLTF textures are 3D material inputs rather than surface artwork; and
// Storybook static assets.
//
// Usage: pnpm check:art
// SOT: packages/art/registry.ts · docs/design/art-direction.md ·
//      docs/design/moyo-design-reset-v2-brief.md §12
// SOT-KEYWORDS: art registry gate image uri require alt licence band artwork
import { execSync } from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const SCOPE = 'packages/ui packages/app apps/mobile/app apps/web/app';
const EXCLUDE =
  '--exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=.expo';

/*
  grep exits 1 for "no match", which is the passing answer. Any other status is
  a broken probe, and swallowing it would report a clean repo forever — the
  failure mode `tooling/check-no-flatlist.mjs` documents.
*/
const probe = (pattern) => {
  try {
    return execSync(
      `grep -rnE ${JSON.stringify(pattern)} ${SCOPE} --include=*.ts --include=*.tsx ${EXCLUDE}`,
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    ).trim();
  } catch (error) {
    if (error.status !== 1) throw error;
    return '';
  }
};

/*
  Stories are where a component's states are demonstrated, and a story that
  cannot show a broken-image state cannot document one. The gate covers shipped
  surfaces; `.stories.tsx` is exempt, and so is this file, which spells out the
  patterns it bans.
*/
const isExempt = (line) =>
  line.includes('.stories.tsx') || line.startsWith('tooling/check-art-registry.mjs');

const RULES = [
  {
    name: 'remote image address',
    pattern: 'source=\\{\\{[^}]*uri',
    fix: 'Take an `ArtName` from @acme/art and let the art component resolve the file. A URI built at the call site carries no alt text, no licence and no band clearance.',
  },
  {
    name: 'bundled image import',
    pattern: "(require\\([^)]*\\.(png|jpe?g|webp|avif|gif|svg)|from '[^']*\\.(png|jpe?g|webp|avif|gif|svg)')",
    fix: 'Register the asset in packages/art/registry.ts with its provenance, then reference it by name.',
  },
];

let failures = 0;
for (const rule of RULES) {
  const hits = probe(rule.pattern).split('\n').filter(Boolean).filter((l) => !isExempt(l));
  if (!hits.length) continue;
  console.error(`\n${rule.name}:`);
  for (const hit of hits) {
    failures++;
    console.error(`  ${hit}`);
  }
  console.error(`  → ${rule.fix}`);
}

if (failures) {
  console.error(
    `\n${failures} image reference(s) outside the register. Every asset on an app ` +
      'surface is an entry in packages/art/registry.ts, and a class with no ' +
      'approved art yet resolves to `never` on purpose — see ' +
      'docs/design/art-direction.md for what an asset must pass first.',
  );
  process.exit(1);
}
console.log('art OK — no image reference outside packages/art/registry.ts');

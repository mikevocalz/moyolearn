/**
 * Puts Natalie's body where the browser can fetch it.
 *
 * The split glTF lives in `@acme/avatar/assets/natalie-phone/` — 13 MB across
 * ten files that resolve each other by RELATIVE path (`natalie.gltf` names
 * `natalie.bin` and eight images as siblings). Two things follow from that, and
 * they are why this is a copy rather than an import:
 *
 *   A bundler cannot help. `import`ing the `.gltf` gets it hashed into a chunk
 *   and its siblings are then unreachable — the same ".glb rule" failure mode
 *   `packages/avatar/src/assets.ts` documents, one layer up.
 *
 *   Next only serves `public/`. A symlink out of the workspace survives local
 *   dev and does not reliably survive a Vercel build, so the bytes are copied.
 *
 * Cheap on a warm tree: a file is re-copied only when the source is newer, so
 * `dev` pays for it once. Skips silently when the package is absent, because a
 * web build without the avatar package should fail on the import, not here.
 *
 * The real destination for this asset is the signed Bunny pull zone that
 * `assets.ts`'s capability manager already speaks to — `modelUri` on
 * `TutorAvatar3D` is the seam for that, and this script is what stands in until
 * the manifest is published.
 *
 * SOT: packages/app/features/tutor/tutor-avatar-3d.web.tsx · packages/avatar/src/assets.ts
 * SOT-KEYWORDS: natalie avatar assets copy public gltf web build vercel
 */
import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, '../../../packages/avatar/assets/natalie-phone');
const destination = join(here, '../public/natalie');

const newer = async (from, to) => {
  const [a, b] = await Promise.all([stat(from), stat(to).catch(() => null)]);
  return b === null || a.mtimeMs > b.mtimeMs;
};

const entries = await readdir(source).catch(() => null);
if (entries === null) {
  console.warn(`[avatar-assets] ${source} not found — skipping`);
} else {
  await mkdir(destination, { recursive: true });
  let copied = 0;
  for (const entry of entries) {
    const from = join(source, entry);
    const to = join(destination, entry);
    if (!(await newer(from, to))) continue;
    await cp(from, to);
    copied += 1;
  }
  console.log(`[avatar-assets] ${copied} of ${entries.length} file(s) copied to public/natalie`);
}

// Self-host the exact PDF.js worker, fonts, CMaps and codecs used by the reader.
// SOT-KEYWORDS: pdfjs assets worker fonts cmaps web build
import { createRequire } from 'node:module';
import { cp, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../../packages/app/package.json'));
const source = dirname(require.resolve('pdfjs-dist/package.json'));
const { version } = JSON.parse(
  await readFile(join(source, 'package.json'), 'utf8'),
);
const destination = join(here, '../public/pdfjs', version);
await mkdir(destination, { recursive: true });
await cp(
  join(source, 'build/pdf.worker.min.mjs'),
  join(destination, 'pdf.worker.min.mjs'),
);
for (const part of ['cmaps', 'standard_fonts', 'wasm', 'LICENSE']) {
  await cp(join(source, part), join(destination, part), { recursive: true });
}

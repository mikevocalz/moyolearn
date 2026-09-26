// Run from the repository root after build-fixtures.py. Local-only QA harness.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const root = resolve('.codex/pdf-qa');
await mkdir(root, { recursive: true });
await writeFile(
  `${root}/index.html`,
  `<!doctype html><html><head><title>Homework PDF edge cases</title></head><body><h1>Homework PDF edge cases</h1><p>These are observations, not accuracy pass/fail assertions. Review against the source.</p><pre id="result">Running 22 cases…</pre><script type="module" src="/@fs/${resolve('scripts/qa/pdf/run.ts')}"></script></body></html>`,
);
const server = await createServer({
  root,
  publicDir: resolve('apps/web/public'),
  server: {
    port: 4317,
    strictPort: true,
    host: '127.0.0.1',
    fs: { allow: [process.cwd()] },
  },
});
await server.listen();
server.printUrls();

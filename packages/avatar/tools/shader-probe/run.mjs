/**
 * Runs the shader probes — bundle, launch, render, report.
 *
 * `node tools/shader-probe/run.mjs [--out dir] [--only materials|stage|rebake]`
 *                                   [--assets <public dir>] [--runtime <rebaked .bin>]
 *                                   [--backend webgl|webgpu]
 *
 * TWO PROBES, because they answer different questions. `materials` renders each
 * ported material on a lit sphere and asks "does this node graph compile and
 * shade". `stage` builds `createStage()` for every tier and asks "does the post
 * chain compile" — `RenderPipeline`, `pass()`, `bloom()`, the GTAO prepass with
 * its MRT, PMREM over `RoomEnvironment`, shadows, tone mapping. A green
 * material set says nothing about the pipeline that composites it.
 *
 * A THIRD, `rebake`, runs only when you point it at the assets: it renders the
 * head from the 34.9 MB authoring container and from the 1.93 MB rebaked one
 * and diffs the frames, which is the shading half of §6.3's proof. It needs the
 * authoring container, which is 34.9 MB and is NOT in the repo (doc 22 §3), so
 * it SKIPS with a message rather than failing when the assets are absent —
 * a probe that goes red because a developer does not have a 35 MB file is a
 * probe that gets deleted.
 *
 * Exits non-zero if any material fails to compile, or renders a single flat
 * colour. The second check matters as much as the first: three reports some
 * builder failures through `console.error` rather than by throwing, so a
 * material can "succeed" and draw nothing. A patch with one distinct luminance
 * value did not shade.
 *
 * REQUIREMENTS: Playwright and esbuild, both dev-only. This is not part of the
 * package's runtime dependency graph and is not run by `pnpm test` — it needs a
 * browser, and a unit-test run must stay a unit-test run.
 *
 * SOT: docs/pack/22-embodied-tutor-avatar-spec.md §4, §10.5
 * SOT-KEYWORDS: shader probe runner playwright esbuild swiftshader compile gate ci
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, globSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '../..');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
};
const outDir = resolve(flag('out', join(packageRoot, '.probe')));

/**
 * WHICH BACKEND. `webgl` is the default and the portable one; `webgpu` is the
 * backend the app actually ships on the web, and the only one that can fail on
 * WGSL or on `createRenderPipeline`.
 *
 * They cannot share Chrome flags. The WebGL run forces ANGLE onto SwiftShader
 * so it works on a machine with no usable GPU, and that same flag is what makes
 * a WebGPU run pointless — SwiftShader answers the adapter request and nothing
 * a real Dawn pipeline would reject gets exercised. So the WebGPU run drops
 * `--use-angle=swiftshader` entirely and asks for a real adapter.
 *
 * The WebGPU run also needs a Chrome with WebGPU compiled in. Playwright's
 * bundled Chromium does not have it, so point `CHROME_PATH` at a real one:
 *
 *   CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
 *     node tools/shader-probe/run.mjs --backend webgpu --only materials
 */
const backend = flag('backend', 'webgl');
if (backend !== 'webgl' && backend !== 'webgpu') {
  process.stderr.write(`unknown --backend ${backend}; expected webgl or webgpu\n`);
  process.exit(2);
}

const CHROME_ARGS =
  backend === 'webgpu'
    ? [
        '--no-sandbox',
        // `--enable-unsafe-webgpu` is what lets WebGPU run on a configuration
        // Chrome has not blessed; on a blessed one it is a no-op.
        '--enable-unsafe-webgpu',
        '--ignore-gpu-blocklist',
      ]
    : [
        '--no-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        // `--enable-unsafe-swiftshader` is what permits a software rasteriser
        // for WebGL in recent Chrome.
        '--enable-unsafe-swiftshader',
        '--ignore-gpu-blocklist',
      ];

mkdirSync(join(outDir, 'img'), { recursive: true });

const only = flag('only', null);
const PROBES = [
  {
    id: 'materials',
    entry: 'entry.ts',
    global: '__runProbe',
    // The material probe wants one canvas it can reuse; the stage probe makes
    // its own per tier (reusing one across `renderer.dispose()` loses the
    // context — see stage-entry.ts).
    body: '<canvas id="c" width="192" height="192"></canvas>',
    arg: "document.getElementById('c')",
    label: (r) => r.id,
    ok: (r) => r.compiled && r.distinctLuma > 4,
  },
  {
    id: 'stage',
    entry: 'stage-entry.ts',
    global: '__runStageProbe',
    body: '',
    arg: 'document.body',
    label: (r) => r.tier,
    ok: (r) => r.built && r.rendered && r.distinctLuma > 4,
  },
  {
    id: 'rebake',
    entry: 'rebake-entry.ts',
    global: '__runRebakeAB',
    body: '',
    // Served over HTTP rather than file://, because the containers are fetched
    // and a file:// fetch is blocked.
    serve: true,
    arg: "document.body, ''",
    label: (r) => r.id,
    ok: (r) => r.error === null,
  },
].filter((p) => !only || p.id === only);

function bundle(probe) {
  execFileSync(
    'npx',
    [
      'esbuild',
      join(here, probe.entry),
      '--bundle',
      '--format=iife',
      '--platform=browser',
      '--target=es2022',
      `--outfile=${join(outDir, `${probe.id}.js`)}`,
      '--log-level=error',
    ],
    { cwd: packageRoot, stdio: 'inherit' }
  );
  // The backend is handed to the page as a global rather than as an argument to
  // the probe entry point, so `probe.arg` (which differs per probe) stays as it
  // was and every entry can read the same switch.
  writeFileSync(
    join(outDir, `${probe.id}.html`),
    `<!doctype html><html><body>${probe.body}` +
      `<script>window.__PROBE_BACKEND=${JSON.stringify(backend)};</script>` +
      `<script src="./${probe.id}.js"></script></body></html>\n`
  );
}

function findLocalChromium() {
  const candidates = [
    ...globSync('/opt/pw-browsers/chromium-*/chrome-linux/chrome'),
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ];
  return candidates.find((path) => existsSync(path)) ?? null;
}

const assetsDir = flag('assets', null);
const runtimeBin = flag('runtime', null);

/**
 * The rebake A/B needs its inputs served over HTTP. Everything else runs from
 * file://, which is simpler and has no port to collide with.
 */
async function startServer(root) {
  const { createServer } = await import('node:http');
  const { extname, join: joinPath } = await import('node:path');
  const types = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.bin': 'application/octet-stream',
    '.png': 'image/png',
  };
  const server = createServer((req, res) => {
    const path = joinPath(root, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (!existsSync(path) || statSync(path).isDirectory()) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, port: server.address().port };
}

const { decodePng } = await import('../../src/testing/png.ts');
const { diffImages } = await import('../../src/testing/pixel-diff.ts');

const { chromium } = await import('playwright');
// Prefer whatever Chromium is already on the machine over Playwright's own
// download: CI images and this container both ship one, and `playwright
// install` is a 150 MB fetch to run a compile check.
const executablePath = process.env.CHROME_PATH ?? findLocalChromium();
const browser = await chromium.launch(
  executablePath ? { executablePath, args: CHROME_ARGS } : { args: CHROME_ARGS }
);

/**
 * Fails loudly rather than quietly producing a WebGL-shaped result: if the
 * browser has no WebGPU adapter, `WebGPURenderer` silently falls back to the
 * WebGL backend and every case would come back green having proven nothing
 * about WGSL.
 *
 * The check runs on a real page, not `about:blank` — Chrome does not expose
 * `navigator.gpu` on the opaque origin, so an `about:blank` probe reports a
 * false negative.
 */
if (backend === 'webgpu') {
  writeFileSync(join(outDir, 'gpu-check.html'), '<!doctype html><html><body></body></html>\n');
  const page = await browser.newPage();
  await page.goto(`file://${join(outDir, 'gpu-check.html')}`);
  const support = await page.evaluate(async () => {
    if (!navigator.gpu) return { gpu: false, adapter: false, vendor: null, architecture: null };
    const adapter = await navigator.gpu.requestAdapter();
    return {
      gpu: true,
      adapter: Boolean(adapter),
      vendor: adapter?.info?.vendor ?? null,
      architecture: adapter?.info?.architecture ?? null,
    };
  });
  await page.close();
  if (!support.gpu || !support.adapter) {
    await browser.close();
    process.stderr.write(
      `\nBLOCKED: --backend webgpu, but this browser has ` +
        `${support.gpu ? 'no WebGPU adapter' : 'no navigator.gpu'}.\n` +
        `  executable: ${executablePath ?? '(playwright bundled chromium)'}\n` +
        "  Point CHROME_PATH at a Chrome build with WebGPU compiled in.\n"
    );
    process.exit(2);
  }
  process.stdout.write(
    `\nWebGPU adapter: ${support.vendor ?? 'unknown'} ${support.architecture ?? ''}`.trimEnd() +
      `\n  executable: ${executablePath ?? '(playwright bundled chromium)'}\n`
  );
}

let failed = 0;
let total = 0;

for (const probe of PROBES) {
  if (probe.serve) {
    // Skip rather than fail: the authoring container is 34.9 MB and is not in
    // the repo, so most developers legitimately cannot run this one.
    const need = [
      assetsDir && join(assetsDir, 'gnm/gnm_head_web.bin'),
      assetsDir && join(assetsDir, 'gnm/arkit-map.json'),
      assetsDir && join(assetsDir, 'gnm/identity.json'),
      runtimeBin,
    ];
    if (need.some((path) => !path || !existsSync(path))) {
      process.stdout.write(
        `\nskipping ${probe.id}: needs --assets <public dir> and --runtime <rebaked .bin>.\n` +
          '  The authoring container is 34.9 MB and is not in the repo (doc 22 §3).\n'
      );
      continue;
    }
    mkdirSync(join(outDir, 'served/gnm'), { recursive: true });
    for (const [from, to] of [
      [join(assetsDir, 'gnm/gnm_head_web.bin'), 'gnm/gnm_head_web.bin'],
      [join(assetsDir, 'gnm/arkit-map.json'), 'gnm/arkit-map.json'],
      [join(assetsDir, 'gnm/identity.json'), 'gnm/identity.json'],
      [runtimeBin, 'gnm/gnm_head_runtime.bin'],
    ]) {
      copyFileSync(from, join(outDir, 'served', to));
    }
  }

  process.stdout.write(`\nbundling ${probe.id}…\n`);
  bundle(probe);

  let served = null;
  if (probe.serve) {
    copyFileSync(join(outDir, `${probe.id}.js`), join(outDir, 'served', `${probe.id}.js`));
    copyFileSync(join(outDir, `${probe.id}.html`), join(outDir, 'served', `${probe.id}.html`));
    served = await startServer(join(outDir, 'served'));
  }

  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(
    served
      ? `http://127.0.0.1:${served.port}/${probe.id}.html`
      : `file://${join(outDir, `${probe.id}.html`)}`
  );

  let results;
  try {
    results = await page.evaluate(
      // eslint-disable-next-line no-new-func
      new Function(`return window.${probe.global}(${probe.arg})`)
    );
  } catch (thrown) {
    process.stderr.write(`\n${probe.id} threw: ${String(thrown).split('\n').slice(0, 5).join('\n')}\n`);
    for (const line of logs.slice(0, 25)) process.stderr.write(`  ${line}\n`);
    await page.close();
    failed += 1;
    total += 1;
    continue;
  }
  await page.close();
  served?.server.close();

  mkdirSync(join(outDir, 'img', probe.id), { recursive: true });
  process.stdout.write('\n');
  for (const result of results) {
    const label = probe.label(result);
    for (const [key, value] of Object.entries(result)) {
      if (typeof value === 'string' && value.startsWith('data:image/png')) {
        writeFileSync(
          join(outDir, 'img', probe.id, `${label}.${key}.png`),
          Buffer.from(value.split(',')[1], 'base64')
        );
      }
    }
    // A single distinct luminance means the draw produced a flat fill — the
    // graph did not shade, whatever it reported.
    // A WebGPU run that silently became a WebGL run is worse than a red one:
    // it looks like new evidence and is not.
    const wrongBackend = backend === 'webgpu' && result.backendId === 'webgl2';
    const ok = probe.ok(result) && !wrongBackend;
    if (wrongBackend) {
      process.stdout.write('       asked for webgpu, three built the WebGL backend\n');
    }
    total += 1;
    if (!ok) failed += 1;
    // Written out because "it compiled WGSL" is a claim, and this is the thing
    // that backs it. Not a golden either — nothing here is.
    if (result.fragmentShader) {
      mkdirSync(join(outDir, 'shaders', probe.id), { recursive: true });
      writeFileSync(
        join(outDir, 'shaders', probe.id, `${label}.${result.shaderLanguage}`),
        result.fragmentShader
      );
    }
    const detail =
      probe.id === 'rebake'
        ? diffLine(join(outDir, 'img', probe.id), label)
        : `luma ${String(result.meanLuma).padStart(6)}  distinct ${String(result.distinctLuma).padStart(4)}` +
          (result.backendId ? `  ${result.backendId}/${result.shaderLanguage}` : '');
    process.stdout.write(
      `  ${ok ? 'ok  ' : 'FAIL'} ${probe.id}/${String(label).padEnd(14)} ${detail}` +
        `${result.error ? `\n       throw: ${String(result.error).split('\n')[0]}` : ''}\n`
    );
    // Verbatim, un-truncated: on the WebGPU backend these ARE the failure, and
    // a paraphrased pipeline error is worth nothing to whoever reads this.
    for (const line of result.consoleErrors ?? []) {
      process.stdout.write(`       console.error: ${line}\n`);
    }
    for (const line of result.deviceErrors ?? []) {
      process.stdout.write(`       device error: ${line}\n`);
    }
  }

  const interesting = logs.filter((l) => l.startsWith('[error]') || l.startsWith('[pageerror]'));
  if (interesting.length) {
    process.stdout.write(`\n  browser errors (${probe.id}):\n`);
    for (const line of interesting.slice(0, 12)) process.stdout.write(`    ${line}\n`);
  }
}

await browser.close();

/**
 * Diffs an A/B pair with the SAME metric the golden gate uses, so the number
 * means the same thing in both places — a rebake diff and a golden diff should
 * not be measured differently.
 */
function diffLine(dir, label) {
  const a = join(dir, `${label}.authoring.png`);
  const b = join(dir, `${label}.rebaked.png`);
  if (!existsSync(a) || !existsSync(b)) return 'no frames';
  const result = diffImages(
    decodePng(new Uint8Array(readFileSync(a))),
    decodePng(new Uint8Array(readFileSync(b)))
  );
  const pct = result.fraction * 100;
  const verdict = pct <= 0.4 ? 'inside 0.40% budget' : 'OVER BUDGET';
  return `${String(result.diffPixels).padStart(5)} px  ${pct.toFixed(4).padStart(8)}%  ${verdict}`;
}

process.stdout.write(
  `\n${total - failed}/${total} cases compiled and shaded on the ${backend} backend. ` +
    `Images in ${join(outDir, 'img')}.\n` +
    (backend === 'webgpu'
      ? 'These are NOT goldens — the frames come off whatever GPU this host has.\n' +
        'This run DOES cover WGSL and createRenderPipeline; the look is still §10.5.\n'
      : 'These are NOT goldens — SwiftShader is a software rasteriser, on the WebGL2\n' +
        "backend. This is a compile gate; the look and the WGSL path are §10.5's job.\n")
);
process.exit(failed ? 1 : 0);

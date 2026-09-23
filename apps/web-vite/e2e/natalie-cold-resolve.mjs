/**
 * Proof harness for the cold-resolve AbortError: builds the marketing site,
 * serves the prerendered output, delays the voice resolve on purpose, taps
 * "Give me a hint" with a real mouse, and asks two questions the screenshot on
 * its own cannot answer — did `HTMLMediaElement.play()` RESOLVE, and was the
 * jaw actually open while she spoke.
 *
 *   node apps/web-vite/e2e/natalie-cold-resolve.mjs \
 *     [--delay 1500,6000] [--browser chromium,webkit] [--out <dir>]
 *     [--label before|after] [--skip-build] [--port 5200]
 *
 * WHY THE DELAY IS THE WHOLE TEST. With a warm cache the clip is already in
 * hand when the visitor taps and nothing races. The defect only exists inside
 * the window where the resolve is still in flight: the scene's fallback clock
 * used to run free there, complete the 3.5 s action before any audio element
 * existed, and the surface's `stopAudio()` then aborted the `play()` that
 * arrived a moment later. `page.route()` reproduces that window on demand.
 *
 * WHY IT IS A TRUSTED CLICK. `element.click()` from JS does not give the
 * document user activation, so a `play()` that survives it proves nothing
 * about the browser a visitor is using. `page.mouse.click()` does.
 *
 * THE TWO HOOKS, both installed before any page script runs:
 *   `HTMLMediaElement.prototype.play` is wrapped so every call records whether
 *   its promise resolved or rejected, and with which error name. AbortError is
 *   the symptom being hunted, and it is invisible to a screenshot.
 *   `__THREE_DEVTOOLS__` is three.js's own observation seam — defining it makes
 *   every WebGLRenderer announce itself at construction, which lets the harness
 *   wrap `render()` and capture the live scene graph without the app exposing a
 *   test-only global. `jawOpen` is then read straight off the rig's
 *   `morphTargetInfluences`, which is the value the renderer is drawing.
 *
 * Voice fixtures are pulled once from the real endpoint into the OS temp dir
 * and replayed from the local origin. Real alignment, real MP3, no CORS, no
 * dependence on the network during the run.
 *
 * Playwright is dev-only and hoisted at the workspace root; this script is not
 * part of the app's dependency graph and is not run by `pnpm lint`/`build`.
 *
 * SOT: apps/web-vite/src/components/chapters/natalie-surface.tsx
 *      apps/web-vite/src/components/chapters/natalie-scene.tsx
 *      packages/avatar/tools/shader-probe/run.mjs
 * SOT-KEYWORDS: natalie e2e playwright proof cold resolve abort error play
 *               promise jawOpen morph lip sync chromium webkit trusted click
 */
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const repoRoot = resolve(appRoot, '../..');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? (args[i + 1] ?? fallback) : fallback;
};
const has = (name) => args.includes(`--${name}`);

const delays = String(flag('delay', '1500,6000')).split(',').map((d) => Number(d.trim()));
const browserNames = String(flag('browser', 'chromium,webkit')).split(',').map((b) => b.trim());
const label = flag('label', 'run');
const port = Number(flag('port', 5200));
const outDir = resolve(flag('out', join(tmpdir(), 'natalie-proof')));
const publicDir = join(appRoot, '.output/public');
/*
  The chapter-05 verification route. `/` carries the same surface, but the
  marketing page is scroll-driven and the tutor room only comes into view part
  way down it — this route renders the chapter on its own, which is what a
  deterministic click needs.
*/
const pagePath = flag('path', '/chapters-lab');

/** The action under test, and its piece id — both from PRESENCE_ACTIONS. */
const TARGET_LABEL = 'Give me a hint';
const PIECES = ['marketing-hint', 'marketing-explain', 'marketing-got-it'];
const VOICE_ORIGIN = 'https://app.moyolearn.com/api/marketing/voice/baked';

/**
 * Idle is not silence on this rig — the presence engine holds a small resting
 * jaw (measured ~0.016). A bare `> 0` would pass on a frozen mouth, so the run
 * records the pre-tap baseline and requires speech to clear it by a margin
 * that only articulation produces.
 */
const JAW_SPEECH_MARGIN = 0.05;

const BROWSERS = { chromium, webkit };

function log(...parts) {
  process.stdout.write(`${parts.join(' ')}\n`);
}

// ---- fixtures ---------------------------------------------------------------

/**
 * Real voice, fetched once. The resolve JSON carries `url`, `alignmentUrl` and
 * an inline `alignment`; only the `url` is rewritten, so the alignment the lip
 * sync runs on is the production one.
 */
async function ensureFixtures() {
  const dir = join(tmpdir(), 'moyo-natalie-e2e');
  mkdirSync(dir, { recursive: true });
  const fixtures = {};
  for (const piece of PIECES) {
    const jsonPath = join(dir, `${piece}.json`);
    const mp3Path = join(dir, `${piece}.mp3`);
    if (!existsSync(jsonPath) || !existsSync(mp3Path)) {
      const response = await fetch(`${VOICE_ORIGIN}/${piece}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`voice resolve for ${piece}: HTTP ${response.status}`);
      const body = await response.json();
      if (!body?.url) throw new Error(`voice resolve for ${piece} carried no url`);
      const audio = await fetch(body.url);
      if (!audio.ok) throw new Error(`voice audio for ${piece}: HTTP ${audio.status}`);
      writeFileSync(mp3Path, Buffer.from(await audio.arrayBuffer()));
      writeFileSync(jsonPath, JSON.stringify(body));
      log(`[fixture] fetched ${piece}`);
    }
    fixtures[piece] = { body: JSON.parse(readFileSync(jsonPath, 'utf8')), mp3Path };
  }
  return { dir, fixtures };
}

// ---- static server ----------------------------------------------------------

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.glb': 'model/gltf-binary',
  '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.avif': 'image/avif', '.txt': 'text/plain', '.xml': 'application/xml',
  '.mp3': 'audio/mpeg',
};

function serve(root, fixtureDir) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // The fixture MP3s are served from the page's own origin so the <audio>
    // element needs no CORS grant — the same position the signed Bunny URL is
    // in for a real visitor, which is cross-origin but CORS-enabled.
    const fixture = url.pathname.startsWith('/__voice/');
    const base = fixture ? fixtureDir : root;
    const rel = fixture ? url.pathname.slice('/__voice/'.length) : url.pathname;
    let file = join(base, normalize(decodeURIComponent(rel)));
    if (!file.startsWith(base)) {
      res.writeHead(403).end('no');
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-store',
      'accept-ranges': 'bytes',
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

// ---- page hooks -------------------------------------------------------------

/**
 * Installed with `addInitScript`, so both wrappers are in place before the
 * app's first module evaluates.
 */
function initHooks() {
  globalThis.__playLog = [];
  /*
    The surface builds its players with `new Audio()`, so they are never in the
    document and `querySelectorAll('audio')` cannot see them. The play hook is
    the only place a reference is available — keep it, or there is no way to
    read back whether the clip's clock actually advanced.
  */
  globalThis.__mediaEls = new Set();
  const nativePlay = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play() {
    globalThis.__mediaEls.add(this);
    const record = { src: this.currentSrc || this.src || '', status: 'pending', error: null };
    globalThis.__playLog.push(record);
    let promise;
    try {
      promise = nativePlay.apply(this);
    } catch (error) {
      record.status = 'threw';
      record.error = String(error && error.name ? `${error.name}: ${error.message}` : error);
      throw error;
    }
    if (promise && typeof promise.then === 'function') {
      promise.then(
        () => { record.status = 'resolved'; },
        (error) => {
          record.status = 'rejected';
          record.error = String(error && error.name ? `${error.name}: ${error.message}` : error);
        },
      );
    } else {
      // Pre-promise signature. Nothing to assert on, and nothing rejects.
      record.status = 'no-promise';
    }
    return promise;
  };

  // three.js announces every renderer here at construction. The page carries
  // two (the globe and Natalie), so keep all their scenes and let the reader
  // pick the one that owns a jawOpen morph.
  globalThis.__scenes = new Set();
  globalThis.__THREE_DEVTOOLS__ = new EventTarget();
  globalThis.__THREE_DEVTOOLS__.addEventListener('observe', (event) => {
    const target = event.detail;
    if (!target || typeof target.render !== 'function' || !target.domElement) return;
    const nativeRender = target.render.bind(target);
    target.render = function render(scene, camera) {
      globalThis.__scenes.add(scene);
      return nativeRender(scene, camera);
    };
  });
}

/** Peak `jawOpen` influence across every skinned mesh the renderer is drawing. */
function readJaw() {
  let value = null;
  for (const scene of globalThis.__scenes ?? []) {
    scene.traverse((object) => {
      if (!object.isSkinnedMesh || !object.morphTargetDictionary || !object.morphTargetInfluences) return;
      const index = object.morphTargetDictionary.jawOpen;
      if (index === undefined) return;
      value = Math.max(value ?? 0, object.morphTargetInfluences[index] ?? 0);
    });
  }
  return value;
}

// ---- one run ----------------------------------------------------------------

async function runCase({ browserName, delayMs, fixtures, origin }) {
  const browser = await BROWSERS[browserName].launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error).slice(0, 400)));

  await page.addInitScript(initHooks);

  let resolveCalls = 0;
  await page.route('**/api/marketing/voice/baked/**', async (route) => {
    const piece = new URL(route.request().url()).pathname.split('/').pop();
    const fixture = fixtures[piece];
    resolveCalls += 1;
    await new Promise((ok) => setTimeout(ok, delayMs));
    if (!fixture) {
      await route.fulfill({ status: 404, body: 'no fixture' });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ...fixture.body, url: `${origin}/__voice/${piece}.mp3` }),
    });
  });

  await page.goto(`${origin}${pagePath}`, { waitUntil: 'domcontentloaded' });

  /*
    A text locator, not `getByRole`. The whole tutor-room plate is marked
    `aria-hidden`, so its controls are absent from the accessibility tree — a
    real accessibility defect on that surface, and one this harness only has to
    route around rather than rely on.
  */
  const button = page.locator('button').filter({ hasText: TARGET_LABEL }).first();
  await button.waitFor({ state: 'attached', timeout: 60_000 });
  await button.scrollIntoViewIfNeeded();
  await button.waitFor({ state: 'visible', timeout: 60_000 });
  // The rig has to be drawing before a jaw reading means anything.
  await page.waitForFunction(() => (globalThis.__scenes?.size ?? 0) > 0, null, { timeout: 60_000 });
  await page.waitForFunction(() => {
    for (const scene of globalThis.__scenes ?? []) {
      let found = false;
      scene.traverse((o) => { if (o.isSkinnedMesh && o.morphTargetDictionary?.jawOpen !== undefined) found = true; });
      if (found) return true;
    }
    return false;
  }, null, { timeout: 120_000 });

  const baselineJaw = await page.evaluate(readJaw);
  await page.screenshot({ path: join(outDir, `${label}-${browserName}-${delayMs}ms-01-idle.png`) });

  // TRUSTED CLICK. Real mouse at the control's centre — the gesture chain is
  // the thing under test and `element.click()` would not exercise it.
  const box = await button.boundingBox();
  if (!box) throw new Error('the hint control has no box to click');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const clickedAt = Date.now();

  /*
    Sample until she is demonstrably speaking or the budget runs out. The
    budget covers the artificial delay plus the clip, and the peak sample is
    what the mid-speech screenshot is taken at — a screenshot chosen by a fixed
    sleep would land wherever it landed and prove nothing.
  */
  const budgetMs = delayMs + 9000;
  let peak = { jaw: baselineJaw ?? 0, at: 0, currentTime: 0 };
  let shot = false;
  let audioSeen = { currentTime: 0, paused: true, duration: 0 };
  while (Date.now() - clickedAt < budgetMs) {
    const sample = await page.evaluate(() => {
      const media = [...(globalThis.__mediaEls ?? [])];
      const playing = media.find((m) => !m.paused) ?? media[0] ?? null;
      let jaw = null;
      for (const scene of globalThis.__scenes ?? []) {
        scene.traverse((object) => {
          if (!object.isSkinnedMesh || !object.morphTargetDictionary || !object.morphTargetInfluences) return;
          const index = object.morphTargetDictionary.jawOpen;
          if (index === undefined) return;
          jaw = Math.max(jaw ?? 0, object.morphTargetInfluences[index] ?? 0);
        });
      }
      return {
        jaw,
        log: globalThis.__playLog.map((r) => ({ ...r })),
        currentTime: playing?.currentTime ?? 0,
        paused: playing?.paused ?? true,
        duration: Number.isFinite(playing?.duration) ? playing.duration : 0,
        caption: document.querySelector('.moyo-tutor-room-caption')?.textContent?.trim() ?? '',
      };
    });
    if (sample.currentTime > audioSeen.currentTime) {
      audioSeen = { currentTime: sample.currentTime, paused: sample.paused, duration: sample.duration };
    }
    if ((sample.jaw ?? 0) > peak.jaw) {
      peak = { jaw: sample.jaw, at: Date.now() - clickedAt, currentTime: sample.currentTime };
      if (sample.jaw > (baselineJaw ?? 0) + JAW_SPEECH_MARGIN) {
        await page.screenshot({ path: join(outDir, `${label}-${browserName}-${delayMs}ms-02-midspeech.png`) });
        shot = true;
      }
    }
    if (shot && sample.paused && sample.currentTime > 0) break;
  }

  if (!shot) {
    await page.screenshot({ path: join(outDir, `${label}-${browserName}-${delayMs}ms-02-midspeech.png`) });
  }

  const playLog = await page.evaluate(() => globalThis.__playLog.map((r) => ({ ...r })));
  await context.close();
  await browser.close();

  const rejected = playLog.filter((r) => r.status === 'rejected');
  const resolved = playLog.filter((r) => r.status === 'resolved');
  const jawOk = peak.jaw > 0 && peak.jaw > (baselineJaw ?? 0) + JAW_SPEECH_MARGIN;
  const pass = playLog.length > 0 && rejected.length === 0 && resolved.length > 0 && jawOk && audioSeen.currentTime > 0;

  return {
    browser: browserName,
    delayMs,
    pass,
    playCalls: playLog.length,
    playResolved: resolved.length,
    playRejected: rejected.length,
    playErrors: rejected.map((r) => r.error),
    baselineJaw,
    peakJaw: peak.jaw,
    peakJawAtMs: peak.at,
    jawThreshold: (baselineJaw ?? 0) + JAW_SPEECH_MARGIN,
    audioAdvancedToSeconds: Number(audioSeen.currentTime.toFixed(2)),
    audioDurationSeconds: Number(audioSeen.duration.toFixed(2)),
    resolveCalls,
    pageErrors: consoleErrors.slice(0, 3),
  };
}

// ---- main -------------------------------------------------------------------

mkdirSync(outDir, { recursive: true });

if (!has('skip-build')) {
  log('[build] pnpm --filter web-vite build');
  execFileSync('pnpm', ['--filter', 'web-vite', 'build'], { cwd: repoRoot, stdio: 'inherit' });
}
if (!existsSync(join(publicDir, 'index.html'))) {
  throw new Error(`no prerendered output at ${publicDir} — drop --skip-build`);
}

const { dir: fixtureDir, fixtures } = await ensureFixtures();
const server = await serve(publicDir, fixtureDir);
const origin = `http://localhost:${port}`;
log(`[serve] ${publicDir} on ${origin}`);

const results = [];
try {
  for (const browserName of browserNames) {
    for (const delayMs of delays) {
      log(`\n[run] ${label} · ${browserName} · resolve delayed ${delayMs}ms`);
      const result = await runCase({ browserName, delayMs, fixtures, origin });
      results.push(result);
      log(JSON.stringify(result, null, 2));
    }
  }
} finally {
  server.close();
}

writeFileSync(join(outDir, `${label}-results.json`), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
log(`\n[${label}] ${results.length - failed.length}/${results.length} passed`);
log(`[${label}] screenshots + results in ${outDir}`);
process.exit(failed.length > 0 ? 1 : 0);

/**
 * Shared harness for the Natalie Playwright proofs in this directory: the
 * prerendered static server, the recorded voice fixtures, the two page hooks
 * that make `play()` outcomes and the rig's `jawOpen` readable, the delayed
 * voice route, and the trusted click. Each proof file keeps only its own
 * question and its own verdict.
 *
 * WHY THE HOOKS LIVE HERE, installed with `addInitScript` before any page
 * script runs:
 *   `HTMLMediaElement.prototype.play` is wrapped so every call records whether
 *   its promise resolved or rejected, and with which error name. AbortError is
 *   the symptom the cold-resolve proof hunts, and it is invisible to a
 *   screenshot.
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
 * Playwright is dev-only and hoisted at the workspace root; nothing here is in
 * the app's dependency graph or run by `pnpm lint`/`build`.
 *
 * SOT: apps/web-vite/e2e/natalie-cold-resolve.mjs
 *      apps/web-vite/e2e/natalie-jaw-cycle.mjs
 *      apps/web-vite/src/components/chapters/natalie-surface.tsx
 *      apps/web-vite/src/components/chapters/natalie-scene.tsx
 * SOT-KEYWORDS: natalie e2e playwright harness fixtures static server play hook
 *               three devtools jawOpen morph trusted click voice route delay
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
export const appRoot = resolve(here, '..');
export const repoRoot = resolve(appRoot, '../..');
export const publicDir = join(appRoot, '.output/public');

/*
  The chapter-05 verification route. `/` carries the same surface, but the
  marketing page is scroll-driven and the tutor room only comes into view part
  way down it — this route renders the chapter on its own, which is what a
  deterministic click needs.
*/
export const DEFAULT_PAGE_PATH = '/chapters-lab';

/** The action under test, and the piece ids — all from PRESENCE_ACTIONS. */
export const TARGET_LABEL = 'Give me a hint';
export const PIECES = ['marketing-hint', 'marketing-explain', 'marketing-got-it'];
export const VOICE_ORIGIN = 'https://app.moyolearn.com/api/marketing/voice/baked';

/**
 * Idle is not silence on this rig — the presence engine holds a small resting
 * jaw (measured ~0.016). A bare `> 0` would pass on a frozen mouth, so a run
 * records the pre-tap baseline and requires speech to clear it by a margin
 * that only articulation produces.
 */
export const JAW_SPEECH_MARGIN = 0.05;

export const BROWSERS = { chromium, webkit };

export function log(...parts) {
  process.stdout.write(`${parts.join(' ')}\n`);
}

/** `--name value` and bare `--name` flags off `process.argv`. */
export function parseArgs(argv = process.argv.slice(2)) {
  const flag = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? (argv[i + 1] ?? fallback) : fallback;
  };
  const has = (name) => argv.includes(`--${name}`);
  return { flag, has };
}

/** Builds the prerendered site unless `--skip-build`, then insists it exists. */
export function ensureBuild({ has }) {
  if (!has('skip-build')) {
    log('[build] pnpm --filter web-vite build');
    execFileSync('pnpm', ['--filter', 'web-vite', 'build'], { cwd: repoRoot, stdio: 'inherit' });
  }
  if (!existsSync(join(publicDir, 'index.html'))) {
    throw new Error(`no prerendered output at ${publicDir} — drop --skip-build`);
  }
}

// ---- fixtures ---------------------------------------------------------------

/**
 * Real voice, fetched once. The resolve JSON carries `url`, `alignmentUrl` and
 * an inline `alignment`; only the `url` is rewritten, so the alignment the lip
 * sync runs on is the production one.
 */
export async function ensureFixtures() {
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

export function serve(root, fixtureDir, port) {
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
 * app's first module evaluates. Self-contained on purpose: Playwright ships the
 * function's source to the page, so it cannot close over anything in here.
 */
export function initHooks() {
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
export function readJaw() {
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

/**
 * One sample of everything a proof reads per tick: the jaw, the play log, the
 * clock of whichever player is running, and the caption. Self-contained for the
 * same reason as `initHooks`.
 */
export function readSpeechSample() {
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
    ended: playing?.ended ?? false,
    duration: Number.isFinite(playing?.duration) ? playing.duration : 0,
    caption: document.querySelector('.moyo-tutor-room-caption')?.textContent?.trim() ?? '',
  };
}

// ---- page driving -----------------------------------------------------------

/**
 * Answers every voice resolve from the fixtures after `delayMs`, with the clip
 * URL rewritten to the local origin. Returns a live tally so a proof can read
 * how many resolves the page issued and when each piece was answered.
 */
export async function installVoiceRoute(page, { fixtures, origin, delayMs }) {
  const tally = { calls: 0, fulfilledAt: {} };
  await page.route('**/api/marketing/voice/baked/**', async (route) => {
    const piece = new URL(route.request().url()).pathname.split('/').pop();
    const fixture = fixtures[piece];
    tally.calls += 1;
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
    tally.fulfilledAt[piece] = Date.now();
  });
  return tally;
}

/**
 * Opens the chapter and returns the hint control once it is visible AND the
 * rig behind it is drawing a mesh that owns `jawOpen` — before that, a jaw
 * reading means nothing.
 */
export async function openChapter(page, { origin, pagePath = DEFAULT_PAGE_PATH }) {
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
  await page.waitForFunction(() => (globalThis.__scenes?.size ?? 0) > 0, null, { timeout: 60_000 });
  await page.waitForFunction(() => {
    for (const scene of globalThis.__scenes ?? []) {
      let found = false;
      scene.traverse((o) => { if (o.isSkinnedMesh && o.morphTargetDictionary?.jawOpen !== undefined) found = true; });
      if (found) return true;
    }
    return false;
  }, null, { timeout: 120_000 });
  return button;
}

/**
 * TRUSTED CLICK. `element.click()` from JS does not give the document user
 * activation, so a `play()` that survives it proves nothing about the browser a
 * visitor is using. A real mouse at the control's centre does.
 */
export async function trustedClick(page, button) {
  const box = await button.boundingBox();
  if (!box) throw new Error('the hint control has no box to click');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.click(x, y);
  return { x, y, at: Date.now() };
}

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
 * The static server, voice fixtures, page hooks (the `play()` recorder and the
 * `__THREE_DEVTOOLS__` jaw reader) and the trusted click live in
 * natalie-harness.mjs, shared with natalie-jaw-cycle.mjs.
 *
 * SOT: apps/web-vite/e2e/natalie-harness.mjs
 *      apps/web-vite/src/components/chapters/natalie-surface.tsx
 *      apps/web-vite/src/components/chapters/natalie-scene.tsx
 *      packages/avatar/tools/shader-probe/run.mjs
 * SOT-KEYWORDS: natalie e2e playwright proof cold resolve abort error play
 *               promise jawOpen morph lip sync chromium webkit trusted click
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  BROWSERS,
  DEFAULT_PAGE_PATH,
  JAW_SPEECH_MARGIN,
  ensureBuild,
  ensureFixtures,
  initHooks,
  installVoiceRoute,
  log,
  openChapter,
  parseArgs,
  publicDir,
  readJaw,
  readSpeechSample,
  serve,
  trustedClick,
} from './natalie-harness.mjs';

const args = parseArgs();
const delays = String(args.flag('delay', '1500,6000')).split(',').map((d) => Number(d.trim()));
const browserNames = String(args.flag('browser', 'chromium,webkit')).split(',').map((b) => b.trim());
const label = args.flag('label', 'run');
const port = Number(args.flag('port', 5200));
const outDir = resolve(args.flag('out', join(tmpdir(), 'natalie-proof')));
const pagePath = args.flag('path', DEFAULT_PAGE_PATH);

// ---- one run ----------------------------------------------------------------

async function runCase({ browserName, delayMs, fixtures, origin }) {
  const browser = await BROWSERS[browserName].launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error).slice(0, 400)));

  await page.addInitScript(initHooks);

  const tally = await installVoiceRoute(page, { fixtures, origin, delayMs });
  const button = await openChapter(page, { origin, pagePath });

  const baselineJaw = await page.evaluate(readJaw);
  await page.screenshot({ path: join(outDir, `${label}-${browserName}-${delayMs}ms-01-idle.png`) });

  const { at: clickedAt } = await trustedClick(page, button);

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
    const sample = await page.evaluate(readSpeechSample);
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
    resolveCalls: tally.calls,
    pageErrors: consoleErrors.slice(0, 3),
  };
}

// ---- main -------------------------------------------------------------------

mkdirSync(outDir, { recursive: true });

ensureBuild(args);

const { dir: fixtureDir, fixtures } = await ensureFixtures();
const server = await serve(publicDir, fixtureDir, port);
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

/**
 * Proof that a cold voice resolve still yields one full articulated line, and
 * that the mouth closes again when the line ends. Builds the marketing site,
 * serves the prerendered output, delays the voice resolve on purpose, taps
 * "Give me a hint" with a real mouse — twice, back to back — and reads `jawOpen`
 * off the rig three times: before, during, and after.
 *
 *   node apps/web-vite/e2e/natalie-jaw-cycle.mjs \
 *     [--delay 1500,6000] [--browser chromium] [--out <dir>] [--skip-build] [--port 5210]
 *
 * THE THREE READINGS, and why "zero" is not the bar:
 *   baseline  jawOpen before the tap. Idle is not a closed mouth on this rig —
 *             the presence engine holds ~0.012-0.016 — so "open" means clearing
 *             the baseline by JAW_SPEECH_MARGIN, which only articulation does.
 *   peak      the largest jawOpen seen while the clip's clock was advancing.
 *   settled   jawOpen once the clip has ended, the caption has cleared and the
 *             lip smoother has had JAW_SETTLE_MS to fall. It must be back within
 *             JAW_REST_TOLERANCE of the baseline, well under the speech margin.
 *
 * WHY THE SECOND TAP. The surface keeps one in-flight resolve per piece and
 * disables the controls while a line is playing. A second trusted click landing
 * right behind the first must not start a second `play()` and must not issue a
 * fourth resolve — the tally stays at one resolve per piece.
 *
 * SOT: apps/web-vite/e2e/natalie-harness.mjs
 *      apps/web-vite/src/components/chapters/natalie-surface.tsx
 *      apps/web-vite/src/components/chapters/natalie-scene.tsx
 * SOT-KEYWORDS: natalie e2e playwright proof jaw cycle settle baseline peak
 *               double tap in-flight resolve trusted click chromium
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  BROWSERS,
  DEFAULT_PAGE_PATH,
  JAW_SPEECH_MARGIN,
  PIECES,
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
const browserNames = String(args.flag('browser', 'chromium')).split(',').map((b) => b.trim());
const port = Number(args.flag('port', 5210));
const outDir = resolve(args.flag('out', join(tmpdir(), 'natalie-jaw-cycle')));
const pagePath = args.flag('path', DEFAULT_PAGE_PATH);

/** How far above baseline the settled jaw may sit and still count as closed. */
const JAW_REST_TOLERANCE = 0.02;
/** The lip smoother falls at 16/s (natalie-scene.tsx); a second is ample. */
const JAW_SETTLE_MS = 1000;
/**
 * How short of its duration the clip's high-water clock may stop and still count
 * as a finished line. Sampling is a round-trip per tick, so the last reading
 * lands a few milliseconds shy of the end; a line cut short by the defect this
 * proves absent stops seconds shy.
 */
const LINE_END_TOLERANCE_S = 0.25;

async function runCase({ browserName, delayMs, fixtures, origin }) {
  const browser = await BROWSERS[browserName].launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 400)));

  await page.addInitScript(initHooks);
  const tally = await installVoiceRoute(page, { fixtures, origin, delayMs });
  const button = await openChapter(page, { origin, pagePath });

  const baselineJaw = await page.evaluate(readJaw);
  await page.screenshot({ path: join(outDir, `${browserName}-${delayMs}ms-01-idle.png`) });

  const click = await trustedClick(page, button);
  // The double tap: a second real click immediately behind the first.
  await page.mouse.click(click.x, click.y);
  const hintFulfilledAt = tally.fulfilledAt['marketing-hint'] ?? null;
  const tapDuringResolve = hintFulfilledAt === null || click.at < hintFulfilledAt;

  const budgetMs = delayMs + 12_000;
  let peak = { jaw: baselineJaw ?? 0, atMs: 0, currentTime: 0 };
  let audioSeen = { currentTime: 0, duration: 0 };
  let ended = false;
  let midShot = false;
  while (Date.now() - click.at < budgetMs) {
    const sample = await page.evaluate(readSpeechSample);
    if (sample.currentTime > audioSeen.currentTime) {
      audioSeen = { currentTime: sample.currentTime, duration: sample.duration };
    }
    if ((sample.jaw ?? 0) > peak.jaw) {
      peak = { jaw: sample.jaw, atMs: Date.now() - click.at, currentTime: sample.currentTime };
      if (!midShot && sample.jaw > (baselineJaw ?? 0) + JAW_SPEECH_MARGIN) {
        await page.screenshot({ path: join(outDir, `${browserName}-${delayMs}ms-02-midspeech.png`) });
        midShot = true;
      }
    }
    /*
      THE PLAYER CANNOT BE THE END-OF-LINE SIGNAL. `onActionComplete` runs
      `stopAudio()`, which pauses the element AND rewinds it to 0 — which also
      clears `ended`. So the first sample after the line finishes reports
      `currentTime: 0, ended: false`, and a break phrased on the player's own
      state can never fire; the loop just burned its whole budget. The caption
      is the surface's own completion signal, and `audioSeen` holds the
      high-water clock, so a line cut short still reads as cut short below.
    */
    if (sample.ended || (audioSeen.currentTime > 0 && sample.caption === '')) {
      ended = true;
      break;
    }
  }

  // The line is over. Wait for the surface to clear the caption (its own signal
  // that the action completed), give the smoother time to fall, then read.
  // Cleared means EMPTY, not absent: the caption is a live region that stays
  // mounted between lines so the next one is announced reliably, so waiting
  // for the element to leave the DOM would wait forever.
  let captionCleared = false;
  if (ended) {
    captionCleared = await page
      .waitForFunction(
        () => (document.querySelector('.moyo-tutor-room-caption')?.textContent?.trim() ?? '') === '',
        null,
        { timeout: 5_000 },
      )
      .then(() => true, () => false);
  }
  await page.waitForTimeout(JAW_SETTLE_MS);
  const settled = await page.evaluate(readSpeechSample);
  await page.screenshot({ path: join(outDir, `${browserName}-${delayMs}ms-03-settled.png`) });
  const hintEnabledAgain = await button.isEnabled();

  const playLog = await page.evaluate(() => globalThis.__playLog.map((r) => ({ ...r })));
  await context.close();
  await browser.close();

  const rejected = playLog.filter((r) => r.status === 'rejected');
  const resolved = playLog.filter((r) => r.status === 'resolved');
  const jawThreshold = (baselineJaw ?? 0) + JAW_SPEECH_MARGIN;
  const restCeiling = (baselineJaw ?? 0) + JAW_REST_TOLERANCE;
  const checks = {
    playOnce: playLog.length === 1 && resolved.length === 1 && rejected.length === 0,
    oneResolvePerPiece: tally.calls === PIECES.length,
    audioAdvanced: audioSeen.currentTime > 0,
    jawOpenMidSpeech: peak.jaw > 0 && peak.jaw > jawThreshold,
    lineEnded:
      ended &&
      captionCleared &&
      audioSeen.duration > 0 &&
      audioSeen.currentTime >= audioSeen.duration - LINE_END_TOLERANCE_S,
    jawClosedAfter: (settled.jaw ?? 0) <= restCeiling,
    controlsReleased: hintEnabledAgain,
  };
  const pass = Object.values(checks).every(Boolean);

  return {
    browser: browserName,
    delayMs,
    pass,
    checks,
    tapDuringResolve,
    resolveCalls: tally.calls,
    playCalls: playLog.length,
    playRejected: rejected.map((r) => r.error),
    baselineJaw,
    peakJaw: peak.jaw,
    peakJawAtMs: peak.atMs,
    jawThreshold,
    settledJaw: settled.jaw,
    restCeiling,
    audioAdvancedToSeconds: Number(audioSeen.currentTime.toFixed(2)),
    audioDurationSeconds: Number(audioSeen.duration.toFixed(2)),
    pageErrors: pageErrors.slice(0, 3),
  };
}

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
      log(`\n[run] ${browserName} · resolve delayed ${delayMs}ms`);
      const result = await runCase({ browserName, delayMs, fixtures, origin });
      results.push(result);
      log(JSON.stringify(result, null, 2));
    }
  }
} finally {
  server.close();
}

writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
log(`\n[jaw-cycle] ${results.length - failed.length}/${results.length} passed`);
log(`[jaw-cycle] screenshots + results in ${outDir}`);
process.exit(failed.length > 0 ? 1 : 0);

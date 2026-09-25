/**
 * Proof that a MUTED line still finishes. Builds the marketing site, serves the
 * prerendered output, presses "Mute Natalie" with a real mouse, taps
 * "Give me a hint", and asks whether the line ever ends.
 *
 *   node apps/web-vite/e2e/natalie-muted-line.mjs \
 *     [--browser chromium] [--out <dir>] [--skip-build] [--port 5220] [--delay 0]
 *
 * WHY A MUTED LINE CAN HANG. `startPlayer` skips `play()` when the visitor has
 * muted Natalie. Hand the scene that silent player anyway and `currentTime`
 * never leaves zero, so the completion branch in natalie-scene.tsx never sees
 * the clock pass the duration: the caption stays up and every action control
 * stays disabled until the visitor unmutes. The surface has to run the line off
 * the caption clock instead, with no player at all.
 *
 * THE VERDICT IS THE OPPOSITE OF THE JAW-CYCLE PROOF. There, a line that does
 * not open the jaw is the defect. Here it is the requirement — a muted line
 * articulates nothing — so `jawOpen` must stay within JAW_SPEECH_MARGIN of its
 * idle baseline for the whole line, and completion is read off the caption and
 * the controls instead.
 *
 * The controls report unavailability with `aria-disabled`, not the `disabled`
 * attribute (packages/ui/Button.tsx sets the ARIA state and drops the press
 * handler), so both are read back rather than trusting one of them.
 *
 * SOT: apps/web-vite/e2e/natalie-harness.mjs
 *      apps/web-vite/e2e/natalie-jaw-cycle.mjs
 *      apps/web-vite/src/components/chapters/natalie-surface.tsx
 *      apps/web-vite/src/components/chapters/natalie-scene.tsx
 * SOT-KEYWORDS: natalie e2e playwright proof muted silent line completes caption
 *               clears controls released jaw at rest aria-disabled trusted click
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
const browserNames = String(args.flag('browser', 'chromium')).split(',').map((b) => b.trim());
const delayMs = Number(args.flag('delay', 0));
const port = Number(args.flag('port', 5220));
const outDir = resolve(args.flag('out', join(tmpdir(), 'natalie-muted-line')));
const pagePath = args.flag('path', DEFAULT_PAGE_PATH);

/** The one control whose label carries its own state. */
const VOICE_TOGGLE = /(Unmute|Mute) Natalie/;
/**
 * The hint line is scripted at 3.5 s, but the scene's fallback clock advances
 * by a per-frame delta clamped at 50 ms, so a headless frame rate stretches it
 * in wall time — measured ~10 s here. This is triple that. A line held open by
 * the defect burns the whole budget instead.
 */
const LINE_BUDGET_MS = 30_000;
/** When the mid-line screenshot is taken: far enough in to be inside the line. */
const MID_LINE_SHOT_MS = 1500;

async function runCase({ browserName, fixtures, origin }) {
  const browser = await BROWSERS[browserName].launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error).slice(0, 400)));

  await page.addInitScript(initHooks);
  await installVoiceRoute(page, { fixtures, origin, delayMs });
  const hint = await openChapter(page, { origin, pagePath });

  const toggle = page.locator('button').filter({ hasText: VOICE_TOGGLE }).first();
  await toggle.scrollIntoViewIfNeeded();
  const toggleBefore = (await toggle.textContent())?.trim() ?? '';
  await trustedClick(page, toggle);
  const toggleAfter = (await toggle.textContent())?.trim() ?? '';

  const baselineJaw = await page.evaluate(readJaw);
  await page.screenshot({ path: join(outDir, `${browserName}-01-muted-idle.png`) });

  const click = await trustedClick(page, hint);

  /*
    The caption element is absent while the caption is empty, so "cleared" and
    "never started" read identically. Confirm the line began before the loop is
    allowed to treat an empty caption as the end of it.
  */
  const captionAppeared = await page
    .waitForFunction(
      () => (document.querySelector('.moyo-tutor-room-caption')?.textContent?.trim().length ?? 0) > 0,
      null,
      { timeout: 5_000 },
    )
    .then(() => true, () => false);

  let peak = { jaw: baselineJaw ?? 0, atMs: 0 };
  let captionCleared = false;
  let midShot = false;
  while (Date.now() - click.at < LINE_BUDGET_MS) {
    const sample = await page.evaluate(readSpeechSample);
    if ((sample.jaw ?? 0) > peak.jaw) peak = { jaw: sample.jaw, atMs: Date.now() - click.at };
    if (!midShot && Date.now() - click.at >= MID_LINE_SHOT_MS) {
      await page.screenshot({ path: join(outDir, `${browserName}-02-mid-line.png`) });
      midShot = true;
    }
    if (captionAppeared && sample.caption === '') {
      captionCleared = true;
      break;
    }
  }
  if (!midShot) await page.screenshot({ path: join(outDir, `${browserName}-02-mid-line.png`) });

  const settled = await page.evaluate(readSpeechSample);
  await page.screenshot({ path: join(outDir, `${browserName}-03-after-line.png`) });
  const hintEnabled = await hint.isEnabled();
  const hintAriaDisabled = await hint.getAttribute('aria-disabled');
  const controlsText = (await page.locator('.moyo-tutor-room-controls').first().textContent()) ?? '';
  const playLog = await page.evaluate(() => globalThis.__playLog.map((r) => ({ ...r })));

  await context.close();
  await browser.close();

  const jawCeiling = (baselineJaw ?? 0) + JAW_SPEECH_MARGIN;
  const checks = {
    mutedBeforeTap: toggleBefore === 'Mute Natalie' && toggleAfter === 'Unmute Natalie',
    lineStarted: captionAppeared,
    captionCleared,
    controlsReleased: hintEnabled && hintAriaDisabled !== 'true',
    jawStayedAtRest: peak.jaw <= jawCeiling,
    // Muted must not reach the player at all, and must not be reported as a
    // voice failure — it is the visitor's own choice, not a broken service.
    noPlaybackAttempt: playLog.length === 0,
    notFlaggedUnavailable: !controlsText.includes('voice unavailable'),
  };
  const pass = Object.values(checks).every(Boolean);

  return {
    browser: browserName,
    pass,
    checks,
    toggleBefore,
    toggleAfter,
    baselineJaw,
    peakJaw: peak.jaw,
    peakJawAtMs: peak.atMs,
    jawCeiling,
    settledJaw: settled.jaw,
    lineEndedAfterMs: captionCleared ? Date.now() - click.at : null,
    hintEnabled,
    hintAriaDisabled,
    captionAtEnd: settled.caption,
    playCalls: playLog.length,
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
    log(`\n[run] ${browserName} · muted line`);
    const result = await runCase({ browserName, fixtures, origin });
    results.push(result);
    log(JSON.stringify(result, null, 2));
  }
} finally {
  server.close();
}

writeFileSync(join(outDir, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
log(`\n[muted-line] ${results.length - failed.length}/${results.length} passed`);
log(`[muted-line] screenshots + results in ${outDir}`);
process.exit(failed.length > 0 ? 1 : 0);

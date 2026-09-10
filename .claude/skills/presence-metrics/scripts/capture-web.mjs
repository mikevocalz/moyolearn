#!/usr/bin/env node
// Captures a rendered surface: per-frame motion energy and frame times.
//
// MOTION ENERGY FROM THE COMPOSITED FRAME, not from the generator that fed it.
// The distinction is the point — `life-layer`'s distribution check validates
// what the idle engine PRODUCES; this measures what reached the screen. Between
// them sit the renderer, the skinning and the device, and a periodicity
// introduced by any of them is invisible to the first check.
//
// SCREENSHOTS, NOT `drawImage`. The obvious implementation samples the canvas
// in-page into a 2D scratch context, and it silently does not work here: the
// avatar renders through WebGPU, and reading that canvas back through
// `drawImage` returns a uniformly blank image. Measured — the whiteboard's 2D
// canvas read back with pixel variance 240 and the avatar's with 0 — after it
// had already produced an autocorrelation of 0.05 that meant nothing, because
// a still image has no period. Playwright's screenshot goes through the
// compositor and captures GPU output.
//
// The cost is frame rate: this samples at whatever the screenshot round trip
// allows, not at vsync. That is enough for the periods this is looking for —
// arm pumping and gesture loops live between 1 and 4 seconds.
//
// TWO PASSES, not one. A screenshot stalls the compositor, so a frame-time
// series measured while screenshots are being taken is measuring this script.
// Pass one runs clean and produces the frame times; pass two takes the
// screenshots. Each window is `seconds` long, so the run takes twice that.
//
// FULL RESOLUTION, AND A CHANGED-PIXEL FRACTION rather than a mean difference.
// Both halves of that were learned the same way. Idle motion is a few degrees
// of sway and a blink: it moves silhouette edges and eyelids by a pixel or two
// and leaves the torso identical, so a mean over the whole frame divides a
// real signal by the large static area around it, and a downsample averages
// the moving edges into their static neighbours before the difference is even
// taken. Measured on the same pair of frames 2.5s apart: 0.04 at 64x64, 0.51
// at full resolution, and 2.3% of pixels moved by more than the 8-bit noise
// floor. The third number is the one that tracks what a person would call
// motion, and it is bounded 0..1 rather than being in arbitrary grey levels.
import { chromium } from '/Users/mikevocalz/MoyoLearn/node_modules/playwright/index.mjs';
import sharp from '/Users/mikevocalz/MoyoLearn/node_modules/sharp/dist/index.mjs';
import { writeFileSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:3100/tutor?persona=jordan';
const seconds = Number(process.argv[3] ?? 30);
const out = process.argv[4] ?? '/tmp/capture-web.json';

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
// The avatar's first frame is logged by the stage; give it room to arrive and
// for the idle engine to leave any entrance transient.
await page.waitForTimeout(6000);

// PASS ONE — frame times, in-page and uninterrupted.
const frameMs = await page.evaluate(
  (durationS) =>
    new Promise((resolve) => {
      const samples = [];
      let last = performance.now();
      const started = last;
      const tick = () => {
        const now = performance.now();
        samples.push(now - last);
        last = now;
        if (now - started < durationS * 1000) requestAnimationFrame(tick);
        else resolve(samples);
      };
      requestAnimationFrame(tick);
    }),
  seconds,
);

// The avatar pane. Its canvas carries no class, so it is found by being the
// largest one that is not the whiteboard's.
const clip = await page.evaluate(() => {
  const avatar = [...document.querySelectorAll('canvas')]
    .filter((c) => !String(c.className ?? '').startsWith('qd-'))
    .sort((a, b) => b.width * b.height - a.width * a.height)[0];
  if (!avatar) return null;
  const r = avatar.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
});
if (!clip) {
  console.error('no avatar canvas found — nothing to measure');
  await browser.close();
  process.exit(1);
}

// PASS TWO — motion off the composited frame.
const frames = [];
let previous = null;
const started = Date.now();
while ((Date.now() - started) / 1000 < seconds) {
  const png = await page.screenshot({ clip, type: 'png' });
  const raw = await sharp(png).greyscale().raw().toBuffer();
  let moved = 0;
  if (previous) {
    // > 2 grey levels: above 8-bit quantisation, below anything visible.
    for (let i = 0; i < raw.length; i += 1) if (Math.abs(raw[i] - previous[i]) > 2) moved += 1;
  }
  previous = raw;
  frames.push({ t: (Date.now() - started) / 1000, channels: { motion: moved / raw.length } });
}

const result = { frames, frameMs, clip };

await browser.close();

const times = result.frameMs.filter((v) => v > 0).sort((a, b) => a - b);
const q = (f) => times[Math.min(times.length - 1, Math.floor(times.length * f))];
writeFileSync(out, `${JSON.stringify(result.frames)}\n`);

const energies = result.frames.slice(1).map((f) => f.channels.motion);
const meanEnergy = energies.reduce((a, b) => a + b, 0) / Math.max(1, energies.length);
const peakEnergy = Math.max(...energies);

console.log(
  `${result.frames.length} samples over ${seconds}s (${(result.frames.length / seconds).toFixed(1)}/s) · ` +
    `clip ${result.clip.width}x${result.clip.height}\n` +
    `frameMs p50 ${q(0.5).toFixed(2)} · p95 ${q(0.95).toFixed(2)} · p99 ${q(0.99).toFixed(2)} (${times.length} frames)\n` +
    `moving pixels: mean ${(meanEnergy * 100).toFixed(2)}% · peak ${(peakEnergy * 100).toFixed(2)}%\n` +
    `wrote ${out}`,
);
/*
  A capture with no motion cannot support a statement about periodic motion. It
  is refused rather than reported, because "no periodicity" measured on a still
  image is the most confident wrong answer this toolkit could produce.
*/
if (meanEnergy < 0.001) {
  console.error(`\nREFUSED: ${(meanEnergy * 100).toFixed(3)}% of pixels moving — the surface is static, or the capture is not seeing it.`);
  console.error('Any periodicity result from this capture would be measured on a still image.');
  process.exit(2);
}

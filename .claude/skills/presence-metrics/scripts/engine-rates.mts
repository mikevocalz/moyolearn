// Blink and breath rates from the generator, over a long deterministic run.
// The renderer neither adds nor drops a blink, so the engine is the right place
// to count them; what the renderer can affect is timing, which is a different
// field. Seeded, so this is reproducible rather than a sample.
import { IdleEngine } from '/Users/mikevocalz/MoyoLearn/packages/avatar/src/idle/engine.ts';

const dt = 1 / 60;
const minutes = 20;
const steps = Math.round(minutes * 60 * 60);
const e = new IdleEngine();
let blinks = 0;
const breathTimes: number[] = [];
for (let i = 0; i < steps; i++) {
  const o = e.step(dt, {});
  if (o.blinkStarted) blinks++;
  // breath period: count zero-up-crossings of breathY
  if (o.breathStarted) breathTimes.push(i * dt);
}
const periods = breathTimes.slice(1).map((t, i) => t - breathTimes[i]);
const mean = periods.reduce((a, b) => a + b, 0) / periods.length;
const sd = Math.sqrt(periods.reduce((a, b) => a + (b - mean) ** 2, 0) / periods.length);
console.log(`over ${minutes} min at ${1 / dt}Hz, seeded`);
console.log(`blinks ${blinks} -> ${(blinks / minutes).toFixed(2)}/min`);
console.log(`breath cycles ${periods.length} -> ${(60 / mean).toFixed(2)}/min · period ${mean.toFixed(2)}s ± ${(100 * sd / mean).toFixed(1)}%`);

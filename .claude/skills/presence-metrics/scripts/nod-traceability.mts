// backchannelCuesTraceable: every nod traceable to a logged cue.
//
// By construction (src/idle/engine.ts, "backchannel nods" block) a nod can
// only start on partnerPauseEvent || partnerF0Falling while !speechActive,
// under a refractory; the periodic timer-nod was removed (the constructor
// still burns its PRNG draw to keep the seeded stream stable). This script
// verifies the construction behaves: a 20-min cued run where every nod onset
// (nodPitch leaving zero) must land exactly on a cue frame, and a 20-min
// cue-free control run that must contain zero onsets.
//
// Cue schedule: a partnerPauseEvent pulse (one frame) every 18 s from t=10 s,
// each followed by an echo pulse 0.8 s later — inside the 2.2 s refractory
// (refractoryS 1.5 + 2×0.35 s nod) — so count(nods) < count(cues) is
// exercised, not just count(nods) ≤ count(cues).
import { IdleEngine } from '/Users/mikevocalz/MoyoLearn/packages/avatar/src/idle/engine.ts';

const DT = 1 / 60;
const STEPS = 20 * 60 * 60;

const cueFrames = new Set<number>();
for (let t = 10; t < 20 * 60; t += 18) {
  cueFrames.add(Math.round(t * 60));
  cueFrames.add(Math.round((t + 0.8) * 60));
}

// Onset definition, calibrated to the waveform rather than to hope:
// nodPitch = amp·sin(π·(nodT mod nodS)/nodS) samples EXACTLY 0 on the cue
// frame itself (nodT=0) and for exactly one frame between the two nods of a
// sequence (nodS=0.35 s is exactly 21 frames at 60 Hz). So an onset is
// nodPitch leaving zero after ≥2 consecutive zero frames — the mid-sequence
// zero lasts 1 frame — and it lands one frame AFTER its cue. Traceable means
// a cue fired ≤2 frames before the onset.
function runPass(cued: boolean) {
  const e = new IdleEngine(); // engine default seed, as the other engine measurements use
  let zeroRun = 2;
  let lastCue = -Infinity;
  let onsets = 0;
  let untraceable = 0;
  const untraceableAt: number[] = [];
  for (let i = 0; i < STEPS; i += 1) {
    const cue = cued && cueFrames.has(i);
    if (cue) lastCue = i;
    const o = e.step(DT, cue ? { partnerPauseEvent: true } : {});
    if (o.nodPitch !== 0) {
      if (zeroRun >= 2) {
        onsets += 1;
        if (i - lastCue > 2) {
          untraceable += 1;
          if (untraceableAt.length < 5) untraceableAt.push(i * DT);
        }
      }
      zeroRun = 0;
    } else {
      zeroRun += 1;
    }
  }
  return { onsets, untraceable, untraceableAt };
}

const cued = runPass(true);
const control = runPass(false);
console.log(`20 min at 60 Hz, engine default seed`);
console.log(`cued run:    ${cueFrames.size} partnerPauseEvent pulses → ${cued.onsets} nod onsets, ${cued.untraceable} without a cue ≤2 frames before${cued.untraceableAt.length ? ` (at ${cued.untraceableAt.map((t) => t.toFixed(2) + 's').join(', ')})` : ''}`);
console.log(`control run: 0 cues → ${control.onsets} nod onsets`);
console.log(
  cued.untraceable === 0 && control.onsets === 0 && cued.onsets <= cueFrames.size
    ? `PASS: every nod onset lands on a cue frame; none without a cue`
    : `FINDING: nod fired without a cue`,
);

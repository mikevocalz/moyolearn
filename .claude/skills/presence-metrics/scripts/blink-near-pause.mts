// blinkNearPausePct: people blink at pauses and gaze shifts, not on a Poisson
// clock. The engine builds this in (blink hazard × gapBoost during speech
// gaps, × postSaccadeBoost for 0.3 s after a saccade — src/idle/config.ts);
// this measures whether the built-in coupling actually lands blinks inside
// ±300 ms of a cue, and how far above a RANDOM blink train that is — without
// the base rate the percentage is theater, because saccades arrive every
// 0.3–2 s and their windows alone cover much of the timeline.
//
// Scripted conversation, 20 min at 60 Hz, IdleEngine default seed (as
// engine-rates.mts and nod-traceability.mts use), schedule from
// mulberry32(303): each tutor turn is 2–4 phrases of 2–6 s
// (speechActive: true), separated and ended by 0.5–1.5 s pauses
// (speechGap: true — the humano mapping for a non-speaking beat); then a
// partner turn of 3–8 s (partnerSpeaking: true) whose last frame raises
// partnerPauseEvent — the turn end.
//
// Cues, two classes:
//   pause cues  — frames where speechActive drops (a pause begins) and
//                 partnerPauseEvent frames.
//   gaze shifts — saccadeStarted and gazeBroke frames, the engine's own
//                 observables for "the eyes moved".
// Blink onset = eyeBlinkLeft leaving 0 (the lid starts closing the frame
// after blinkStarted fires — the onset is read off the CHANNEL, not the flag).
//
// Reported: % of blink onsets within ±18 frames (±300 ms) of any cue, the
// per-class breakdown, and two baselines a random train of the same count
// scores: analytic (fraction of the timeline covered by the cue windows) and
// 200 uniform random trains (mean ± sd).
//
// ENGINE-SIDE: whether the app raises speechActive/partnerPauseEvent at real
// pauses is a different question and is not covered here.
import { IdleEngine } from '/Users/mikevocalz/MoyoLearn/packages/avatar/src/idle/engine.ts';
import { mulberry32 } from '/Users/mikevocalz/MoyoLearn/packages/avatar/src/idle/engine.ts';

const DT = 1 / 60;
const STEPS = 20 * 60 * 60;
const WIN = 18; // ±300 ms at 60 Hz
const TRIALS = 200;

type FrameInput = { speechActive: boolean; speechGap: boolean; partnerSpeaking: boolean; partnerPauseEvent: boolean };

// -- build the schedule --
const rand = mulberry32(303);
const schedule: FrameInput[] = [];
const push = (n: number, f: Omit<FrameInput, 'partnerPauseEvent'>) => {
  for (let i = 0; i < n && schedule.length < STEPS; i += 1) {
    schedule.push({ ...f, partnerPauseEvent: false });
  }
};
while (schedule.length < STEPS) {
  const phrases = 2 + Math.floor(rand() * 3); // 2–4
  for (let p = 0; p < phrases; p += 1) {
    push(Math.round((2 + rand() * 4) * 60), { speechActive: true, speechGap: false, partnerSpeaking: false });
    push(Math.round((0.5 + rand() * 1.0) * 60), { speechActive: false, speechGap: true, partnerSpeaking: false });
  }
  push(Math.round((3 + rand() * 5) * 60), { speechActive: false, speechGap: false, partnerSpeaking: true });
  if (schedule.length < STEPS) schedule[schedule.length - 1]!.partnerPauseEvent = true;
}

// -- run the engine, log onsets and cues --
const engine = new IdleEngine();
const pauseCues: number[] = [];
const gazeCues: number[] = [];
const blinks: number[] = [];
let prevBlink = 0;
let prevSpeech = false;
for (let i = 0; i < STEPS; i += 1) {
  const s = schedule[i]!;
  if (prevSpeech && !s.speechActive) pauseCues.push(i); // a pause begins
  if (s.partnerPauseEvent) pauseCues.push(i); // a turn ends
  prevSpeech = s.speechActive;
  const F = engine.step(DT, {
    speechActive: s.speechActive,
    speechGap: s.speechGap,
    processing: false,
    partnerSpeaking: s.partnerSpeaking,
    partnerPauseEvent: s.partnerPauseEvent,
    partnerF0Falling: false,
    timeUntilOnset: Infinity,
  });
  if (F.saccadeStarted) gazeCues.push(i);
  if (F.gazeBroke) gazeCues.push(i);
  if (prevBlink === 0 && F.eyeBlinkLeft > 0) blinks.push(i);
  prevBlink = F.eyeBlinkLeft;
}

// -- coverage mask per cue class, and the union --
const mask = (cues: number[]): Uint8Array => {
  const m = new Uint8Array(STEPS);
  for (const c of cues) {
    for (let f = Math.max(0, c - WIN); f <= Math.min(STEPS - 1, c + WIN); f += 1) m[f] = 1;
  }
  return m;
};
const pauseMask = mask(pauseCues);
const gazeMask = mask(gazeCues);
const anyMask = new Uint8Array(STEPS);
let covered = 0;
for (let i = 0; i < STEPS; i += 1) {
  anyMask[i] = pauseMask[i]! | gazeMask[i]!;
  covered += anyMask[i]!;
}

const score = (train: number[], m: Uint8Array): number =>
  (100 * train.reduce((acc, f) => acc + m[f]!, 0)) / train.length;

const pct = score(blinks, anyMask);
const pctPause = score(blinks, pauseMask);
const pctGaze = score(blinks, gazeMask);
const coverage = (100 * covered) / STEPS;

// Random baseline: uniform trains of the same count against the same windows.
const trialRand = mulberry32(9002);
let sum = 0, sumSq = 0;
for (let t = 0; t < TRIALS; t += 1) {
  const train = Array.from({ length: blinks.length }, () => Math.floor(trialRand() * STEPS));
  const s = score(train, anyMask);
  sum += s;
  sumSq += s * s;
}
const mean = sum / TRIALS;
const sd = Math.sqrt(Math.max(0, sumSq / TRIALS - mean * mean));

console.log(`20 min scripted conversation at 60 Hz, engine default seed, schedule mulberry32(303)`);
console.log(`cues: ${pauseCues.length} pause-class (speech drops + turn ends) · ${gazeCues.length} gaze-class (saccadeStarted + gazeBroke)`);
console.log(`blinks: ${blinks.length} onsets (eyeBlinkLeft leaving 0) → ${(blinks.length / 20).toFixed(2)}/min`);
console.log(`within ±300 ms of any cue: ${pct.toFixed(1)}%  (pause-class alone ${pctPause.toFixed(1)}% · gaze-class alone ${pctGaze.toFixed(1)}%)`);
console.log(`baseline — analytic window coverage: ${coverage.toFixed(1)}% · ${TRIALS} random trains of ${blinks.length}: ${mean.toFixed(1)}% ± ${sd.toFixed(1)}%`);
console.log(
  pct > mean + 2 * sd
    ? `PASS: blinks cluster at cues beyond a random train (+${(pct - mean).toFixed(1)} points, ${((pct - mean) / sd).toFixed(1)}σ)`
    : `FINDING: blink timing is not distinguishable from a random train against these cue windows`,
);

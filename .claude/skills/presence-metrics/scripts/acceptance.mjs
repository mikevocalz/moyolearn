#!/usr/bin/env node
// The acceptance record, and a validator that refuses an unmeasured number.
//
// The point is not the template. The point is that "not measured" has to be
// cheaper to write than a plausible number, or a record fills up with estimates
// that read exactly like measurements six weeks later. So the validator rejects
// anything that is neither a real measurement with its method attached nor the
// literal string "not measured".
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const NOT_MEASURED = 'not measured';
/*
  A third accepted answer: "blocked: <what>". It is strictly better than
  "not measured" because it names what would unblock it, and it must stay just
  as cheap to write as a number is — the moment naming a blocker costs more
  than inventing a plausible value, the record fills with plausible values.
*/
const BLOCKED = /^blocked: \S/;

// Every field the primary prompt's §8 record requires, with its unit.
const FIELDS = [
  ['lipSyncOffsetMedianMs', 'ms', 'median |viseme onset − phoneme onset|'],
  ['lipSyncOffsetP95Ms', 'ms', 'p95 of the same'],
  ['visualLateMaxMs', 'ms', 'worst visual-late offset'],
  ['headOnsetAlignedPct', '%', 'head-rotation onsets within ±150 ms of an F0 peak or phrase boundary'],
  ['headPitchJawOpenCorrelation', 'r', 'must be indistinguishable from chance'],
  ['blinkRatePerMin', '/min', 'target 12–20 with variance'],
  ['blinkNearPausePct', '%', 'blinks within ±300 ms of a pause or gaze shift'],
  ['breathRatePerMin', '/min', 'target 12–20, ±15% period variance'],
  ['torsoEnergyCorrelation', 'r', 'torso/shoulder rotation vs speech RMS, target ≥ 0.5'],
  ['gestureStrokeOffsetMs', 'ms', 'stroke apex relative to the pitch-accented syllable'],
  ['interruptVoiceStopMs', 'ms', 'target ≤ 150'],
  ['interruptSettleMs', 'ms', 'target ≤ 700'],
  ['frameTimeP95Ms', 'ms', 'inside the device tier budget'],
  ['idlePeriodicityPeak', 'r', 'autocorrelation peak over 30 s of idle'],
  ['backchannelCuesTraceable', 'bool', 'every nod traceable to a logged cue'],
  ['artifactsIn20MinCapture', 'count', 'pose resets, foot slides, eye detachments, clipping'],
];

const blank = () => ({
  $comment: `Every field is a measurement with its method, or the literal string "${NOT_MEASURED}".`,
  branch: NOT_MEASURED,
  device: NOT_MEASURED,
  audioRoute: NOT_MEASURED,
  measurements: Object.fromEntries(FIELDS.map(([k]) => [k, NOT_MEASURED])),
  blindedStudy: { n: NOT_MEASURED, measures: NOT_MEASURED, confidenceInterval: NOT_MEASURED },
});

const [, , cmd, path = 'audit/motion/acceptance-record.json'] = process.argv;

if (cmd === '--init') {
  if (existsSync(path)) {
    console.error(`${path} exists — fill it in rather than regenerating`);
    process.exit(1);
  }
  writeFileSync(path, `${JSON.stringify(blank(), null, 2)}\n`);
  console.log(`created ${path} with ${FIELDS.length} fields, all "${NOT_MEASURED}"`);
  process.exit(0);
}

if (cmd === '--check') {
  const record = JSON.parse(readFileSync(path, 'utf8'));
  const problems = [];
  for (const [key, unit, what] of FIELDS) {
    const v = record.measurements?.[key];
    if (v === undefined) {
      problems.push(`${key}: absent — say "${NOT_MEASURED}" rather than omitting it`);
      continue;
    }
    if (v === NOT_MEASURED) continue;
    if (typeof v === 'string' && BLOCKED.test(v)) continue;
    if (typeof v === 'string') {
      problems.push(`${key}: "${v}" is neither a measurement, "${NOT_MEASURED}", nor "blocked: <what>"`);
      continue;
    }
    /*
      A measurement carries HOW it was taken. A bare number is the failure this
      validator exists for: it is indistinguishable from a guess the moment the
      person who wrote it has moved on.
    */
    if (typeof v !== 'object' || v === null) {
      problems.push(`${key}: bare value — needs { value, method, capture } or "${NOT_MEASURED}" (${unit}, ${what})`);
      continue;
    }
    for (const req of ['value', 'method', 'capture']) {
      if (v[req] === undefined || v[req] === '') problems.push(`${key}: missing ${req}`);
    }
  }
  const value = (k) => record.measurements?.[k];
  const blocked = FIELDS.filter(([k]) => typeof value(k) === 'string' && BLOCKED.test(value(k))).length;
  const measured = FIELDS.filter(([k]) => typeof value(k) === 'object' && value(k) !== null).length;
  if (problems.length > 0) {
    for (const p of problems) console.error(`  FAIL ${p}`);
    process.exit(1);
  }
  console.log(
    `record valid: ${measured}/${FIELDS.length} measured · ${blocked} blocked · ` +
      `${FIELDS.length - measured - blocked} "${NOT_MEASURED}"`,
  );
  if (measured === 0) console.log('  nothing has been measured — no realism claim may be made from this record');
  process.exit(0);
}

console.error('usage: acceptance.mjs --init [path] | --check [path]');
process.exit(1);

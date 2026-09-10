#!/usr/bin/env node
// Phoneme spans -> viseme schedule. The pure half of the pipeline, as a CLI so
// replay tests can drive it with a fixture and diff the output.
//
// It reads the class table from ../references/viseme-classes.json rather than
// carrying its own copy: a second copy of a table is a table that drifts.
//
// Usage:
//   node schedule-visemes.mjs <phonemes.json> [--fps 60] [--lang en]
//
// Input, one object:
//   { "lang": "en", "durationSeconds": 1.23,
//     "phonemes": [ { "p": "P", "start": 0.02, "end": 0.06, "stress": "1" }, ... ] }
//
//   `p` is ARPAbet (lang "en") or IPA (lang "es"). `stress` is optional and
//   only read for English. Times are seconds relative to the AUDIBLE onset --
//   not the speak() call, which is ONSET_LEAD_MS earlier.
//
// Output, a Track as packages/avatar/src/speech/track.ts declares it:
//   [ [timeSeconds, { channel: weight, ... }], ... ]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const TABLE = JSON.parse(
  readFileSync(join(here, '..', 'references', 'viseme-classes.json'), 'utf8'),
);

/**
 * Dominance over one span: full weight across the phoneme itself, raised-cosine
 * tails outside it. Raised cosine because it is C1 at the tail's outer edge, so
 * the jaw gets no visible tick where a span stops contributing.
 *
 * The tails are ASYMMETRIC. A symmetric window centred on the span makes every
 * viseme lead its own phoneme by most of the half-width -- measurably, and in
 * the wrong direction for the ITU asymmetry. A mouth carries a shape over into
 * the next segment further than it anticipates the coming one, so the leading
 * tail is scaled by ANTICIPATION.
 */
const ANTICIPATION = 0.5;

function dominance(t, start, end, tailS) {
  if (t >= start && t <= end) return 1;
  if (t < start) {
    const lead = tailS * ANTICIPATION;
    if (lead <= 0) return 0;
    const x = (start - t) / lead;
    return x >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * x));
  }
  if (tailS <= 0) return 0;
  const x = (t - end) / tailS;
  return x >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * x));
}

function lookup(symbol, lang) {
  const map = lang === 'es' ? TABLE.ipaEs : TABLE.arpabet;
  return map[symbol] ?? null;
}

/**
 * Phoneme spans -> weighted class spans. Diphthongs split, HH inherits the
 * next span's class, unknown symbols are dropped and counted.
 */
export function toClassSpans(phonemes, lang) {
  const spans = [];
  const unknown = [];

  for (let i = 0; i < phonemes.length; i++) {
    const ph = phonemes[i];
    const entry = lookup(ph.p, lang);
    if (entry === null) {
      unknown.push(ph.p);
      continue;
    }

    const gain =
      lang === 'en' && ph.stress !== undefined
        ? (TABLE.stressGain[String(ph.stress)] ?? 1)
        : 1;

    if (entry.inheritsNext === true) {
      // HH has no lip target of its own. Scheduling it as silence closes the
      // mouth mid-word; borrowing the next vowel at reduced dominance does not.
      let next = null;
      for (let j = i + 1; j < phonemes.length && next === null; j++) {
        const candidate = lookup(phonemes[j].p, lang);
        if (candidate !== null && candidate.class !== null) next = candidate.class;
      }
      if (next !== null) {
        spans.push({ cls: next, start: ph.start, end: ph.end, gain: gain * 0.5, source: ph });
      }
      continue;
    }

    if (entry.class === null) continue;

    if (entry.target !== undefined) {
      // A diphthong is two spans. One held pose gives a mouth that opens on
      // "five" and stays open.
      const mid = ph.start + (ph.end - ph.start) * 0.55;
      spans.push({ cls: entry.class, start: ph.start, end: mid, gain, source: ph });
      spans.push({ cls: entry.target, start: mid, end: ph.end, gain, source: ph });
      continue;
    }

    spans.push({
      cls: entry.class,
      start: ph.start,
      end: ph.end,
      gain,
      source: ph,
      noClosure: entry.noClosure === true,
    });
  }

  return { spans, unknown };
}

/** Overlapping dominance, summed then normalized, sampled at `fps`. */
export function blend(spans, durationSeconds, fps) {
  const frames = Math.max(1, Math.ceil(durationSeconds * fps) + 1);
  const track = [];

  for (let f = 0; f < frames; f++) {
    const t = f / fps;
    const acc = Object.create(null);
    let total = 0;

    for (const span of spans) {
      const tail = TABLE.classes[span.cls].dominanceMs / 1000;
      const w = dominance(t, span.start, span.end, tail);
      if (w === 0) continue;
      total += w;
      const shape = TABLE.classes[span.cls].shape;
      for (const [channel, value] of Object.entries(shape)) {
        // Jaw carries stress; the lip channels do not, so the gain is applied
        // to jawOpen alone. Scaling everything would make an unstressed
        // syllable read as a quieter version of the same face rather than a
        // less open one.
        const scaled = channel === 'jawOpen' ? value * span.gain : value;
        acc[channel] = (acc[channel] ?? 0) + w * scaled;
      }
    }

    const shape = Object.create(null);
    if (total > 0) {
      for (const [channel, value] of Object.entries(acc)) {
        const v = value / total;
        if (v > 1e-4) shape[channel] = Math.min(1, v);
      }
    }
    track.push([t, shape]);
  }

  return track;
}

/**
 * Bilabial closure, AFTER blending. Dominance alone never reaches a closed
 * mouth between two open vowels, and a /p/ that does not close is the single
 * most legible lip-sync failure there is.
 */
export function enforceClosure(track, spans, fps) {
  const { minClosedMs, mouthCloseFloor, jawOpenCeiling } = TABLE.closure;
  const frame = 1 / fps;

  for (const span of spans) {
    if (TABLE.classes[span.cls].bilabial !== true) continue;
    if (span.noClosure === true) continue;

    const held = Math.max(minClosedMs / 1000, span.end - span.start);
    const from = span.start;
    const to = span.start + held;

    for (const [t, shape] of track) {
      if (t < from - frame || t > to + frame) continue;
      // One frame of ease at each edge, so the clamp does not reintroduce the
      // derivative discontinuity the raised cosine was chosen to avoid.
      const ease =
        t < from ? (t - (from - frame)) / frame : t > to ? ((to + frame) - t) / frame : 1;
      const k = Math.max(0, Math.min(1, ease));
      if (k === 0) continue;

      shape.mouthClose = Math.max(shape.mouthClose ?? 0, mouthCloseFloor * k);
      if ((shape.jawOpen ?? 0) > jawOpenCeiling) {
        shape.jawOpen = (shape.jawOpen ?? 0) * (1 - k) + jawOpenCeiling * k;
      }
      // A closed mouth that is simultaneously smiling or funnelled is an
      // impossible face; face-adapter's detector flags it as one.
      for (const channel of TABLE.closure.clearChannels) {
        if (shape[channel] !== undefined) {
          shape[channel] *= 1 - k;
          if (shape[channel] <= 1e-4) delete shape[channel];
        }
      }
      if (shape.jawOpen !== undefined && shape.jawOpen <= 1e-4) delete shape.jawOpen;
    }
  }

  return track;
}

export function schedule(input, fps = 60) {
  const lang = input.lang ?? 'en';
  const { spans, unknown } = toClassSpans(input.phonemes, lang);
  const duration =
    input.durationSeconds ?? spans.reduce((m, s) => Math.max(m, s.end), 0);
  const track = enforceClosure(blend(spans, duration, fps), spans, fps);
  return { track, spans, unknown };
}

function main(argv) {
  const args = argv.slice(2);
  const path = args.find((a) => !a.startsWith('--'));
  if (path === undefined) {
    process.stderr.write('usage: schedule-visemes.mjs <phonemes.json> [--fps 60]\n');
    process.exit(2);
  }
  const fpsFlag = args.indexOf('--fps');
  const fps = fpsFlag === -1 ? 60 : Number(args[fpsFlag + 1]);
  const langFlag = args.indexOf('--lang');

  const input = JSON.parse(readFileSync(path, 'utf8'));
  if (langFlag !== -1) input.lang = args[langFlag + 1];

  const { track, unknown } = schedule(input, fps);
  if (unknown.length > 0) {
    // Loud, on stderr, because a silent downgrade is how "lip sync looks off"
    // becomes unreproducible.
    process.stderr.write(
      `unmapped phonemes dropped (${unknown.length}): ${[...new Set(unknown)].join(' ')}\n`,
    );
  }
  process.stdout.write(JSON.stringify(track) + '\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv);

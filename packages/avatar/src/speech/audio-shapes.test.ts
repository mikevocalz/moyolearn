/**
 * The properties that separate audio lipsync from `evenTrack`: silence is shut,
 * loud is open, and a sibilant is not read as a vowel.
 *
 * SOT: ./audio-shapes.ts
 * SOT-KEYWORDS: lipsync test energy zcr silence sibilant vowel track
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyseSpeech } from './audio-shapes.ts';

const RATE = 24000;

/** `seconds` of a sine at `hz`, amplitude `amp`. */
function tone(seconds: number, hz: number, amp: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / RATE);
  return out;
}

function concat(...parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

/** Openness at `t` seconds, from the nearest keyframe at or before it. */
function openAt(track: ReturnType<typeof analyseSpeech>, t: number): number {
  let value = 0;
  for (const [time, shape] of track) {
    if (time > t) break;
    value = shape.open ?? 0;
  }
  return value;
}
function spreadAt(track: ReturnType<typeof analyseSpeech>, t: number): number {
  let value = 0;
  for (const [time, shape] of track) {
    if (time > t) break;
    value = shape.spread ?? 0;
  }
  return value;
}

describe('analyseSpeech', () => {
  it('shuts her mouth in silence — the gap between words is a gap', () => {
    const track = analyseSpeech(
      concat(tone(0.3, 220, 0.5), new Float32Array(RATE * 0.3), tone(0.3, 220, 0.5)),
      RATE,
    );
    assert.ok(openAt(track, 0.15) > 0.5, 'the first word is shut');
    assert.equal(openAt(track, 0.45), 0, 'she chews through the gap');
    assert.ok(openAt(track, 0.75) > 0.5, 'the second word is shut');
  });

  it('follows loudness rather than letters', () => {
    const track = analyseSpeech(concat(tone(0.3, 220, 0.12), tone(0.3, 220, 1.0)), RATE);
    assert.ok(openAt(track, 0.45) > openAt(track, 0.15) + 0.2, 'stress is flat');
  });

  it('reads a sibilant as spread and nearly shut, not as a small vowel', () => {
    // 8 kHz stands in for /s/: same loudness as the vowel, far more crossings.
    const vowel = analyseSpeech(tone(0.4, 220, 0.6), RATE);
    const sibilant = analyseSpeech(tone(0.4, 8000, 0.6), RATE);
    assert.ok(spreadAt(sibilant, 0.2) > 0.8, 'sibilant not detected');
    assert.equal(spreadAt(vowel, 0.2), 0, 'vowel read as sibilant');
    assert.ok(openAt(sibilant, 0.2) < openAt(vowel, 0.2) * 0.6, 'the /s/ gapes');
  });

  it('normalises against the utterance, so a quiet take still articulates', () => {
    const loud = analyseSpeech(tone(0.4, 220, 0.9), RATE);
    const quiet = analyseSpeech(tone(0.4, 220, 0.09), RATE);
    assert.ok(Math.abs(openAt(loud, 0.2) - openAt(quiet, 0.2)) < 0.05);
  });

  it('ends shut, so sampling past the last keyframe is not a held vowel', () => {
    const track = analyseSpeech(tone(0.3, 220, 0.6), RATE);
    assert.equal(track[track.length - 1]?.[1].open, 0);
  });
});

#!/usr/bin/env node
// Measures the delay a device and audio route add between the audio graph
// clock and the sound leaving the speaker.
//
// AudioContext.currentTime is the GRAPH clock. The mixer, DAC, jack and any
// Bluetooth codec buffer sit downstream of it and are invisible to it, so the
// schedule can be perfect and the mouth still late. See the header of
// packages/avatar/src/speech/backend-audio-api.ts, which names the problem and
// the right home for the fix.
//
// Usage:
//   node measure-offset.mjs <source.wav> <capture.wav> [--max-ms 600]
//
// <source.wav>  the rendered utterance, exactly as the client decodes it
// <capture.wav> a loopback recording of that utterance played on the target
//               device and route, started before playback begins
//
// Both must be uncompressed PCM WAV (16- or 32-bit, mono or stereo, any rate).
// Keep the clip under ~10 s: the method is insensitive to level and to a
// codec's frequency response, but it is sensitive to clock drift over a long
// capture.
//
// Prints the lag in ms and a confidence number. Put the result in
// references/device-calibration.md. Run it three times; a spread above ~15 ms
// means the capture is contaminated.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Minimal RIFF/WAVE reader: PCM integer and IEEE float, mono-mixed. */
export function readWav(buffer) {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const tag = (o) => String.fromCharCode(view.getUint8(o), view.getUint8(o + 1), view.getUint8(o + 2), view.getUint8(o + 3));

  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a RIFF/WAVE file');

  let offset = 12;
  let format = null;
  let data = null;

  while (offset + 8 <= view.byteLength) {
    const id = tag(offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (id === 'fmt ') {
      format = {
        code: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bits: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      data = { start: body, size: Math.min(size, view.byteLength - body) };
    }
    // Chunks are word-aligned; an odd size carries one pad byte.
    offset = body + size + (size % 2);
  }

  if (format === null || data === null) throw new Error('missing fmt or data chunk');

  const bytesPerSample = format.bits / 8;
  const frames = Math.floor(data.size / (bytesPerSample * format.channels));
  const out = new Float32Array(frames);

  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < format.channels; c++) {
      const at = data.start + (f * format.channels + c) * bytesPerSample;
      if (format.code === 3 && format.bits === 32) sum += view.getFloat32(at, true);
      else if (format.bits === 16) sum += view.getInt16(at, true) / 32768;
      else if (format.bits === 32) sum += view.getInt32(at, true) / 2147483648;
      else if (format.bits === 24) {
        const lo = view.getUint8(at);
        const mid = view.getUint8(at + 1);
        const hi = view.getInt8(at + 2);
        sum += ((hi << 16) | (mid << 8) | lo) / 8388608;
      } else throw new Error(`unsupported sample format: code ${format.code}, ${format.bits}-bit`);
    }
    out[f] = sum / format.channels;
  }

  return { samples: out, sampleRate: format.sampleRate };
}

/**
 * Amplitude envelope at a fixed rate. Correlating envelopes rather than raw
 * samples is what makes the measurement immune to the codec's phase and
 * frequency response -- a Bluetooth capture is not waveform-identical to the
 * source, but its envelope is.
 */
export function envelope(samples, sampleRate, envRate = 1000) {
  const hop = Math.max(1, Math.round(sampleRate / envRate));
  const frames = Math.floor(samples.length / hop);
  const env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) sum += samples[i] * samples[i];
    env[f] = Math.sqrt(sum / hop);
  }
  return env;
}

function normalize(env) {
  let mean = 0;
  for (const v of env) mean += v;
  mean /= env.length || 1;
  const out = new Float32Array(env.length);
  let energy = 0;
  for (let i = 0; i < env.length; i++) {
    out[i] = env[i] - mean;
    energy += out[i] * out[i];
  }
  const norm = Math.sqrt(energy) || 1;
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

/**
 * Normalized cross-correlation over positive lags only: the capture cannot
 * lead the source, so a best lag at or below 0 means the capture started after
 * playback and the measurement is invalid.
 */
export function bestLag(source, capture, maxLagFrames) {
  const a = normalize(source);
  const b = normalize(capture);
  const span = Math.min(a.length, b.length - 1);

  let best = { lag: 0, r: -Infinity };
  let second = -Infinity;

  for (let lag = 0; lag <= maxLagFrames; lag++) {
    const n = Math.min(span, b.length - lag);
    if (n < 32) break;
    let r = 0;
    for (let i = 0; i < n; i++) r += a[i] * b[i + lag];
    r /= Math.sqrt(n);
    if (r > best.r) {
      second = best.r;
      best = { lag, r };
    } else if (r > second) second = r;
  }

  return { ...best, second };
}

function main(argv) {
  const args = argv.slice(2);
  const files = args.filter((a) => !a.startsWith('--'));
  if (files.length < 2) {
    process.stderr.write('usage: measure-offset.mjs <source.wav> <capture.wav> [--max-ms 600]\n');
    process.exit(2);
  }

  const maxFlag = args.indexOf('--max-ms');
  const maxMs = maxFlag === -1 ? 600 : Number(args[maxFlag + 1]);

  const source = readWav(readFileSync(files[0]));
  const capture = readWav(readFileSync(files[1]));

  const envRate = 1000;
  const a = envelope(source.samples, source.sampleRate, envRate);
  const b = envelope(capture.samples, capture.sampleRate, envRate);

  if (b.length <= a.length) {
    process.stderr.write(
      'capture is not longer than the source: start recording BEFORE playback begins\n',
    );
    process.exit(2);
  }

  const { lag, r, second } = bestLag(a, b, Math.round((maxMs / 1000) * envRate));
  const offsetMs = (lag / envRate) * 1000;
  // Peak-to-runner-up ratio. A broad or ambiguous correlation means room
  // reflections or a noisy capture, not a real reading.
  const confidence = second > 0 ? r / second : Infinity;

  process.stdout.write(`route offset: ${offsetMs.toFixed(1)} ms\n`);
  process.stdout.write(`peak correlation: ${r.toFixed(4)}  peak/runner-up: ${confidence === Infinity ? 'inf' : confidence.toFixed(2)}\n`);

  if (lag === 0) {
    process.stderr.write('best lag is 0 -- the capture probably started after playback. Re-record.\n');
    process.exit(1);
  }
  if (confidence < 1.2) {
    process.stderr.write('correlation peak is not distinct. Quieter room, closer mic, shorter clip. Do not record this number.\n');
    process.exit(1);
  }

  process.stdout.write('\nRecord in references/device-calibration.md with device, exact OS build, route class, date and operator.\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv);

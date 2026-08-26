// The gate before a credential exists. This is the one piece of upload logic
// with branches a user can hit, and the one where being wrong means either a
// rejected legitimate file or an accepted illegitimate one.
// SOT-KEYWORDS: presign media upload validation test limits key ownership
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertUploadable,
  buildKey,
  buildVoiceNoteKeys,
  PresignRejected,
  safeName,
} from './presign.rules.ts';
import { MAX_BYTES, type MediaKind } from './media.types.ts';

const AT = new Date('2026-08-26T12:00:00Z');
let n = 0;
const run = (over: { filename?: string; contentType?: string; size?: number; kind?: MediaKind } = {}) => {
  const kind = over.kind ?? 'audio';
  assertUploadable(kind, over.contentType ?? 'audio/m4a', over.size ?? 1024);
  return { key: buildKey(kind, 'riverside-unified', over.filename ?? 'note.m4a', `id-${n++}`, AT) };
};

describe('presign rules', () => {
  it('scopes the key to the caller, from ctx and not from input', () => {
    const { key } = run();
    assert.ok(key.startsWith('audio/riverside-unified/2026-08-26/'), key);
  });

  it('rebuilds the filename rather than trusting it', () => {
    // A traversal attempt survives only as an ordinary, harmless filename. The
    // point is not what it becomes — it is that it cannot leave its segment.
    const { key } = run({ filename: '../../etc/passwd' });
    assert.ok(!key.includes('..'), key);
    assert.equal(key.split('/').length, 5, `one segment per level, got: ${key}`);
    assert.equal(safeName('../../etc/passwd'), 'file.etcpasswd');
  });

  it('gives two uploads of the same filename different keys', () => {
    // Or a replace would overwrite a path the CDN is still serving.
    assert.notEqual(run().key, run().key);
  });

  it('refuses a type the kind does not allow', () => {
    assert.throws(
      () => run({ contentType: 'application/x-msdownload' }),
      (e: Error) => e instanceof PresignRejected && /can’t be uploaded/.test(e.message),
    );
  });

  it('refuses an audio file over the ceiling, naming the limit', () => {
    assert.throws(
      () => run({ size: MAX_BYTES.audio + 1 }),
      (e: Error) => e instanceof PresignRejected && e.message.includes('50 MB'),
    );
  });

  it('refuses an empty file rather than signing a zero-byte object', () => {
    assert.throws(() => run({ size: 0 }), PresignRejected);
  });

  it('accepts the audio types a voice note is actually recorded in', () => {
    for (const type of ['audio/m4a', 'audio/mp4', 'audio/aac', 'audio/webm']) {
      assert.ok(run({ contentType: type }).key, type);
    }
  });

  it('scopes to whichever owner it is given', () => {
    assert.ok(buildKey('image', 'learner-solo', 'a.png', 'id', AT).startsWith('image/learner-solo/'));
  });

  it('never lets a filename escape its segment', () => {
    for (const bad of ['../../etc/passwd', 'a/b/c.png', '..%2f..%2fx.png', '....//x.png']) {
      assert.ok(!safeName(bad).includes('/'), bad);
      assert.ok(!safeName(bad).includes('..'), bad);
    }
  });
});

describe('voice note keys', () => {
  const keys = buildVoiceNoteKeys('riverside-unified', 'm4a', 'abc', AT);

  it('puts the audio and its waveform in the same folder', () => {
    // The editor node carries ONLY the waveform URL, so the audio URL has to be
    // recoverable from it. Different folders would break that silently.
    const base = (k: string) => k.slice(0, k.lastIndexOf('/'));
    assert.equal(base(keys.audio), base(keys.waveform));
  });

  it('names them exactly what audioUrlFromWaveform expects', () => {
    assert.ok(keys.audio.endsWith('/audio.m4a'), keys.audio);
    assert.ok(keys.waveform.endsWith('/waveform.png'), keys.waveform);
  });

  it('keeps the real extension so a webm recording is not mislabelled', () => {
    assert.ok(buildVoiceNoteKeys('o', 'webm', 'id', AT).audio.endsWith('/audio.webm'));
  });

  it('falls back to m4a rather than emitting an extensionless object', () => {
    assert.ok(buildVoiceNoteKeys('o', '', 'id', AT).audio.endsWith('/audio.m4a'));
    assert.ok(buildVoiceNoteKeys('o', '../x', 'id', AT).audio.endsWith('/audio.x'));
  });

  it('scopes to the owner, like every other key', () => {
    assert.ok(keys.audio.startsWith('audio/riverside-unified/'), keys.audio);
  });
});

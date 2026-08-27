import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { audioUrlFromWaveform, isWaveformUrl } from './upload.ts';

describe('inline waveform URLs', () => {
  it('recovers the audio URL, routed through the signing door', () => {
    /*
      Not the bare CDN URL any more. The pull zone refuses unsigned reads
      (doc 29 §5) and an <audio> element cannot sign anything, so the player is
      handed the view door, which authenticates, signs and 302s to the edge.
      The recovered audio path travels as the `url` param, intact.
    */
    assert.equal(
      audioUrlFromWaveform('https://cdn.example.com/notes/abc123/waveform.png'),
      `/api/media/view?url=${encodeURIComponent('https://cdn.example.com/notes/abc123/audio.m4a')}`,
    );
  });

  it('accepts the image formats a server is likely to render', () => {
    for (const extension of ['png', 'jpg', 'jpeg', 'webp', 'WEBP']) {
      assert.ok(isWaveformUrl(`https://cdn.example.com/n/1/waveform.${extension}`), extension);
    }
  });

  it('ignores an ordinary image', () => {
    assert.equal(audioUrlFromWaveform('https://cdn.example.com/photo.png'), null);
    assert.equal(isWaveformUrl('https://cdn.example.com/photo.png'), false);
  });

  it('does not mistake a YouTube thumbnail for a waveform', () => {
    assert.equal(isWaveformUrl('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'), false);
  });
});

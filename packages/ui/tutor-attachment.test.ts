// The image cap. Small, but it is the difference between a tutor coaching one
// problem well and being handed a book.
// SOT-KEYWORDS: tutor attachment image cap max four test
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countImages, MAX_TUTOR_IMAGES, type TutorAttachment } from './tutor-attachment.ts';

const make = (kind: TutorAttachment['kind'], n: number): TutorAttachment[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `${kind}-${i}`,
    kind,
    uri: 'file://x',
    name: 'x',
    mimeType: 'image/jpeg',
  }));

describe('the image cap', () => {
  it('is four — a spread, not a book', () => {
    assert.equal(MAX_TUTOR_IMAGES, 4);
  });

  it('counts images only, so a voice note never uses up a photo slot', () => {
    const mixed = [...make('image', 2), ...make('audio', 3), ...make('document', 2)];
    assert.equal(countImages(mixed), 2);
  });

  it('reports the cap as reached at exactly four', () => {
    assert.equal(countImages(make('image', 4)) >= MAX_TUTOR_IMAGES, true);
    assert.equal(countImages(make('image', 3)) >= MAX_TUTOR_IMAGES, false);
  });
});

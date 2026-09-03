/**
 * SOT: ./reading-order.ts
 * SOT-KEYWORDS: ocr reading order test lines jumbled worksheet
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readingOrder, type TextBox } from './reading-order.ts';

const box = (text: string, x1: number, y1: number, w = 40, h = 20): TextBox => ({
  text,
  bbox: { x1, y1, x2: x1 + w, y2: y1 + h },
});

describe('readingOrder', () => {
  it('reads left to right, top to bottom whatever order the detector emitted', () => {
    // Deliberately shuffled, the way CRAFT hands them over.
    const detected = [
      box('4', 200, 10),
      box('is', 60, 10),
      box('working', 60, 60),
      box('What', 10, 10),
      box('your', 10, 60),
      box('2 +', 120, 10),
    ];
    assert.equal(readingOrder(detected), 'What is 2 + 4\nyour working');
  });

  it('keeps lines apart rather than running the page into one sentence', () => {
    const text = readingOrder([box('answer', 10, 80), box('Question', 10, 10)]);
    assert.equal(text, 'Question\nanswer');
  });

  it('treats a few pixels of skew as the same line — a photo is never square', () => {
    const text = readingOrder([box('b', 60, 13), box('a', 10, 10), box('c', 110, 8)]);
    assert.equal(text, 'a b c');
  });

  it('does not swallow an exponent into the line below', () => {
    // A superscript sits high and small; it belongs with its base, not the
    // next line down.
    // A real superscript sits high and small but still overlaps most of its
    // own height with the base's line.
    const text = readingOrder([box('x', 10, 40, 20, 24), box('2', 32, 36, 10, 14), box('= 9', 10, 90)]);
    assert.equal(text, 'x 2\n= 9');
  });

  it('drops empty detections rather than emitting blank lines', () => {
    assert.equal(readingOrder([box('a', 10, 10), box('   ', 60, 10)]), 'a');
  });

  it('is empty for nothing', () => {
    assert.equal(readingOrder([]), '');
  });
});

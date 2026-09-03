// Put OCR detections back into READING ORDER.
//
// WHY: `readAttachment` did `detections.map(d => d.text).join('\n')`, and a text
// detector emits boxes in its own order — CRAFT's is roughly by activation, not
// by position — so a worksheet came back as its own words shuffled. "Jumbled"
// is the exact symptom, and no amount of model quality fixes it, because the
// model never claimed to sort.
//
// A page is not a sorted list of boxes though; it is LINES of boxes. Sorting by
// y alone interleaves two words on the same line whose boxes differ by a pixel,
// and sorting by x alone shuffles the page. So: group boxes into lines by
// vertical overlap, then read each line left to right, and the lines top to
// bottom.
//
// Pure and typed against the shape rather than the module, so it runs in Node
// and the OCR path stays untested-in-CI only where it touches a model.
// SOT: ./read-attachment.native.ts
// SOT-KEYWORDS: ocr reading order detections bbox lines sort jumbled homework
export interface TextBox {
  bbox: { x1: number; y1: number; x2: number; y2: number };
  text: string;
}

/**
 * Fraction of a box's height that must overlap vertically for two boxes to
 * count as the same line.
 *
 * 0.5 rather than any touch: superscripts, exponents and fraction bars overlap
 * the line below them slightly, and at a low threshold every "x²" merges its
 * exponent into the main line at the wrong horizontal position. Half a box is
 * the height a genuine same-line neighbour shares.
 */
const SAME_LINE = 0.4;

const height = (a: number, b: number) => Math.max(1, b - a);

/** How much of the SHORTER of two vertical spans they share, 0..1. */
function verticalOverlap(a1: number, a2: number, b1: number, b2: number): number {
  const shared = Math.min(a2, b2) - Math.max(a1, b1);
  if (shared <= 0) return 0;
  return shared / Math.min(height(a1, a2), height(b1, b2));
}

/**
 * Detections as text, in the order a person reads them.
 *
 * Lines are joined with newlines and boxes within a line with spaces, because
 * the line breaks on a worksheet are meaningful — "3 x 4 = " and the answer box
 * under it are not one sentence.
 */
export function readingOrder(boxes: readonly TextBox[]): string {
  if (boxes.length === 0) return '';

  // Seeded in vertical order so a line is opened by its topmost box and every
  // later box is compared against a line that already exists.
  const byTop = [...boxes].sort((a, b) => a.bbox.y1 - b.bbox.y1);

  const lines: { boxes: TextBox[]; top: number; bottom: number }[] = [];
  for (const box of byTop) {
    const line = lines[lines.length - 1];
    /*
      Against the line's accumulated span, not its first box: a long line on a
      photographed page drifts, and a box compared only to the leftmost word
      falls out of the line halfway across. Overlap of the SHORTER span is what
      keeps a superscript with its base — an exponent is small and high, so it
      shares most of ITS height with the line even though it shares little of
      the line's.
    */
    if (line !== undefined && verticalOverlap(line.top, line.bottom, box.bbox.y1, box.bbox.y2) >= SAME_LINE) {
      line.boxes.push(box);
      line.top = Math.min(line.top, box.bbox.y1);
      line.bottom = Math.max(line.bottom, box.bbox.y2);
    } else {
      lines.push({ boxes: [box], top: box.bbox.y1, bottom: box.bbox.y2 });
    }
  }

  return lines
    .map((line) =>
      [...line.boxes]
        .sort((a, b) => a.bbox.x1 - b.bbox.x1)
        .map((box) => box.text.trim())
        .filter((text) => text.length > 0)
        .join(' '),
    )
    .filter((line) => line.length > 0)
    .join('\n');
}

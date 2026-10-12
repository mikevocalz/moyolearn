// Pure list geometry and gesture transaction rules; no browser or React state.
// SOT: docs/business/semantic-gestures.md
// SOT-KEYWORDS: email reorder geometry cancellation revision variable height
export type EmailRowRect = Readonly<{ id: string; left: number; top: number; width: number; height: number }>;
export type EmailDrop = Readonly<{ source: string; index: number }>;
export type EmailDrag = Readonly<{ source: string; token: number; revision: string; rows: readonly EmailRowRect[] }>;

export function validRows(rows: readonly EmailRowRect[]): boolean {
  return rows.length > 0 && new Set(rows.map((row) => row.id)).size === rows.length && rows.every((row, index) =>
    row.id.length > 0 && [row.left, row.top, row.width, row.height].every(Number.isFinite) &&
    row.width > 0 && row.height > 0 && (index === 0 || row.top >= rows[index - 1]!.top + rows[index - 1]!.height));
}

export function emailDropIndex(rows: readonly EmailRowRect[], source: string, x: number, y: number): number | null {
  if (!validRows(rows) || !Number.isFinite(x) || !Number.isFinite(y) || !rows.some((row) => row.id === source)) return null;
  const first = rows[0]!; const last = rows[rows.length - 1]!;
  // Allow gaps BETWEEN rows, never a release outside the list or over preview.
  if (y < first.top || y > last.top + last.height || !rows.some((row) => x >= row.left && x <= row.left + row.width && y >= row.top && y <= row.top + row.height)) {
    const inGap = rows.some((row, index) => {
      const next = rows[index + 1];
      return next && y > row.top + row.height && y < next.top &&
        x >= Math.max(row.left, next.left) && x <= Math.min(row.left + row.width, next.left + next.width);
    });
    if (!inGap) return null;
  }
  return rows.filter((row) => row.id !== source && y >= row.top + row.height / 2).length;
}

export function reorderEmailItems<T extends { id: string }>(items: readonly T[], source: string, index: number): readonly T[] {
  const from = items.findIndex((item) => item.id === source);
  if (from < 0 || from === index || !Number.isInteger(index) || index < 0 || index >= items.length || new Set(items.map((item) => item.id)).size !== items.length) return items;
  const next = [...items]; const [item] = next.splice(from, 1);
  next.splice(index, 0, item!);
  return next;
}

export function resolveEmailDrag(drag: EmailDrag | null, source: string, token: number, revision: string, canceled: boolean, currentRows: readonly EmailRowRect[], x: number, y: number): EmailDrop | null {
  if (!drag || canceled || drag.source !== source || drag.token !== token || drag.revision !== revision || !validRows(currentRows)) return null;
  // Resize, scroll, font reflow, removal or order changes invalidate the drag.
  if (JSON.stringify(drag.rows) !== JSON.stringify(currentRows)) return null;
  const index = emailDropIndex(currentRows, source, x, y);
  if (index === null || index === currentRows.findIndex((row) => row.id === source)) return null;
  return { source, index };
}

// Include a monotonically increasing move number so repeated destinations
// still change the live-region text and are announced by assistive technology.
export function emailMoveFeedback(previousCount: number, index: number) {
  const moveCount = previousCount + 1;
  return { moveCount, announcement: `Move ${moveCount} completed. Email block is now at position ${index + 1}.` };
}

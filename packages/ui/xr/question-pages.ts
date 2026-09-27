/** Bound spatial copy by lines as well as length; never drop OCR characters. */
export function questionPages(text: string, columns = 42, lines = 12): string[] {
  if (!Number.isInteger(columns) || columns < 1 || !Number.isInteger(lines) || lines < 1) throw new RangeError('Invalid page size');
  const rows: string[] = [];
  for (const paragraph of text.split('\n')) {
    let remaining = Array.from(paragraph);
    if (remaining.length === 0) rows.push('');
    while (remaining.length) {
      let end = Math.min(columns, remaining.length);
      if (end < remaining.length) {
        const space = remaining.slice(0, end).lastIndexOf(' ');
        if (space > 0) end = space + 1;
      }
      rows.push(remaining.slice(0, end).join(''));
      remaining = remaining.slice(end);
    }
  }
  const pages: string[] = [];
  for (let i = 0; i < rows.length; i += lines) pages.push(rows.slice(i, i + lines).join('\n'));
  return pages.length ? pages : [''];
}

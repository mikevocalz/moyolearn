// Real PDF.js parsing of synthetic valid PDF page trees, not raw-stream mocks.
// SOT-KEYWORDS: homework pdf pages font mapping ordering regression tests
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { readPdfPages } from './read-pdf-pages.ts';
function pdf(lines: readonly string[]): Uint8Array {
  const objects: string[] = [];
  const kids = lines.map((_, index) => `${3 + index * 2} 0 R`).reverse();
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(
    `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${lines.length} >>`,
  );
  const fontId = 3 + lines.length * 2;
  for (let i = 0; i < lines.length; i++) {
    const content = lines[i]
      ? `BT /F1 12 Tf 72 720 Td (${lines[i]?.replace(/[\\()]/g, '\\$&')}) Tj ET`
      : '';
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${4 + i * 2} 0 R >>`,
    );
    objects.push(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let source = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(source.length);
    source += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = source.length;
  source += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    source += `${String(offset).padStart(10, '0')} 00000 n \n`;
  source += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(source);
}
for (const count of [1, 2, 10])
  it(`reads all ${count} PDF pages in page-tree order, with source regions`, async () => {
    const input = Array.from(
      { length: count },
      (_, index) => `Original ${index + 1}: 2 + 2 = 5`,
    );
    const task = getDocument({ data: pdf(input), useSystemFonts: true });
    try {
      const result = await readPdfPages(await task.promise);
      assert.deepEqual(
        result.pages.map((page) => page.text.trim()),
        [...input].reverse(),
      );
      assert.deepEqual(
        result.pages.map((page) => page.index),
        input.map((_, i) => i + 1),
      );
      assert.ok(
        result.pages.every(
          (page) => page.status === 'text' && page.regions.length > 0,
        ),
      );
      assert.equal(result.pages[0]?.width, 612);
      assert.equal(result.pages[0]?.height, 792);
    } finally {
      await task.destroy();
    }
  });
it('retains a page without a text layer between readable pages', async () => {
  const task = getDocument({
    data: pdf(['last', '', 'first']),
    useSystemFonts: true,
  });
  try {
    const result = await readPdfPages(await task.promise);
    assert.equal(result.pages.length, 3);
    assert.equal(result.pages[1]?.status, 'needs-ocr');
    assert.match(result.text, /Page 2:\n\[Page has no readable text layer/);
    assert.match(result.text, /Page 3:\nlast/);
  } finally {
    await task.destroy();
  }
});
it('retains failed page identity and continues to later pages', async () => {
  const task = getDocument({
    data: pdf(['last', 'middle', 'first']),
    useSystemFonts: true,
  });
  try {
    const document = await task.promise;
    const result = await readPdfPages({
      numPages: document.numPages,
      getPage: (index) =>
        index === 2
          ? Promise.reject(new Error('Unreadable page'))
          : document.getPage(index),
    });
    assert.equal(result.pages[1]?.status, 'failed');
    assert.match(result.text, /Page 2:\n\[Page could not be read/);
    assert.equal(result.pages[2]?.text.trim(), 'last');
  } finally {
    await task.destroy();
  }
});
it('preserves previews when text extraction fails, and survives cleanup failure', async () => {
  const task = getDocument({
    data: pdf(['last', 'broken']),
    useSystemFonts: true,
  });
  try {
    const document = await task.promise;
    const damaged = await document.getPage(1);
    damaged.getTextContent = async () => {
      throw new Error('Broken font mapping');
    };
    damaged.cleanup = () => {
      throw new Error('Cleanup failed');
    };
    const result = await readPdfPages(
      {
        numPages: 2,
        getPage: (index) =>
          index === 1 ? Promise.resolve(damaged) : document.getPage(index),
      },
      async () => 'data:image/png;base64,preview',
    );
    assert.equal(result.pages[0]?.status, 'failed');
    assert.equal(result.pages[0]?.preview, 'data:image/png;base64,preview');
    assert.equal(result.pages[1]?.text.trim(), 'last');
  } finally {
    await task.destroy();
  }
});
it('refuses over-limit documents instead of silently truncating pages', async () => {
  await assert.rejects(
    readPdfPages({
      numPages: 101,
      getPage: async () => {
        throw new Error('Must not load pages');
      },
    }),
    /page limit/,
  );
});

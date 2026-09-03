// Read a homework DOCUMENT — pdf, docx, txt — to text, on device.
//
// WHY THIS EXISTS: `readAttachment` runs OCR on an IMAGE, and `handleSend`
// filters `kind === 'image'`, so a PDF or a Word file was carried to the tutor
// and never read. A child attaching the worksheet their teacher emailed got a
// generic reply, which is the same dead end a photograph used to be.
//
// WHY NO DEPENDENCY: `fflate` is already in the tree and is the only hard part
// — PDF content streams are FlateDecode and a .docx is a zip. Everything else
// is string work. So this runs on native and web alike with nothing new to
// install, nothing to download, and nothing leaving the device.
//
// THE CEILING, stated rather than discovered: a SCANNED pdf has no text layer,
// only images, and this returns '' for it. That is the honest boundary between
// this and the OCR path; `readDocument` says which happened so the caller can
// tell the child something true.
// SOT: ./read-attachment.ts · packages/app/features/tutor/tutor-screen.tsx
// SOT-KEYWORDS: read document pdf docx txt text extraction fflate homework on-device
import { inflateSync, unzipSync } from 'fflate';

export interface DocumentReading {
  text: string;
  /** `scanned` means a pdf with no text layer — the OCR path, not this one. */
  reason: 'ok' | 'empty' | 'scanned' | 'unsupported' | 'failed';
}

const decodeLatin1 = (bytes: Uint8Array): string => {
  let out = '';
  // Chunked: `String.fromCharCode(...big)` blows the argument limit on Hermes.
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return out;
};

/** `\(`, `\)`, `\\`, `\n`, and three-digit octal, as PDF string syntax defines. */
function unescapePdfString(raw: string): string {
  return raw.replace(/\\(n|r|t|b|f|\(|\)|\\|[0-7]{1,3})/g, (_, code: string) => {
    switch (code) {
      case 'n': return '\n';
      case 'r': return '\r';
      case 't': return '\t';
      case 'b': return '\b';
      case 'f': return '\f';
      case '(': return '(';
      case ')': return ')';
      case '\\': return '\\';
      default: return String.fromCharCode(parseInt(code, 8));
    }
  });
}

const decodeHexString = (hex: string): string => {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  let out = '';
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out += String.fromCharCode(parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
};

/**
 * Text-showing operators from one decoded content stream.
 *
 * `Tj` and `'`/`"` show one string; `TJ` shows an array of strings interleaved
 * with kerning numbers, which are dropped. `Td`/`TD`/`T*`/`ET` move the cursor,
 * and are the only newline information a content stream carries — without them
 * every line of a worksheet runs into the next one.
 */
function textFromContentStream(content: string): string {
  let out = '';
  const token = /\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]*>|\bTJ\b|\bTj\b|'|"|\bTd\b|\bTD\b|\bT\*|\bET\b/g;
  let pending = '';
  for (const match of content.matchAll(token)) {
    const piece = match[0] as string;
    if (piece.startsWith('(')) {
      pending += unescapePdfString(piece.slice(1, -1));
    } else if (piece.startsWith('<')) {
      pending += decodeHexString(piece.slice(1, -1));
    } else if (piece === 'Tj' || piece === 'TJ' || piece === "'" || piece === '"') {
      out += pending;
      pending = '';
    } else {
      // A cursor move: whatever was pending belongs to the line that ended.
      out += pending + '\n';
      pending = '';
    }
  }
  return out + pending;
}

/** Every `stream ... endstream` body, inflated where it is FlateDecode. */
function* pdfStreams(raw: string, bytes: Uint8Array): Generator<string> {
  const marker = /stream\r?\n/g;
  for (const match of raw.matchAll(marker)) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) continue;
    const slice = bytes.subarray(start, end);
    try {
      yield decodeLatin1(inflateSync(slice));
    } catch {
      // Not compressed, or a compression this does not do. Raw is still worth
      // scanning: an uncompressed content stream is perfectly common.
      yield decodeLatin1(slice);
    }
  }
}

export function extractPdfText(bytes: Uint8Array): DocumentReading {
  try {
    const raw = decodeLatin1(bytes);
    let text = '';
    for (const content of pdfStreams(raw, bytes)) {
      if (content.includes('Tj') || content.includes('TJ')) {
        text += textFromContentStream(content);
      }
    }
    const cleaned = tidy(text);
    if (cleaned.length > 0) return { text: cleaned, reason: 'ok' };
    // A pdf with streams but no text operators is a scan: page images only.
    return { text: '', reason: 'scanned' };
  } catch {
    return { text: '', reason: 'failed' };
  }
}

export function extractDocxText(bytes: Uint8Array): DocumentReading {
  try {
    const files = unzipSync(bytes);
    const document = files['word/document.xml'];
    if (!document) return { text: '', reason: 'unsupported' };
    const xml = decodeLatin1(document);
    const text = xml
      // A paragraph is a line, and it has to become one before the tags go.
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:tab\b[^>]*\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    const cleaned = tidy(text);
    return cleaned.length > 0 ? { text: cleaned, reason: 'ok' } : { text: '', reason: 'empty' };
  } catch {
    return { text: '', reason: 'failed' };
  }
}

/** Collapses the runs of blank space these formats leave behind. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n+ */g, '\n')
    .trim();
}

/**
 * One entry point for whatever the child attached. `mimeType` is what the
 * picker reported; the magic bytes are checked too, because a document picker
 * on Android will hand back `application/octet-stream` for a perfectly good pdf.
 */
export function readDocument(bytes: Uint8Array, mimeType?: string): DocumentReading {
  const magic = decodeLatin1(bytes.subarray(0, 4));
  const isPdf = magic === '%PDF' || mimeType === 'application/pdf';
  // Both docx and every other OOXML file are zips: `PK\x03\x04`.
  const isZip = magic.startsWith('PK');

  if (isPdf) return extractPdfText(bytes);
  if (isZip) return extractDocxText(bytes);
  if (mimeType?.startsWith('text/') || mimeType === 'application/json') {
    const cleaned = tidy(decodeLatin1(bytes));
    return cleaned.length > 0 ? { text: cleaned, reason: 'ok' } : { text: '', reason: 'empty' };
  }
  return { text: '', reason: 'unsupported' };
}

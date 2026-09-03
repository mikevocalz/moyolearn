// Fetch an attached document's bytes and read it — the URI-shaped wrapper
// around the pure `readDocument`.
//
// One implementation, both platforms: `fetch` handles `file://`, `content://`
// (RN maps it), `blob:` and `https:` alike, and neither fork needs a native
// module. The pure half stays pure so it can be tested in Node.
// SOT: ./read-document.ts
// SOT-KEYWORDS: read document uri fetch bytes pdf docx homework attachment
import { readDocument, type DocumentReading } from './read-document.ts';

/**
 * Text from the document at `uri`, or '' — the same contract the OCR path has:
 * an unreadable attachment costs the reading, never the turn.
 */
export async function readDocumentAt(uri: string, mimeType?: string): Promise<string> {
  try {
    const response = await fetch(uri);
    if (!response.ok) return '';
    const reading: DocumentReading = readDocument(
      new Uint8Array(await response.arrayBuffer()),
      mimeType,
    );
    if (__DEV__ && reading.reason !== 'ok') {
      // `scanned` is the interesting one: a pdf of photographs is the OCR
      // path's job, and silently returning '' for it is how "I attached my
      // homework and nothing happened" gets no trace to follow.
      console.warn('[readDocumentAt] %s: %s', mimeType ?? 'unknown', reading.reason);
    }
    return reading.text;
  } catch (error) {
    if (__DEV__) console.warn('[readDocumentAt] failed:', error);
    return '';
  }
}

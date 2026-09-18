// A partial stream transcript cannot establish native PDF page completeness.
// SOT: ./read-document-at.native.ts; docs/design/homework-intelligence.md
// SOT-KEYWORDS: native pdf unsupported manual recovery page completeness
import type { DocumentReading } from './read-document.ts';

export async function readUnsupportedNativePdf(): Promise<DocumentReading> {
  return { text: '', reason: 'unsupported' };
}

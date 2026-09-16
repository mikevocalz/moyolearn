// Browser document transport. Recognition status survives for review consumers.
// SOT-KEYWORDS: homework document browser fetch reading status
import { fetchDocumentBytes, readDocumentUsing } from './read-document-at.shared.ts';
export const readDocumentEvidenceAt = (uri: string, mimeType?: string) => readDocumentUsing(uri, mimeType, fetchDocumentBytes);
export async function readDocumentAt(uri: string, mimeType?: string): Promise<string> {
  return (await readDocumentEvidenceAt(uri, mimeType)).text;
}

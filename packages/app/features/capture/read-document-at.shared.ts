// URI transport is injected so native local files never depend on browser fetch.
// SOT-KEYWORDS: homework document transport bytes failure source reading
import { readDocument } from './read-document.ts';
import type { DocumentReading } from './read-document.ts';

export const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024;
export async function fetchDocumentBytes(uri: string): Promise<Uint8Array> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Document could not be loaded');
  const length = Number(response.headers.get('content-length'));
  if (length > MAX_DOCUMENT_BYTES) throw new Error('Document exceeds size limit');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_DOCUMENT_BYTES) throw new Error('Document exceeds size limit');
  return bytes;
}
export async function readDocumentUsing(
  uri: string,
  mimeType: string | undefined,
  load: (uri: string) => Promise<Uint8Array>,
): Promise<DocumentReading> {
  try {
    const bytes = await load(uri);
    if (bytes.length > MAX_DOCUMENT_BYTES) return { text: '', reason: 'failed' };
    return readDocument(bytes, mimeType);
  } catch {
    return { text: '', reason: 'failed' };
  }
}

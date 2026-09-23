// Expo File supports picked file/content URIs; RN fetch is reserved for remote data.
// SOT-KEYWORDS: homework document native expo file content uri bytes
import { File } from 'expo-file-system';
import { readUnsupportedNativePdf } from './native-document-policy.ts';
import { fetchDocumentBytes, MAX_DOCUMENT_BYTES, readDocumentUsing } from './read-document-at.shared.ts';
async function load(uri: string): Promise<Uint8Array> {
  if (/^https?:\/\//i.test(uri)) return fetchDocumentBytes(uri);
  const file = new File(uri);
  if (file.size > MAX_DOCUMENT_BYTES) throw new Error('Document exceeds size limit');
  return file.bytes();
}
export const readDocumentEvidenceAt = (uri: string, mimeType?: string) => readDocumentUsing(uri, mimeType, load, readUnsupportedNativePdf);
export async function readDocumentAt(uri: string, mimeType?: string): Promise<string> {
  return (await readDocumentEvidenceAt(uri, mimeType)).text;
}

// Native transport: expo-file-system's upload task.
//
// `BINARY_CONTENT` puts the file in the request body untouched, which is exactly
// what a presigned S3 PUT expects — MULTIPART would wrap it in form boundaries
// and the signature would not match the bytes.
//
// `sessionType: 'background'` lets iOS finish the transfer after the app is
// suspended, which is the difference between a parent switching apps and losing
// a 40MB voice note or not. The JS task is NOT restored if the app is killed, so
// this covers backgrounding, not termination.
//
// Note there is no pause: `UploadTaskState` is `Exclude<TaskState, 'paused'>` —
// downloads pause, uploads do not. Retry means restart here. Video avoids that
// by going through TUS instead (see tus-url-storage).
// SOT-KEYWORDS: upload transport native expo-file-system progress presigned put
import { File, UploadType } from 'expo-file-system';
import type { UploadInput, UploadTransport } from './transport.types.ts';

export const uploadTransport: UploadTransport = async ({
  file,
  url,
  contentType,
  onProgress,
  signal,
}: UploadInput) => {
  const task = new File(file.uri).createUploadTask(url, {
    httpMethod: 'PUT',
    uploadType: UploadType.BINARY_CONTENT,
    // Signed by the server, so it must go out byte-identical.
    headers: { 'Content-Type': contentType },
    mimeType: contentType,
    sessionType: 'background',
    onProgress: ({ bytesSent, totalBytes }) => onProgress(bytesSent, totalBytes),
    signal,
  });

  const result = await task.uploadAsync();
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed (${result.status})`);
  }
};

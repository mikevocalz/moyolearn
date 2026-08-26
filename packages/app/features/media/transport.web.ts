// Web transport: XMLHttpRequest, deliberately — `fetch` cannot report upload
// progress. There is no `ReadableStream` request body with progress events in
// any shipping browser, so the "modern" choice here silently loses the one thing
// a per-file progress bar needs. XHR is not legacy; it is the only API that
// answers the question.
// SOT-KEYWORDS: upload transport web xhr progress presigned put media
import type { UploadInput, UploadTransport } from './transport.types.ts';

export const uploadTransport: UploadTransport = ({ file, url, contentType, onProgress, signal }: UploadInput) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', contentType);

    xhr.upload.onprogress = (event) => {
      // `lengthComputable` is false for a chunked body; reporting 0/0 would make
      // the bar jump to NaN%, so the caller is told the total is unknown.
      onProgress(event.loaded, event.lengthComputable ? event.total : 0);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection.'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));

    signal?.addEventListener('abort', () => xhr.abort(), { once: true });

    /*
      `file.uri` is an object URL on web. Fetching it back into a Blob is a local
      read, not a network round trip, and it keeps ONE input shape across both
      platforms instead of forking the caller as well as the transport.
    */
    fetch(file.uri)
      .then((r) => r.blob())
      .then((blob) => xhr.send(blob))
      .catch(() => reject(new Error('That file could not be read.')));
  });

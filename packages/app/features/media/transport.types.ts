// The one contract both upload transports honour.
// SOT-KEYWORDS: upload transport types progress abort platform fork media
export interface UploadInput {
  /** Local file URI (native) or a File/Blob (web). */
  file: { uri: string; name: string; type: string; size: number };
  /** Presigned PUT target. Carries its own signature — send no credentials. */
  url: string;
  /** MUST match what the server signed, or the signature fails. */
  contentType: string;
  onProgress: (sent: number, total: number) => void;
  signal?: AbortSignal;
}

export type UploadTransport = (input: UploadInput) => Promise<void>;

export type ForgeBoardPngSaveResult =
  | {
      readonly kind: 'saved';
      readonly uri: string;
      readonly fileName: string;
      readonly byteSize: number;
      readonly destination: 'selected-folder';
    }
  | { readonly kind: 'cancelled' };

interface ExportFile {
  readonly uri: string;
  readonly name: string;
  write(content: string, options: { encoding: 'base64' }): Promise<void>;
  base64(): Promise<string>;
  delete(): void;
}

export interface ForgeBoardExportDirectory {
  createFile(name: string, mimeType: string): ExportFile;
}

const PNG_PREFIX = 'data:image/png;base64,';
const MAX_PNG_BYTES = 32 * 1024 * 1024;

function pngPayload(dataUrl: string) {
  if (!dataUrl.startsWith(PNG_PREFIX)) throw new Error('The board did not export a PNG image.');
  const base64 = dataUrl.slice(PNG_PREFIX.length);
  if (base64.length > Math.ceil(MAX_PNG_BYTES / 3) * 4) {
    throw new Error('The board PNG is too large to save (maximum 32 MB).');
  }
  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
    throw new Error('The board PNG contains invalid image data.');
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const byteSize = base64.length / 4 * 3 - padding;
  if (byteSize < 45 || byteSize > MAX_PNG_BYTES ||
      !atob(base64.slice(0, 44)).startsWith('\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR') ||
      !atob(base64.slice(-20)).endsWith('\x00\x00\x00\x00IEND\xae\x42\x60\x82')) {
    throw new Error('The board PNG is incomplete or invalid.');
  }
  return { base64, byteSize };
}

function pickerWasCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? error.code : undefined;
  return code === 'ERR_PICKER_CANCELLED' || code === 'ERR_FILE_PICKING_CANCELLED';
}

/** Saves only to a folder explicitly selected by the user; never substitutes private cache. */
export function createForgeBoardPngSaver(
  pickDirectory: () => Promise<ForgeBoardExportDirectory>,
) {
  let saving = false;
  return async (dataUrl: string): Promise<ForgeBoardPngSaveResult> => {
    if (saving) throw new Error('A PNG save is already in progress.');
    const { base64, byteSize } = pngPayload(dataUrl);
    saving = true;
    try {
      let directory: ForgeBoardExportDirectory;
      try {
        directory = await pickDirectory();
      } catch (error) {
        if (pickerWasCancelled(error)) return { kind: 'cancelled' };
        throw error;
      }
      const fileName = `moyo-board-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
      // createFile is required for Android SAF content:// folders. File.create
      // cannot create a SAF document, and a URI alone is not a successful save.
      const file = directory.createFile(fileName, 'image/png');
      try {
        await file.write(base64, { encoding: 'base64' });
        if (await file.base64() !== base64) {
          throw new Error('The saved PNG could not be verified. Choose another folder and try again.');
        }
      } catch (error) {
        // This is only the new file owned by this export, never a pre-existing
        // board or user file. Retain the write error even if cleanup fails.
        try { file.delete(); } catch { /* The destination may have become unavailable. */ }
        throw error;
      }
      return { kind: 'saved', uri: file.uri, fileName: file.name, byteSize, destination: 'selected-folder' };
    } finally {
      saving = false;
    }
  };
}

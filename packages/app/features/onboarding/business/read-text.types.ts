/** Reads a picked file's contents as text. Rejects only when the file is unreadable. */
export type ReadText = (uri: string) => Promise<string>;

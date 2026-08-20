/**
 * An image the user chose for the notes editor.
 *
 * The dimensions travel with the uri because the editor's `setImage` command
 * needs them up front — it cannot measure an asset itself, and inserting
 * without a size collapses the image to nothing.
 */
export interface NoteImage {
  uri: string;
  width: number;
  height: number;
}

/**
 * Resolves null when the user cancels or declines permission, which the caller
 * treats as "do nothing" rather than an error worth surfacing.
 */
export type PickNoteImage = () => Promise<NoteImage | null>;

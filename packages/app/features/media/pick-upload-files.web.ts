// On web the browser's own dialog is already wired through the kit's
// FileTrigger — a REAL `<input type="file">` that stays in the DOM (doc 30 §6)
// — so a detached imperative picker here would be a second, less accessible
// way to do the same thing. This fork exists so the universal components
// compile; it resolves empty and the input does the work.
// SOT: packages/ui/file-trigger.web.tsx
// SOT-KEYWORDS: pick upload files web noop file trigger input
import type { PickUploadFiles } from './pick-upload-files.types.ts';

export const pickUploadFiles: PickUploadFiles = async () => [];

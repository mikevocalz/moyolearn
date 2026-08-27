// TS resolution anchor — bundlers load the .native/.web forks.
// Native: ExecuTorch (CRAFT + CRNN). Web: Tesseract, escalating to TrOCR for
// handwriting. Both on-device, both free.
export { readAttachment } from './read-attachment.web';

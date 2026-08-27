// TS resolution anchor — bundlers load the .native/.web forks.
// Native defers to the OS scheduler; web drains on load and on `online`.
// The queue's own retry policy is pure and lives in `.shared.ts`.
export {
  UPLOAD_TASK,
  setUploadDrain,
  setUploadReporter,
  reportUpload,
  registerUploadDrain,
  unregisterUploadDrain,
  drainNow,
} from './upload-queue.web';

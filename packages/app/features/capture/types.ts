// Capture feature types — the six-stage homework-capture journey.
// SOT: docs/pack/24-homework-capture-spec.md §5
// SOT-KEYWORDS: capture mode homework entry step choose capture review verify context upload success

export type CaptureMode = 'camera' | 'photo-library' | 'file' | 'type' | 'voice';

/**
 * The six learner-facing stages, in order, plus the terminal success screen.
 * The names match the build prompt's "one confident journey" section exactly so
 * the UI and the spec refer to the same moments.
 */
export type CaptureStep =
  | 'choose'
  | 'capture'
  | 'review-pages'
  | 'read-verify'
  | 'add-context'
  | 'upload-process'
  | 'success';

export interface CapturePhoto {
  filePath: string;
}

/** One captured or selected page in the multi-page review flow. */
export interface CapturePage {
  id: string;
  uri: string;
  kind: 'photo' | 'image' | 'file';
}

/** Optional context the learner can add before sending the work on. */
export interface CaptureContext {
  subject: string;
  assignment: string;
  dueDate: string;
  stuck: string;
}

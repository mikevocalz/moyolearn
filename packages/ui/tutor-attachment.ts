// What a learner can put into a tutor turn besides words.
//
// A child stuck on homework does not describe the problem — they point a camera
// at it. Doc 07 §3 puts every learner-facing model input through the Safety
// Plane, so the attachment kinds are a closed union rather than a MIME string:
// the plane has to know what it is being asked to look at, and "whatever the
// picker returned" is not an answer it can reason about.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §3 · doc 23 §3.5
// SOT-KEYWORDS: tutor attachment image document audio voice note homework composer
export type TutorAttachmentKind = 'image' | 'document' | 'audio';

export interface TutorAttachment {
  id: string;
  kind: TutorAttachmentKind;
  /** Local URI while pending; the remote URL once uploaded. */
  uri: string;
  name: string;
  mimeType: string;
  /** Bytes, when the picker reported it. Drives the size cap message. */
  size?: number;
  /** Audio only. Seconds. */
  durationSec?: number;
  /**
   * Audio only, and not optional in spirit.
   *
   * A spoken turn that only ever exists as sound is a turn a guardian cannot
   * review and a tutor cannot skim — doc 07's whole premise is that an adult can
   * see what a child said to the model. It is typed optional because the
   * transcript arrives after the upload, not because a voice note may ship
   * without one.
   */
  transcript?: string;
  /** Image/document only: a thumbnail to show in the tray and the bubble. */
  previewUri?: string;
}

/**
 * Four images per turn, and the number is a teaching decision rather than a
 * technical one.
 *
 * A page of homework is one photo; four is a double-page spread or a problem
 * set photographed in pieces. Past that a child is not asking about a problem,
 * they are handing over the whole book — and a tutor that accepts a book gives
 * a worse answer than one that asks which part is stuck, because every image
 * dilutes the context the coaching turn is built from.
 *
 * It also bounds the on-device OCR: each image is a separate ExecuTorch pass,
 * and four is what a mid-range phone can run before the child is waiting.
 */
export const MAX_TUTOR_IMAGES = 4;

/** Documents and voice notes are counted separately — the cap is on IMAGES. */
export const countImages = (attachments: readonly TutorAttachment[]): number =>
  attachments.filter((a) => a.kind === 'image').length;

/** The kinds a learner may attach, in the order the sheet offers them. */
export const ATTACHMENT_CHOICES = [
  { kind: 'image' as const, label: 'Take a photo', icon: 'Camera' as const },
  { kind: 'image' as const, label: 'Photo library', icon: 'Image' as const },
  { kind: 'document' as const, label: 'Files', icon: 'FileUp' as const },
];

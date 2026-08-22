// Capture feature types — input modes for attaching homework to a session.
// SOT: docs/pack/24-homework-capture-spec.md §5
// SOT-KEYWORDS: capture mode homework entry camera photo file voice type

export type CaptureMode = 'camera' | 'photo-library' | 'file' | 'type' | 'voice';
export type CaptureStep = 'entry' | 'capture' | 'preview' | 'review';

export interface CapturePhoto {
  filePath: string;
}

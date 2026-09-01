// Platform anchor for the in-session camera picker.
//
// This is a quick capture for a single attachment, not the full homework
// capture pipeline (which lives in packages/app/features/capture). The image
// is staged on the current turn and uploaded through the normal attachment
// queue.
// SOT: packages/app/features/tutor/tutor-screen.tsx · packages/ui/Composer.tsx
// SOT-KEYWORDS: tutor camera picker attachment in-session
export { pickCamera } from './pick-camera.native';
export type { CameraImage, PickCamera } from './pick-camera.types';

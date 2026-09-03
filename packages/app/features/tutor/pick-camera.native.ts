import type { PickCamera } from './pick-camera.types.ts';
import { useCameraStore } from '../capture/camera.store.ts';

/**
 * In-session capture through the SAME camera the homework scanner uses —
 * `GuidedFrame` then `CropPreview`, presented by `CameraSheet`.
 *
 * This was `expo-image-picker`'s `launchCameraAsync`: the OS camera app, with
 * no edge overlay, no framing hints, no age-band shutter and no crop. That made
 * it a second camera (CLAUDE.md, "never invent a second way") and the worse one
 * — a child pointing the raw OS camera at a worksheet hands the on-device OCR
 * exactly the picture it reads worst.
 *
 * The `PickCamera` signature is unchanged, so every caller — the composer, the
 * staging path, the send path — is untouched by the swap.
 *
 * `cameraType` no longer appears here because `GuidedFrame` owns the device
 * choice; the back camera and its permission ask live there (doc 37 §1.5), in
 * one place rather than two.
 */
export const pickCamera: PickCamera = () => useCameraStore.getState().request();

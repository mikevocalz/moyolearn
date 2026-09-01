import * as ImagePicker from 'expo-image-picker';
import type { PickCamera } from './pick-camera.types.ts';

/**
 * Native in-session camera capture using expo-image-picker.
 *
 * `cameraType` is `back` because the child is photographing a worksheet or
 * their written work. A front-facing selfie has no tutoring purpose and is
 * deliberately not offered.
 */
export const pickCamera: PickCamera = async () => {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    cameraType: ImagePicker.CameraType.back,
  });

  const asset = result.canceled ? undefined : result.assets[0];
  if (asset === undefined) return null;

  return { uri: asset.uri, width: asset.width, height: asset.height };
};

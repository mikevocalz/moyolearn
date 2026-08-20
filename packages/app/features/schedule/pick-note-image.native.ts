import * as ImagePicker from 'expo-image-picker';
import type { PickNoteImage } from './pick-note-image.types.ts';

/**
 * The platform image library, via expo-image-picker.
 *
 * It reports width and height on the picked asset, so the contract in
 * pick-note-image.types.ts is satisfied without a second measuring pass.
 */
export const pickNoteImage: PickNoteImage = async () => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset === undefined) return null;

  return { uri: asset.uri, width: asset.width, height: asset.height };
};

// The platform pickers, routed by kind (doc 30 §8.2).
//
// Images alone get the photo library, because that is where a phone keeps
// them; anything else goes through the Files app / storage-access framework
// via expo-document-picker. `copyToCacheDirectory` is not an option to weigh:
// the returned URI can be a security-scoped or `content://` reference that
// expires before a queued upload runs — copy on pick, upload from the copy.
//
// Multi-select is the PICKER's job — one call returns many files, which then
// flow into the same per-file queue and rows as the web build.
// SOT: docs/pack/30-upload-surfaces-spec.md §8.2
// SOT-KEYWORDS: pick upload files native image picker document picker cache copy
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import type { CandidateFile } from './upload-surfaces.shared.ts';
import type { PickUploadFiles } from './pick-upload-files.types.ts';

const DOCUMENT_MIMES = [
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

export const pickUploadFiles: PickUploadFiles = async ({ kinds, multiple }) => {
  if (kinds.length === 1 && kinds[0] === 'image') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return [];
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: multiple,
      quality: 0.8,
    });
    if (result.canceled) return [];
    return result.assets.map<CandidateFile>((asset) => ({
      uri: asset.uri,
      name: asset.fileName ?? 'photo.jpg',
      type: asset.mimeType ?? 'image/jpeg',
      size: asset.fileSize ?? 0,
    }));
  }

  const mimes = kinds.flatMap((kind) => {
    if (kind === 'image') return ['image/*'];
    if (kind === 'audio') return ['audio/*', 'video/mp4'];
    return DOCUMENT_MIMES;
  });
  const result = await DocumentPicker.getDocumentAsync({
    type: mimes,
    multiple,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map<CandidateFile>((asset) => ({
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType ?? 'application/octet-stream',
    size: asset.size ?? 0,
  }));
};

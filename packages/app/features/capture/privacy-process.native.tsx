'use client';
// Privacy process — strip EXIF and downscale captured homework on native.
// SOT: docs/pack/24-homework-capture-spec.md §3
// SOT-KEYWORDS: privacy process native exif strip image manipulator resize

import * as ImageManipulator from 'expo-image-manipulator';

export interface PrivacyResult {
  uri: string;
}

const CAPTURE_MAX_WIDTH = 1600;

export async function stripExif(source: string): Promise<PrivacyResult> {
  const result = await ImageManipulator.manipulateAsync(
    source,
    [{ resize: { width: CAPTURE_MAX_WIDTH } }],
    { format: ImageManipulator.SaveFormat.PNG, compress: 0.9 },
  );
  return { uri: result.uri };
}

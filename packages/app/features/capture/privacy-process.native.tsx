'use client';
// Re-encode a local master without discarding the pixels needed for symbol review.
// SOT: docs/pack/24-homework-capture-spec.md §3
// SOT-KEYWORDS: privacy process native exif strip image manipulator master preservation

import * as ImageManipulator from 'expo-image-manipulator';

export interface PrivacyResult {
  uri: string;
}

export async function stripExif(source: string): Promise<PrivacyResult> {
  const result = await ImageManipulator.manipulateAsync(
    source,
    [],
    { format: ImageManipulator.SaveFormat.PNG, compress: 0.9 },
  );
  return { uri: result.uri };
}

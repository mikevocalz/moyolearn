// Privacy process — web fallback. Native uses expo-image-manipulator to strip EXIF.
// SOT: docs/pack/24-homework-capture-spec.md §3
// SOT-KEYWORDS: privacy process web fallback exif strip capture

export interface PrivacyResult {
  uri: string;
}

export async function stripExif(source: string): Promise<PrivacyResult> {
  // Web has no local file rewrite; the caller treats the source as already minimal.
  return { uri: source };
}

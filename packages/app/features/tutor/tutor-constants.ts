// Tutor shared constants.
//
// Kept out of `tutor.store.ts` so the audio queue and the store can both read
// the API base URL without a circular import.
// SOT: packages/app/features/tutor/tutor.store.ts · packages/app/features/tutor/tutor-audio.ts
// SOT-KEYWORDS: tutor api url constants base

/** The tutor API base for the current platform. */
export const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  'http://localhost:3001';

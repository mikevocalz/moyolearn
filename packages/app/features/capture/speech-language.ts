// Language hint for local Whisper. A valid BCP-47 course locale is normalized
// to an installed Whisper language code, never to another cloud provider.
// The list is the first world-language courses (features/world-language/course-catalog.ts).
// SOT: docs/design/multilingual-speech-migration.md
// SOT-KEYWORDS: whisper language hint locale bcp47 multilingual speech course es fr zh ar
export const MOYO_WHISPER_LANGUAGES = ['en', 'es', 'fr', 'zh', 'ar'] as const;
export type MoyoWhisperLanguage = (typeof MOYO_WHISPER_LANGUAGES)[number];

/** Returns null for an explicitly unsupported locale; undefined for auto-detection. */
export function whisperLanguageForLocale(locale?: string): MoyoWhisperLanguage | null | undefined {
  if (locale === undefined) return undefined;
  const normalized = locale.trim();
  if (!normalized || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(normalized)) return null;
  const primary = normalized.split('-')[0]!.toLowerCase();
  return MOYO_WHISPER_LANGUAGES.find((language) => language === primary) ?? null;
}

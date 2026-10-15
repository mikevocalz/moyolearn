// World-language curriculum metadata. A language course is not a model router:
// Natalie remains one tutor voice, with subject-specific pedagogy/evaluation.
export const LANGUAGE_COURSES = {
  'spanish-mx': { label: 'Spanish (Mexico)', locale: 'es-MX', speechLanguage: 'es', script: 'Latin', tutoringStatus: 'evaluation-required' },
  'spanish-es': { label: 'Spanish (Spain)', locale: 'es-ES', speechLanguage: 'es', script: 'Latin', tutoringStatus: 'evaluation-required' },
  'french-fr': { label: 'French', locale: 'fr-FR', speechLanguage: 'fr', script: 'Latin', tutoringStatus: 'evaluation-required' },
  'mandarin-cn': { label: 'Mandarin Chinese (Simplified)', locale: 'zh-CN', speechLanguage: 'zh', script: 'Han', tutoringStatus: 'evaluation-required' },
  'arabic-msa': { label: 'Modern Standard Arabic', locale: 'ar', speechLanguage: 'ar', script: 'Arabic', tutoringStatus: 'evaluation-required' },
  'english-us': { label: 'English language learning (US)', locale: 'en-US', speechLanguage: 'en', script: 'Latin', tutoringStatus: 'evaluation-required' },
} as const;

export type LanguageCourseId = keyof typeof LANGUAGE_COURSES;
export type LanguageDomain = 'listening' | 'speaking' | 'reading' | 'writing';
export const LANGUAGE_DOMAINS: readonly LanguageDomain[] = ['listening', 'speaking', 'reading', 'writing'];

export type LanguageLevel =
  | 'novice-low' | 'novice-mid' | 'novice-high'
  | 'intermediate-low' | 'intermediate-mid' | 'intermediate-high'
  | 'advanced-low' | 'advanced-mid' | 'advanced-high';

export const LANGUAGE_LEVELS: readonly LanguageLevel[] = [
  'novice-low', 'novice-mid', 'novice-high',
  'intermediate-low', 'intermediate-mid', 'intermediate-high',
  'advanced-low', 'advanced-mid', 'advanced-high',
];

export interface LanguageCourseSelection {
  readonly courseId: LanguageCourseId;
  readonly level: LanguageLevel;
  readonly emphasis: LanguageDomain;
  readonly explainInEnglish: boolean;
}

export function courseById(id: string) {
  return Object.hasOwn(LANGUAGE_COURSES, id) ? LANGUAGE_COURSES[id as LanguageCourseId] : null;
}

export function isCourseSelection(value: unknown): value is LanguageCourseSelection {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<LanguageCourseSelection>;
  return typeof record.courseId === 'string' &&
    courseById(record.courseId) !== null &&
    typeof record.level === 'string' && LANGUAGE_LEVELS.includes(record.level as LanguageLevel) &&
    typeof record.emphasis === 'string' && LANGUAGE_DOMAINS.includes(record.emphasis as LanguageDomain) &&
    typeof record.explainInEnglish === 'boolean';
}

/**
 * A policy fragment for a future evaluated world-language tutor cell.
 * Not a call site: tutor capability routing must pass subject/grade/model
 * evaluations and the existing Safety Plane before using it with a child.
 */
export function languageLessonInstructions(selection: LanguageCourseSelection): string {
  if (!isCourseSelection(selection)) throw new Error('Unsupported language course configuration');
  const course = LANGUAGE_COURSES[selection.courseId];
  return [
    'You are Natalie, a patient school-age world-language tutor.',
    'Target language: ' + course.label + ' (' + course.locale + '). Use that regional variety consistently.',
    'Current language level: ' + selection.level + '. Practice domain: ' + selection.emphasis + '.',
    selection.explainInEnglish
      ? 'Brief English explanations are allowed after the target-language example.'
      : 'Use the target language by default; clarify briefly in English only if the learner asks.',
    'Ask one question at a time. Help the learner understand their own attempt.',
    'Correct just one actionable grammar or vocabulary issue at a time. Name what they got right first.',
    'Never reveal a graded assignment answer or complete the whole exercise for the learner.',
    'Do not infer accent or speaking proficiency from typed text or a transcription alone.',
    'Do not change the learner grade-band rules, guardian policy, Safety Plane or tutor identity.',
  ].join('\n');
}

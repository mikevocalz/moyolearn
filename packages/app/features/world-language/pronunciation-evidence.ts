// Evidence guard. Speech-to-text is not a pronunciation scorer.
// Transcript alone cannot establish phoneme, accent or fluency accuracy.
export type LanguageEvidenceSource =
  | 'typed'
  | 'speech-transcript'
  | 'human-reviewed-phonemes'
  | 'approved-phoneme-assessor';

export type PronunciationVerdict =
  | { readonly status: 'not-assessed'; readonly reason: 'no-speech-evidence' | 'transcript-only' | 'no-approval' }
  | { readonly status: 'ready-for-review'; readonly source: 'human-reviewed-phonemes' | 'approved-phoneme-assessor' };

export function pronunciationReadiness(input: {
  readonly source: LanguageEvidenceSource;
  readonly phonemeEvidencePresent: boolean;
  readonly assessmentApproved: boolean;
}): PronunciationVerdict {
  if (input.source === 'typed') return { status: 'not-assessed', reason: 'no-speech-evidence' };
  if (input.source === 'speech-transcript') return { status: 'not-assessed', reason: 'transcript-only' };
  if (!input.phonemeEvidencePresent || !input.assessmentApproved) {
    return { status: 'not-assessed', reason: 'no-approval' };
  }
  return { status: 'ready-for-review', source: input.source };
}

export type SkillObservation = 'not-observed' | 'practice-needed' | 'observed-with-help' | 'observed-independently';

/** The four domains remain independent: a speaking result never fills writing. */
export type LanguageProgress = Readonly<Record<'listening' | 'speaking' | 'reading' | 'writing', SkillObservation>>;

export function initialLanguageProgress(): LanguageProgress {
  return {
    listening: 'not-observed',
    speaking: 'not-observed',
    reading: 'not-observed',
    writing: 'not-observed',
  };
}

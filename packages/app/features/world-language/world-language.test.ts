import assert from 'node:assert/strict';
import { test } from 'node:test';
import { courseById, LANGUAGE_COURSES, languageLessonInstructions, isCourseSelection } from './course-catalog.ts';
import { initialLanguageProgress, pronunciationReadiness } from './pronunciation-evidence.ts';

test('six initial regional language courses share one tutor without model pinning', () => {
  assert.equal(Object.keys(LANGUAGE_COURSES).length, 6);
  assert.equal(courseById('spanish-mx')?.speechLanguage, 'es');
  assert.equal(courseById('spanish-es')?.speechLanguage, 'es');
  assert.equal(courseById('no-such-course'), null);
});

test('language lesson instructions differentiate variety, level and coaching while withholding answers', () => {
  const selection = { courseId: 'spanish-mx', level: 'novice-low', emphasis: 'speaking', explainInEnglish: true } as const;
  assert.equal(isCourseSelection(selection), true);
  const prompt = languageLessonInstructions(selection);
  assert.match(prompt, /Spanish \(Mexico\)/);
  assert.match(prompt, /English explanations/);
  assert.match(prompt, /Never reveal/);
  assert.match(prompt, /Do not infer accent/);
  assert.throws(() => languageLessonInstructions({ ...selection, courseId: 'unknown' } as never), /Unsupported/);
});

test('speech transcripts never count as pronunciation evidence', () => {
  assert.deepEqual(pronunciationReadiness({
    source: 'speech-transcript', phonemeEvidencePresent: true, assessmentApproved: true,
  }), { status: 'not-assessed', reason: 'transcript-only' });
  assert.deepEqual(pronunciationReadiness({
    source: 'approved-phoneme-assessor', phonemeEvidencePresent: true, assessmentApproved: false,
  }), { status: 'not-assessed', reason: 'no-approval' });
  assert.deepEqual(pronunciationReadiness({
    source: 'human-reviewed-phonemes', phonemeEvidencePresent: true, assessmentApproved: true,
  }), { status: 'ready-for-review', source: 'human-reviewed-phonemes' });
});

test('progress begins unobserved separately across the four domains', () => {
  assert.deepEqual(initialLanguageProgress(), {
    listening: 'not-observed', speaking: 'not-observed', reading: 'not-observed', writing: 'not-observed',
  });
});

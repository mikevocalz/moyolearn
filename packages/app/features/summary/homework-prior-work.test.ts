import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { HomeworkQuestionView, HomeworkSubmissionView } from '../homework/homework.types.ts';
import { homeworkFacts, homeworkProblemRows } from './homework-rows.ts';

const question = (questionId: string, priorWork: HomeworkQuestionView['priorWork'], outcome: HomeworkQuestionView['outcome']): HomeworkQuestionView => ({
  questionId, priorWork, outcome, orderIndex: Number(questionId), sourcePage: 1, sourceNumber: Number(questionId),
  currentRevision: 'revision', text: 'A question', revisions: [], crop: null, attempts: 1, hintsUsed: 0,
  misconceptionTags: [], startedAt: null, completedAt: null,
});
const submission = (questions: readonly HomeworkQuestionView[]): HomeworkSubmissionView => ({
  submissionId: 'submission', learnerAuthId: 'learner', createdByAuthId: 'guardian', subject: 'Math', title: 'Worksheet',
  instructions: '', localDate: '2026-11-14', status: 'complete', pipelineStatus: 'extracted', pipelineError: null,
  currentIndex: 0, currentQuestionId: questions[0]?.questionId ?? '', tutorSessionId: null, questions,
  createdAt: '2026-11-14T00:00:00Z', updatedAt: '2026-11-14T00:00:00Z',
});

describe('prior-work report exclusions', () => {
  it('never credits a prefinished question as learning with Moyo, even with a legacy outcome', () => {
    const sheet = submission([
      question('1', 'complete', 'solved-independently'),
      question('2', 'complete', 'supported-with-hints'),
      question('3', 'partial', 'supported-with-hints'),
      question('4', undefined, 'solved-independently'),
    ]);
    assert.deepEqual(homeworkFacts(sheet, 12), { durationMin: 12, attempted: 2, solvedIndependently: 1, solvedWithHelp: 1 });
    assert.deepEqual(homeworkProblemRows(sheet).map((row) => row.orderInSession), [3, 4]);
  });

  it('an all-marked sheet contributes zero attempts and no tutor problem rows', () => {
    const sheet = submission([question('1', 'complete', 'unattempted')]);
    assert.deepEqual(homeworkFacts(sheet, 0), { durationMin: 0, attempted: 0, solvedIndependently: 0, solvedWithHelp: 0 });
    assert.deepEqual(homeworkProblemRows(sheet), []);
  });
});

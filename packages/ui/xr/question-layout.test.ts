import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveQuestionLayout, type QuestionLayoutViewport } from './question-layout.ts';
import { XR_QUESTION_FIXTURES, fixtureById } from './question-fixtures.ts';
import { MAX_RIVE_CHOICES } from './question-contract.ts';
import type { QuestionContentBlock } from './question-content.ts';

const WIDE: QuestionLayoutViewport = { width: 760, height: 660 };
const TALL: QuestionLayoutViewport = { width: 380, height: 660 };

const layoutFor = (id: string, viewport = WIDE) => {
  const q = fixtureById(id);
  assert.ok(q, `fixture ${id}`);
  return resolveQuestionLayout(q.content, q.interaction, q.choices?.length ?? 0, viewport);
};

test('the interaction is the strongest signal — board-work always wins', () => {
  assert.equal(layoutFor('fx-homework-region').kind, 'board-focus');
});

test('each focus block owns its layout family', () => {
  /* fx-single-image carries a plain `image` block — the diagram-label
     interaction reads its semantic ids, so the layout stays media-left. */
  assert.equal(layoutFor('fx-single-image').kind, 'media-left');
  assert.equal(layoutFor('fx-diagram-labels').kind, 'diagram-focus');
  assert.equal(layoutFor('fx-map').kind, 'map-focus');
  assert.equal(layoutFor('fx-table').kind, 'table-focus');
  assert.equal(layoutFor('fx-code').kind, 'code-focus');
  assert.equal(layoutFor('fx-passage').kind, 'passage-left');
  assert.equal(layoutFor('fx-structured-math').kind, 'equation-focus');
  assert.equal(layoutFor('fx-timeline').kind, 'timeline-focus');
  assert.equal(layoutFor('fx-image-grid').kind, 'image-grid');
});

test('plain media splits left or top on the window aspect', () => {
  assert.equal(layoutFor('fx-image-compare', WIDE).kind, 'image-grid');
  assert.equal(layoutFor('fx-spanish-science', WIDE).kind, 'media-left');
  assert.equal(layoutFor('fx-spanish-science', TALL).kind, 'media-top');
});

test('text questions resolve to the two text layouts', () => {
  assert.equal(layoutFor('fx-text-only').kind, 'text-choices');
  assert.equal(layoutFor('fx-text-only').choiceSurface, 'rive');
  /* A short-text question with no choices has no rail at all. */
  const q: QuestionContentBlock[] = [{ type: 'text', text: 'Explain in a sentence.' }];
  const l = resolveQuestionLayout(q, 'short-text', 0, WIDE);
  assert.equal(l.kind, 'text-only');
  assert.equal(l.choiceSurface, 'none');
});

test('more choices than the rail routes them to the native surface', () => {
  const l = resolveQuestionLayout([], 'multiple-choice', MAX_RIVE_CHOICES + 1, WIDE);
  assert.equal(l.choiceSurface, 'native');
  const fits = resolveQuestionLayout([], 'multiple-choice', MAX_RIVE_CHOICES, WIDE);
  assert.equal(fits.choiceSurface, 'rive');
});

test('long content pages rather than shrinking', () => {
  assert.equal(layoutFor('fx-long-list').paged, true);
  assert.equal(layoutFor('fx-text-only').paged, false);
});

test('every fixture resolves to a layout — the matrix is total', () => {
  for (const f of XR_QUESTION_FIXTURES) {
    const l = resolveQuestionLayout(f.content, f.interaction, f.choices?.length ?? 0, WIDE);
    assert.ok(l.kind.length > 0, `${f.id} resolved`);
  }
});

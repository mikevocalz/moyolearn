import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AiModelRoutes, isAiModelAdministrator } from '../collections/AiModelRoutes.ts';

test('model admin access is fail closed without a trusted allowlist', () => {
  assert.equal(isAiModelAdministrator(null, 'owner@example.com'), false);
  assert.equal(isAiModelAdministrator({ email: 'owner@example.com' }, ''), false);
  assert.equal(isAiModelAdministrator({ email: 'other@example.com' }, 'owner@example.com'), false);
  assert.equal(isAiModelAdministrator({ email: 'OWNER@example.com' }, 'other@example.com, owner@example.com'), true);
});

test('one Qwen candidate is available for evaluation, never active learner routing', () => {
  assert.equal(AiModelRoutes.versions, false);
  const fallback = AiModelRoutes.fields.find((f) => 'name' in f && f.name === 'fallbackModel');
  assert.equal(fallback?.type, 'select');
  if (fallback?.type !== 'select') return;
  const fallbackOptions = Array.isArray(fallback.options) ? fallback.options : [];
  assert.deepEqual(fallbackOptions.map((item) => typeof item === 'string' ? item : item.value), ['none', 'qwen3.8-max']);

  const mode = AiModelRoutes.fields.find((f) => 'name' in f && f.name === 'mode');
  assert.equal(mode?.type, 'select');
  if (mode?.type !== 'select') return;
  const modeOptions = Array.isArray(mode.options) ? mode.options : [];
  assert.deepEqual(modeOptions.map((item) => typeof item === 'string' ? item : item.value), ['disabled', 'evaluation-only']);
});

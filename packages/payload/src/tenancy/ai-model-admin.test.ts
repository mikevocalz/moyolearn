import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AiModelRoutes, isAiModelAdministrator } from '../collections/AiModelRoutes.ts';

test('model admin access is fail closed without a trusted allowlist', () => {
  assert.equal(isAiModelAdministrator(null, 'owner@example.com'), false);
  assert.equal(isAiModelAdministrator({ email: 'owner@example.com' }, ''), false);
  assert.equal(isAiModelAdministrator({ email: 'other@example.com' }, 'owner@example.com'), false);
  assert.equal(isAiModelAdministrator({ email: 'OWNER@example.com' }, 'other@example.com, owner@example.com'), true);
});

test('Qwen is a single disabled or evaluation-only admin choice, never live', () => {
  assert.equal(AiModelRoutes.versions, false);
  const fallback = AiModelRoutes.fields.find((f) => 'name' in f && f.name === 'fallbackModel');
  assert.ok(fallback && 'options' in fallback);
  if (!fallback || !('options' in fallback)) return;
  assert.deepEqual(fallback.options?.map((item) => typeof item === 'string' ? item : item.value), ['none', 'qwen3.8-max']);
  const mode = AiModelRoutes.fields.find((f) => 'name' in f && f.name === 'mode');
  assert.ok(mode && 'options' in mode);
  if (!mode || !('options' in mode)) return;
  assert.deepEqual(mode.options?.map((item) => typeof item === 'string' ? item : item.value), ['disabled', 'evaluation-only']);
});

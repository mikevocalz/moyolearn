// Exercise the authenticated service: uncertain source cannot write learning data.
// SOT-KEYWORDS: tutor source readiness server assessment distillation regression
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Auth } from '@acme/auth/server';
import { evaluateTutorTurn } from './tutor.service.ts';

test('unresolved and absent source provenance never save a grade or distilled facts', async () => {
  const previous = process.env.NEXT_PUBLIC_AUTH_MODE;
  const environment = process.env.NODE_ENV;
  process.env.NEXT_PUBLIC_AUTH_MODE = 'mock';
  process.env.NODE_ENV = 'development';
  try {
    for (const sourceReadiness of [undefined, 'unresolved'] as const) {
      const calls: string[] = [];
      const result = await evaluateTutorTurn(
        {} as Auth,
        new Headers(),
        {
          problem: '12 + 4',
          answer: '3',
          hintDepth: 0,
          sourceReadiness,
        },
        {
          saveTranscript: async () => {
            calls.push('saveTranscript');
          },
          distillation: {
            loadPriorFacts: async () => {
              calls.push('loadPriorFacts');
              return [];
            },
            saveFacts: async () => {
              calls.push('saveFacts');
            },
            loadBlockedTags: async () => {
              calls.push('loadBlockedTags');
              return [];
            },
          },
        },
      );
      assert.equal(result.isCorrect, null);
      assert.deepEqual(calls, []);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_AUTH_MODE;
    else process.env.NEXT_PUBLIC_AUTH_MODE = previous;
    if (environment === undefined)
      Reflect.deleteProperty(process.env, 'NODE_ENV');
    else process.env.NODE_ENV = environment;
  }
});

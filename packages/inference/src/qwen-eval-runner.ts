// Run only on synthetic checked-in fixtures. Never take learner text from stdin,
// argv, files or environment. This script is an explicit, manual evaluation tool.
import 'server-only';
import { runSyntheticQwenEvaluation, type QwenFixtureId } from './qwen-candidate.ts';

const fixtures: readonly QwenFixtureId[] = [
  'math-guided-fractions',
  'spanish-past-tense',
  'science-food-chain',
];

const key = process.env.DASHSCOPE_API_KEY?.trim();
if (!key) {
  console.error('DASHSCOPE_API_KEY is required for synthetic Qwen evaluation.');
  process.exitCode = 1;
} else {
  for (const fixtureId of fixtures) {
    try {
      const result = await runSyntheticQwenEvaluation(fixtureId, { apiKey: key });
      // No student input exists in this lane. No credentials appear in output.
      console.log(JSON.stringify(result));
    } catch {
      console.error('Synthetic evaluation failed: ' + fixtureId);
      process.exitCode = 1;
      break;
    }
  }
}

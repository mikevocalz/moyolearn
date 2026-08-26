// Proves the tutor's model call reaches Claude, with the exact request shape
// `tutor-model.ts` sends: same model, same adaptive thinking, same effort, same
// cache breakpoint on the system half.
//
// It exists because the failure it catches is silent. The SDK reads
// ANTHROPIC_API_KEY from the environment on its own, so a key stored under a
// different name throws no error at import, at build, or at deploy — the
// session simply renders as locked. One run here distinguishes "the tutor is
// broken" from "the tutor cannot see its key".
//
// Run: pnpm --filter web tutor:verify
// SOT: docs/pack/18-tutor-ai-stack.md §1 · packages/app/features/tutor/tutor-model.ts
// SOT-KEYWORDS: tutor verify claude anthropic key model stream check
import nextEnv from '@next/env';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
nextEnv.loadEnvConfig(resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), true, console);
const { default: Anthropic } = await import('@anthropic-ai/sdk');

console.log('key visible to SDK:', process.env.ANTHROPIC_API_KEY ? 'yes' : 'NO');

const stream = new Anthropic().messages.stream({
  model: 'claude-opus-5',
  max_tokens: 1024,
  thinking: { type: 'adaptive' },
  output_config: { effort: 'low' },
  system: [{ type: 'text', text: 'You are a maths tutor for a 10-year-old. Ask ONE question. No preamble.', cache_control: { type: 'ephemeral' } }],
  messages: [{ role: 'user', content: 'I got 1/2 + 1/3 = 2/5. Why is that wrong?' }],
});

let out = '';
for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') out += event.delta.text;
}
const final = await stream.finalMessage();
console.log('stop_reason:', final.stop_reason);
console.log('tokens in/out:', final.usage.input_tokens, '/', final.usage.output_tokens);
console.log('turn:', out.trim());
process.exit(0);

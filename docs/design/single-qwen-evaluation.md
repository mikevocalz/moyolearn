# One Qwen candidate for Moyo

Status: draft implementation, 2026-10-15. No production fallback is enabled.

## Decision

Claude Opus 5 remains the primary tutor. The only proposed Qwen language model is Alibaba Cloud Model Studio qwen3.8-max. Qwen 4 is not a released deployment candidate yet and must replace this one candidate after explicit review, never be appended as another default. ExecuTorch OCR and multilingual Whisper are different perception tools, not extra Qwen tutoring LLMs.

Qwen model reference: https://www.alibabacloud.com/help/en/model-studio/qwen3-8-max
US endpoint reference: https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope

## Current code

packages/inference/src/qwen-candidate.ts provides three hard-coded, synthetic benchmark prompts and a tested HTTP adapter. There is no arbitrary inference input, learner route, credential in source, or hook into the live gateway. packages/inference/src/fallback-policy.ts defines a fail-closed future eligibility preview. Treat a true value there as necessary, never proof of permission.

## Production prerequisites

1. Legal/privacy owner records child-data approval for the exact Alibaba product, US deployment, no-training retention terms, age scope, permitted modalities and incident response.
2. An evaluation harness compares Claude and the single Qwen on each subject x grade-band x task cell. Include English, Spanish, French, Mandarin, Arabic, grading abstention, Socratic never-answer, dialect competence, model refusal and prompt injection.
3. Build a vendor adapter implementing the existing InferenceGateway streamed outcome and usage accounting. Do not send photos or identifying metadata outside the approved modality policy.
4. Resolve the route only from trusted server records. Recheck policy at dispatch; never accept a client/admin status boolean as proof.
5. Restrict fallback to transport unavailability, timeout or rate limiting, and only if the exact subject cell passed. Never retry safety blocks, provider refusals, guardian AI opt-outs or exhausted budgets.
6. Record model served, evaluator version, failover cause, latency and cost without learner identities in the vendor payload. Allow one-click rollback to Claude-only routing.
7. Conduct real traffic tests using authorized synthetic/test accounts before any student data. No live Qwen dispatch before these gates clear.

Review roster: staff inference engineer, education assessment lead, language teaching specialist, privacy counsel, safety red-teamer, SRE, and mobile QA. Use the repo's mandatory Expo, React Native, adaptive UI, impeccable, no-ai-slop, and engineering skills for follow-up implementations.

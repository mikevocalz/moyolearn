# Common brief for every PR #100 blocker agent

Repo: /Users/mikevocalz/moyolearn-pr100. pnpm 10 / turbo monorepo. Payload 4 canary on @payloadcms/db-postgres (schema `payload`), Next app in apps/web, Expo app in apps/mobile, shared Solito code in packages/app, kit in packages/ui (@acme/ui), tokens in packages/theme.

Work ONLY in this directory. Do not commit, push, stash, or checkout. Other agents edit other files at the same time: write only under the paths docs/work/pr-100/contract.md assigns to you. If you need a change in another agent's file, write the exact request into your log under "Requests to other agents" and continue.

Read first, in full: docs/work/pr-100/contract.md, docs/work/pr-100/map.md, packages/app/features/homework/homework.types.ts, docs/design/homework-end-to-end-2026.md.

Standing laws:
- No placeholders, stubs, TODOs, invented APIs or packages. Only the dependencies the contract approves.
- Zustand only for client state. No bare useState/useReducer. React 19 useOptimistic/useActionState are fine.
- Identity comes from `ctx` at the service boundary, never from a request body or client JSON.
- Never claim OCR accuracy or a grade from a human confirmation. No answer mode. No score, grade or answer shown to a child. Retain the assessment-readiness refusal (evaluationReady stays false for photographed pages).
- US law only (COPPA, FERPA). Do not cite EU regulation.
- New modules carry the repo header convention: `// SOT: <docs>` and `// SOT-KEYWORDS: <words>`; UI surfaces in packages/app/features and packages/ui also carry a `// Mobbin: <url> (<note>) · <url> (<note>)` line in the first 40 lines (tooling/check-references.mjs). Comments explain decisions, never narrate code.
- Tests use `node:test` + `node:assert/strict`, fake ports built on Maps. Server-only tests are `*.server-test.ts`. See packages/app/features/summary/summary.server-test.ts and packages/app/features/capture/worksheet-session.test.ts.
- Gates: run the typecheck and test tasks named in your brief before finishing and paste the exact tail of each in your log. A failure caused by another agent's file: name the file and continue.
- Log at docs/work/pr-100/<id>.md: files touched, symbols cited as path:symbol, tests added, gate output, open questions, requests to other agents. Write it in the reviewer voice named in your brief.
- Load these skills with the Skill tool before writing: `no-ai-slop` (always), plus the ones your brief names.

Report back under 400 words: files changed, gate results, what you could not do.

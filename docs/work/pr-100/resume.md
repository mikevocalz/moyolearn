# Resume point (2026-10-15, session limit hit)

Clone: /Users/mikevocalz/moyolearn-pr100, branch feat/homework-worksheet-question-flow-20261015. Pushed: map, contract, types, briefs (bb9694f0).

Uncommitted partial work (typechecks clean in payload, student-model, app, web; untested, unreviewed):
- B1: three Homework* collections, homework_additive.sql, payload.config/payload-types/index/sweep.sql/account-deletion edits. Missing: homework.repository.ts, homework.service.ts + server-test, routes, server.ts exports, ADR-124, log.
- B3: guardian timeline, assign sheet, wards/timeline hooks, routes, Mobbin docs, family/home edits. Missing: gates, copy table, a11y audit, handoff spec, log. Mobbin URLs unverified.
- B5: practice-generator/checker + test, expo-print/expo-sharing deps. Missing: service, sheet HTML, native print, preview, routes, gates, log.
- B2 and B4: not started.

Backup patch of the partial work: session scratchpad partial-agents.patch (taken before the resume agents ran).
Scratch DB: docker container moyo-pr100-pg, postgres://postgres:scratch@localhost:54329/postgres (empty).
Next: relaunch B1, B3, B5 with "resume" prompts, max 3 concurrent; then B2, B4; then B6.

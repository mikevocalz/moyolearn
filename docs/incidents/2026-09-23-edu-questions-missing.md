# `edu.questions` missing in production

Date: 2026-09-23
Worktree: `/Users/mikevocalz/moyo-onprod` @ `238d189` (`upgrade/expo-sdk-58-beta`)
Related: `docs/decisions/adr-119-graded-turns-need-a-locked-revision.md`, `docs/decisions/2026-09-22-migration-drift.md`

## Severity call

**Yes, something is broken for a user right now — if the ADR-119 route code is deployed.** `edu.questions` does not
exist, and `GET /api/tutor/next` calls `issueEduQuestion` unconditionally on every request before it returns a problem.
Postgres answers `42P01`, the throw escapes `protectedOperation`, and the route's own catch turns it into an HTTP 500.
Two live learner surfaces call that route on mount: the learner home hero (`use-next-skill.ts:42`) and the tutor session
screen (`tutor-screen.tsx:262`). This is not a table nobody queries yet. The repo's own status doc says so in as many
words — `docs/verification/homework-v3/docs-and-status.md:20`: *"`/api/tutor/next` will fail against a database without
the table — it must be applied before this change is deployed."* The remaining question, tracked in §3 and §6 below, is
whether that route code is on the deployed lineage or only on this worktree's.

(Sections below are filled in as evidence lands; see "What I could not determine" at the foot.)

## 1. Who reads it

Every call site touching `edu.questions` or `transcripts.question_id` / `transcripts.revision`:

| Path | File:line | Operation |
|---|---|---|
| `GET /api/tutor/next` | `apps/web/app/api/tutor/next/route.ts:78` → `apps/web/lib/edu.repository.ts:589` | `insert into edu.questions … on conflict do update` |
| `POST /api/tutor/evaluate` | `apps/web/app/api/tutor/evaluate/route.ts:59` → `apps/web/lib/edu.repository.ts:660` | `select … from edu.questions … for update` |
| transcript write (inside the evidence lock) | `apps/web/lib/edu.repository.ts:~540` (`insertTranscript`) | `insert into edu.transcripts (…, question_id, revision)` |
| `POST /api/memory/forget-all` | `apps/web/app/api/memory/forget-all/route.ts:44` → `apps/web/lib/edu.repository.ts:483` | `delete from edu.questions where learner_id = $1` |
| retention sweep | `apps/web/app/api/retention/sweep/route.ts:134` → `apps/web/lib/edu.repository.ts:935` | `delete from edu.questions where expires_at <= $1` |

Port declaration and service-side consumer: `packages/app/features/tutor/tutor.service.ts:100,155,158`
(`withCurrentEvidence`). The production implementation is `withCurrentEduEvidence`
(`apps/web/lib/edu.repository.ts:649`).

Client consumers of the affected routes:
- `packages/app/features/home/use-next-skill.ts:42` — `getJson<NextProblem>('/api/tutor/next')`, the learner home hero.
- `packages/app/features/tutor/tutor-screen.tsx:262` — `fetch(\`${API_URL}/api/tutor/next\`)` on the tutor screen.
- `packages/app/features/tutor/tutor-screen.tsx:355` — `fetch(\`${API_URL}/api/tutor/evaluate\`)`, the answer check.

Note `insertTranscript` names `question_id` and `revision` in its column list on **every** transcript write, not only
graded ones — so the missing columns break transcript writes independently of the missing table, wherever that function
is reached.

## 2. What happens when that path runs

Filled in below once traced end to end.

## 3. Is the path reachable

Filled in below.

## 4. Has it been failing silently

Filled in below — read-only `edu.transcripts` counts and date ranges.

## 5. What should happen

Filled in below.

## What I could not determine

Filled in below.

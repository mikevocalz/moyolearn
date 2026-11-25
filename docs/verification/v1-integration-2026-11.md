# v1 integration record

Date: 2026-11-25. Lane A (integration). Base `main` = `599456a7` (unchanged since 2026-11-05). Work happened in a clone on the external drive after the internal disk filled during the first install; the clone is `/Volumes/QNX/clones/moyolearn-v1-20261125` and was deleted once the PR was open.

## Starting state, read from GitHub on 2026-11-25

| Line | Head | Ahead of main | Draft PR |
| --- | --- | --- | --- |
| `release/moyo-billing-schema-20261116` | `fcc5838b` | 18 | none (contains #152 and #156) |
| `codex/homework-prior-work-data-20261114` | `a1315076` | 3 | #153 to `release/meta-vr-start-2026` |
| `codex/homework-prior-work-ui-20261114` | `2ef3fa84` | 7 (contains data) | #154 to the data branch |
| `codex/hands-integration-20261114` | `c579374e` | 3 | #155 to `release/meta-vr-start-2026` |
| virocore `codex/hands-far-input-20261114` | `1471b3faf` | | virocore #121 |

`release/meta-vr-start-2026` equals `main`. PRs #153, #154, #155 and virocore #121 were still open drafts. `git merge-tree` showed each line merging clean onto `main` alone, one textual conflict between billing and homework data, and no file edited by two of the three homework or hands lines.

## Merge order and results

Branch `integrate/v1-main-20261125` from `main`, each step `git merge --no-ff --no-edit`:

| Step | Source | Merge commit | Stat |
| --- | --- | --- | --- |
| 1 | billing release line | `423e4bda` | 106 files, +9847 −571 |
| 2 | homework data | `27944225` | 26 files, +1084 −64; conflict below |
| 3 | homework ui | `fe324044` | 13 files, +524 −30 |
| 4 | hands | `1457ff92` | 22 files, +4473 −7 |

Conflict: `packages/payload/package.json` `scripts.test`. Billing added `--conditions=react-server`; data added `src/migrations/*.test.mjs`. Resolved to the union: `node --conditions=react-server --test src/tenancy/*.test.ts src/retention/*.test.mjs src/migrations/*.test.mjs`. Dependency lists auto-merged (billing's additions, all `catalog:` or `workspace:`). `pnpm-lock.yaml` comes from the billing line; the other lines do not touch it, and `pnpm install --frozen-lockfile` accepted it.

Semantic coupling worth watching: the hands XR screen `packages/app/features/tutor/tutor-xr-screen.native.tsx` reads `tutor.store.ts`, which the ui line rewrites (adds `sessionGeneration`, `endForPriorWork`). Types check; behaviour of the XR screen on a session ended for prior work is untested on any line.

## Gates run locally on `1457ff92`

pnpm 10.32.1, Node v26.13.0, store on the external drive.

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | 22 min 31 s, fresh store |
| `pnpm typecheck` | 0 | turbo: 20 successful, 20 total |
| `pnpm lint` | 1 then 0 | first run failed in `tooling/check-joint-ownership.mjs`: `apps/web/public/natalie/natalie.gltf` not found. That directory is gitignored (`.gitignore:40`) and exists only in local checkouts. After copying it from the local checkout: joint ownership clean, 96/96 joints, turbo 20/20. Not merge-induced. |
| `pnpm --filter @acme/app test` | 0 | unit 712 pass 0 fail; server 137 pass 0 fail |
| `pnpm --filter @acme/auth test` | 0 | 133 pass 0 fail; preflight 4 pass |
| `pnpm --filter @acme/payload test` | 0 | 28 tests, 12 pass, 16 skipped (Postgres-backed cases skip without `MOYO_PG_TEST_REPOSITORY`), 0 fail |

Native iOS, Android mobile-runtime and Quest assembly lanes were not run locally; CI on the PR covers them.

## CI evidence inherited from the billing line

`fcc5838b` itself has never had an Actions run and no PR. Its parent `73427f6e` is the head of PR #152, where on 2026-11-16 every turbo, web, marketing, desktop, visionOS and Quest-assembly check passed, Android mobile-runtime failed (run 43954047539: React Native redbox "Could not load bundle" in `native-3d-smoke.tsx` after the APK built and the emulator booted), and iOS simulator was cancelled at 23 minutes with no result (run 43954047837; the workflow has no concurrency block and a 180-minute timeout, so the cancel was external).

## Sales-inquiry decision, held for Mike

The billing line carries PR #152 (SignalIQ sales inquiry, 14 commits) interleaved with the native build repairs the other lines need: Android startup fix `f179bcc6`, Quest 90-minute allowance `72204dc2`, PICO scoping `a8ab86f9`, mobile-runtime job `bec68278`. Splitting it out means rewriting those mixed commits, which the build prompt's stop conditions forbid, so the merge to `main` waits for a decision.

It is not inert for families on three points:

- The public marketing inquiry form accepts audience `parent` (`packages/payload/migrations/signaliq_marketing_additive.sql` CHECK constraint).
- `packages/payload/src/collections/Users.ts` gains `access.update` and `access.delete` through `marketingIdentityAccess` on the learner-bearing `users` collection. It is a no-op only while `MOYO_MARKETING_ADMIN_IDS` is unset.
- With Stripe secrets set, family `invoice.paid` events for Moyo plan prices are written to `payload.marketing_verified_payments` by `packages/app/marketing/repository/marketing.repository.ts:saveVerifiedPayment`.

Also: `apps/web/vercel.json` adds a cron hitting `/api/marketing/sync` every minute. No migration on the line alters existing rows (verified by applying all three twice against a local scratch Postgres, record in `v1-migrations-local-2026-11.md`).

Options: accept the line as-is with those points named in the PR, or defer the billing line and land homework data, ui and hands directly, each of which merges clean onto `main` alone.

## Dependency refresh

Mike asked on 2026-11-25 for every package to move to npm latest, Expo included. That overrides the build prompt's rule against upgrades the loop does not need. It runs as a separate branch stacked on this one, `chore/npm-latest-20261125`, with its own record in `docs/decisions/npm-latest-2026-11-25.md`.

## Branch cleanup (7.8), nothing deleted

56 remote branches are ancestors of `main` (including `release/meta-vr-start-2026`). 47 are not, of which at least 12 were squash-merged through PRs #139 to #151 and hold no unmerged content. The full lists are in the lane A analysis; deletion needs Mike's approval.

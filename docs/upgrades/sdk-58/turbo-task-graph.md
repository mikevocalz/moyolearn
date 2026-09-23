# Turbo task graph — 2026-09-17

`pnpm exec turbo run build typecheck lint test --dry=json`, turbo 2.10.13, exit 0.
80 tasks across 20 workspaces. `—` means turbo has the task registered but the
workspace declares no script for it, so the run is a no-op that still reports success.

| Workspace | build | typecheck | lint | test |
|---|---|---|---|---|
| `@acme/app` | — | yes | yes | yes |
| `@acme/art` | — | yes | yes | — |
| `@acme/assets` | — | yes | yes | — |
| `@acme/auth` | — | yes | yes | yes |
| `@acme/avatar` | — | yes | yes | yes |
| `@acme/config` | — | — | — | — |
| `@acme/inference` | — | yes | yes | yes |
| `@acme/jobs` | — | yes | yes | yes |
| `@acme/payload` | — | yes | yes | yes |
| `@acme/safety` | — | yes | yes | yes |
| `@acme/secure` | — | yes | yes | yes |
| `@acme/student-model` | — | yes | yes | yes |
| `@acme/theme` | yes | yes | yes | — |
| `@acme/ui` | — | yes | yes | yes |
| `@acme/voice` | — | yes | yes | yes |
| `admin-vite` | yes | yes | yes | — |
| `mobile` | — | yes | yes | — |
| `storybook` | yes | yes | yes | — |
| `web` | yes | yes | yes | — |
| `web-vite` | yes | yes | yes | — |

## What the graph says about coverage

- **`build` exists in five workspaces only**: `@acme/theme`, `admin-vite`, `storybook`,
  `web`, `web-vite`. Every other `packages/*` is consumed from source through
  `workspace:*`, so there is nothing to build — that is the design, not a gap.
- **No web application has a `test` task.** `test` is a no-op in: `@acme/art`, `@acme/assets`, `@acme/config`, `@acme/theme`, `admin-vite`, `mobile`, `storybook`, `web`, `web-vite`.
  CI runs `pnpm turbo build typecheck lint test`, so for `web`, `web-vite`, `admin-vite`
  and `storybook` that chain proves build + typecheck + lint and nothing else. A green
  `pnpm test` is 12 package suites; it is not evidence about any web app.
- `@acme/config` declares none of the four. It is configuration only, and the graph
  records that rather than leaving it to be rediscovered.
- `mobile` has neither `build` nor `test`: its build is native and goes through EAS,
  which is why Turbo success has never been mobile-build evidence.

## The audit, done — and the bug it found

`pnpm dlx @turbo/codemod@latest migrate . --force` reports nothing to do: 2.10.13 is already
the requested version, and `turbo.json` came back byte-identical. Against the skill's
2.10.14-canary.4 it would only bump the catalog and version the `$schema` URL. No behavioural
transform exists for any of what follows — the codemod passed `$TURBO_DEFAULTS$` through
untouched, because it does not validate input tokens.

### `$TURBO_DEFAULTS$` is not a token. `$TURBO_DEFAULT$` is.

Turbo treats the unknown token as a literal glob matching nothing, and a non-empty `inputs`
array *replaces* the defaults rather than extending them. So every task carrying it hashed
almost none of its own package.

Measured on `@acme/secure#test`, selecting the task by id from `--dry=json` (taking
`tasks[0]` measures a dependency task and answers a different question — that mistake was
made once here and is why the id is spelled out):

| config | files hashed | hash before a source edit | hash after |
|---|---|---|---|
| before | **1** (`package.json`) | `93fd405f8aef61b5` | `93fd405f8aef61b5` — unchanged |
| after | **20** | `a41ee8fff0f77688` | `5ba55b8663aebf84` — changed |

Appending a line to `packages/secure/src/policy.ts` did not move the hash. Turbo would have
replayed a cached pass of a test suite whose source had changed, and did: the agent's run
shows three consecutive `>>> FULL TURBO` hits across that edit, tests never executing.

### `^build` carried no hash, so hand-written globs were the only dependency signal

No `packages/*` except `@acme/theme` has a `build` script, so `dependsOn: ["^build"]` created
graph edges that contributed nothing to any hash. App builds depended instead on inline
`../../packages/**` globs, and those had drifted: `web-vite#build` globbed `ui` and `theme`
but not `@acme/avatar`, which it imports; `storybook#build` globbed all ~12k files of
`@acme/app`, which it neither declares nor imports; and both pulled
`.turbo/turbo-*.log` — turbo's own logs — into their inputs.

Replaced with the skill's transit node. An edit to `packages/avatar/src/body-index.ts` moved
no build-task hash before, and moves five after.

### Outputs that were never declared

`@acme/theme#build` writes a third file (`payload-admin.css`). `web#build` also writes
`public/natalie/**` and `public/pdfjs/**`. `web-vite#build` declared `dist/**`, which that app
never emits — so a cache hit restored zero bytes. `admin-vite#build` emits `dist` *and*
`.vercel/output`. `web#typecheck` and `@acme/avatar#typecheck` write `.tsbuildinfo` files.
The other 47 script-backed tasks emit nothing and correctly declare `outputs: []`.

A declared output still feeds its own task's hash when the file is git-tracked, which the
skill does not mention: `packages/theme/*.css` and `packages/avatar/.types/**` are committed,
so deleting a build artifact forced a rebuild instead of a restore. Fixed with negation globs.

### Env

`globalEnv`'s nine variables were duplicated verbatim into `build.env`, and that copy was dead
— every workspace with a build script has a `pkg#build` override, and an override replaces
rather than merges, so `web#build`'s resolved `env` was empty. Replaced with what each build
actually reads. `NEXT_PUBLIC_*` needs no declaration (Next inference covers it, measured), but
`VITE_*` does for the two Vite apps: both detect as `nitro`, which infers only `NITRO_*`.

### Uncached pass

`turbo run build typecheck lint test --force --continue`: 48 of 54 tasks succeed, 0 cached,
1m5s. The six failures are `lint` in `@acme/app`, `@acme/art`, `@acme/avatar`, `@acme/ui`,
`mobile` and `web`, all pre-existing and all reproducible outside turbo. `packages/art` has
**no `eslint.config.mjs` at all**, so `@acme/art#lint` can never pass — which is what CI on
`main` has been failing on for five runs since 2026-09-12. `apps/web`'s lint reads
`public/pdfjs/**`, i.e. its own build output.

## Follow-ups this surfaced, outside `turbo.json`

1. `packages/art/eslint.config.mjs` is missing — `pnpm lint` cannot be green until it exists.
2. `apps/web`'s ESLint lints `public/pdfjs/**`, generated by its own build.
3. `packages/avatar/.probe/` should be in ESLint's ignores.
4. Root `package.json` uses the `turbo <task>` shorthand the skill bans; `ci.yml` has been
   moved to `turbo run` but the scripts have not.
5. `apps/storybook` and `apps/web-vite` each disagree with their own dependency lists.


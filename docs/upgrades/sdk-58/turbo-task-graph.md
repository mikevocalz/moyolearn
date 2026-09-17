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

## Not yet done

No `turbo.json` change is proposed here. The `inputs`/`outputs`/`env` audit and the
`@turbo/codemod migrate` run (turbo 2.10.11 -> 2.10.13 is already in the catalog) are
outstanding, as is an uncached `--force` pass.

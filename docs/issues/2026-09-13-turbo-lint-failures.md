# `pnpm turbo lint` fails, and its default output overstates how widely

<!--
What it is: the four real `lint` failures in the workspace, and a correction to
the "nine packages are missing an eslint.config.js" reading that `pnpm turbo
lint`'s default bail-on-first-failure output produces.
Why it exists: found while verifying `feat/spatial-whiteboard-xr`. None of the
four is that branch's, and the count that gets quoted is an artefact of how
turbo reports a run it killed.
SOT: tooling — turbo.json · packages/art/package.json ·
     packages/avatar/.probe/ · packages/ui/adaptive-panes/CollapsiblePane.tsx ·
     apps/mobile/components/splash/redraw/
SOT-KEYWORDS: issue lint eslint config turbo continue bail exit code
              pre-existing out of scope react-hooks
-->

Filed: 2026-09-13 · Found on: `feat/spatial-whiteboard-xr` @ `6e5707b` ·
Status: open, unowned

## The headline correction

**One package is missing an `eslint.config.js`, not nine.** Eighteen of the
nineteen packages with a `lint` task have an `eslint.config.mjs`; `packages/art`
does not.

The nine comes from `pnpm turbo lint` without `--continue`. Turbo starts the
tasks it can in parallel, and when `@acme/art` exits 2 it kills the rest — each
of which then prints a bare `ELIFECYCLE Command failed.` with no ESLint output at
all, and the summary reports `Tasks: 0 successful, 9 total`. Nine is how many
tasks turbo had started, not how many failed on their own merits.

## Reproduction — the default run

```
$ cd /Users/mikevocalz/MoyoLearn
$ pnpm turbo lint; echo "EXIT=$?"
```

```
   • Packages in scope: @acme/app, @acme/art, @acme/assets, @acme/auth, @acme/avatar, @acme/config, @acme/inference, @acme/jobs, @acme/payload, @acme/safety, @acme/secure, @acme/student-model, @acme/theme, @acme/ui, @acme/voice, admin-vite, mobile, storybook, web, web-vite
   • Running lint in 20 packages

@acme/art:lint: Oops! Something went wrong! :(
@acme/art:lint: ESLint: 9.39.5
@acme/art:lint: ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
@acme/art:lint: From ESLint v9.0.0, the default configuration file is now eslint.config.js.
@acme/art:lint:  ELIFECYCLE  Command failed with exit code 2.
@acme/jobs:lint:  ELIFECYCLE  Command failed.
@acme/secure:lint:  ELIFECYCLE  Command failed.
@acme/theme:lint:  ELIFECYCLE  Command failed.
@acme/safety:lint:  ELIFECYCLE  Command failed.
@acme/auth:lint:  ELIFECYCLE  Command failed.
@acme/assets:lint:  ELIFECYCLE  Command failed.
@acme/avatar:lint:  ELIFECYCLE  Command failed.
@acme/inference:lint:  ELIFECYCLE  Command failed.
@acme/art#lint:  ERROR  command (/Users/mikevocalz/MoyoLearn/packages/art) /opt/homebrew/bin/pnpm run lint exited (2)

 Tasks:    0 successful, 9 total
Failed:    @acme/art#lint
EXIT=2
```

The eight `Command failed.` lines carry no ESLint output because those runs were
killed, not because they found anything.

## Reproduction — the full run

```
$ pnpm turbo lint --continue --force; echo "EXIT=$?"
```

```
 Tasks:    15 successful, 19 total
Cached:    0 cached, 19 total
Failed:    @acme/art#lint, @acme/avatar#lint, @acme/ui#lint, mobile#lint
EXIT=2
```

Nineteen tasks, four failures. Confirmed against the filesystem:

```
$ for p in art assets auth avatar inference jobs safety secure theme; do
    printf "%-12s " "$p"; ls packages/$p/eslint.config.* 2>/dev/null || echo "(none)"
  done
art          (none)
assets       packages/assets/eslint.config.mjs
auth         packages/auth/eslint.config.mjs
avatar       packages/avatar/eslint.config.mjs
inference    packages/inference/eslint.config.mjs
jobs         packages/jobs/eslint.config.mjs
safety       packages/safety/eslint.config.mjs
secure       packages/secure/eslint.config.mjs
theme        packages/theme/eslint.config.mjs
```

## The four failures

### 1 · `@acme/art` — no `eslint.config.mjs` · exit 2

`packages/art/package.json` declares `"lint": "eslint"` and the package has no
config file. ESLint 9 has no implicit config, so the task cannot run at all.

The package is four TypeScript files (`index.ts`, `registry.ts`,
`registry.assert.ts`, `registry.provenance.ts`). It arrived in `f8e3ee9`
("Design reset v2: baseline, art register, and the gate that makes it
load-bearing", 2026-09-05), which is an ancestor of `main`. Copying any sibling
package's `eslint.config.mjs` is very likely the whole fix.

### 2 · `@acme/avatar` — a generated artefact is being linted · exit 1

Hundreds of `no-var` errors, all in one file:

```
/Users/mikevocalz/MoyoLearn/packages/avatar/.probe/materials.js
      4:3    error    Unexpected var, use let or const instead    no-var
      5:3    error    Unexpected var, use let or const instead    no-var
      … (continues)
```

`.probe/materials.js` is the shader probe's esbuild bundle — build output, not
source. The fix is an ignore entry, not an edit.

### 3 · `@acme/ui` — one real rule violation · exit 1

```
/Users/mikevocalz/MoyoLearn/packages/ui/adaptive-panes/CollapsiblePane.tsx
  83:26  error  Calling setState synchronously within an effect can trigger cascading renders
                react-hooks/set-state-in-effect

  81 |   const [grown, setGrown] = useState(false);
  82 |   useEffect(() => {
> 83 |     if (!(open && fill)) setGrown(false);
     |                          ^^^^^^^^
  84 |   }, [open, fill]);

✖ 5 problems (1 error, 4 warnings)
```

Plus four warnings that do not fail the run: an unused `rowHeight` in
`Composer.tsx`, an unused `useStore` import in `TutorThread.tsx`, an
`import/first` in `motion.tsx`, and a React Compiler "incompatible library" note
on `useReactTable` in `DataTable.stories.tsx`.

### 4 · `mobile` — two real rule violations · exit 1

```
/Users/mikevocalz/MoyoLearn/apps/mobile/components/splash/redraw/MoyoSplash.tsx
  87:5  error  Modifying a value previously passed as an argument to a hook is not allowed
               react-hooks/immutability

  85 |   const startTagline = useCallback(() => {
  86 |     if (still) return;
> 87 |     tagline.value = withDelay(
     |     ^^^^^^^ `tagline` cannot be modified

/Users/mikevocalz/MoyoLearn/apps/mobile/components/splash/redraw/moyo-splash-scene.ts
  41:8  error  Unable to resolve path to module 'redraw'    import/no-unresolved

✖ 8 problems (4 errors, 4 warnings)
```

Both are in `components/splash/redraw/`, which `apps/mobile/tsconfig.json`
already excludes from typechecking with a written reason: the Redraw tarballs are
a subscriber distribution and are not in `vendors/` yet, so the directory imports
modules that do not exist. ESLint has no matching exclusion, so `import/no-unresolved`
fires on the same missing package the tsconfig note is about.

## Why all four are out of scope for `feat/spatial-whiteboard-xr`

None of the five files named above is in that branch's diff:

```
$ git diff --stat main..HEAD -- packages/art packages/avatar \
    packages/ui/adaptive-panes/CollapsiblePane.tsx \
    packages/ui/Composer.tsx packages/ui/TutorThread.tsx packages/ui/motion.tsx \
    apps/mobile/components/splash
(no output)
```

The branch adds `packages/ui/xr/`, `packages/ui/XrBoardButton.tsx` and the tutor
feature's spatial half. `@acme/ui` fails on `adaptive-panes/CollapsiblePane.tsx`,
which the branch does not touch — the branch's own files produce no ESLint error.

## Suggested order

1. `@acme/art` — a copied config file, and the only failure that stops the whole
   run for everything else.
2. `@acme/avatar` — an ignore entry for `.probe/`.
3. `mobile` — an ESLint ignore for `components/splash/redraw/`, matching the
   tsconfig exclusion and carrying the same note, to be deleted when the Redraw
   tarballs land.
4. `@acme/ui` — the only one that is a genuine code question rather than a
   configuration one.

Worth considering separately: whether `lint` should run with `--continue` by
default, so a single missing config file stops hiding the state of the other
eighteen packages.

## Environment

```
node    v26.8.1   (engines.node is ">=24.15.0 <26")
pnpm    10.32.1
turbo   2.10.11
eslint  9.39.5
```

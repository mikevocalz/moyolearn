# `check-joint-ownership` and `check-material-inputs` fail on `packages/avatar`

<!--
What it is: two tooling gates that exit 1 against `packages/avatar`, filed with
the proof that they fail identically on the base commit.
Why it exists: they were found while verifying `feat/spatial-whiteboard-xr` and
they are not that branch's. Fixing them there would put unrelated avatar changes
into a whiteboard diff.
SOT: tooling/check-joint-ownership.mjs · tooling/check-material-inputs.mjs ·
     packages/avatar/src/presence/
SOT-KEYWORDS: issue avatar gate joint ownership material inputs humano bones
              pre-existing out of scope tooling
-->

Filed: 2026-09-13 · Found on: `feat/spatial-whiteboard-xr` @ `6e5707b` ·
Base: `2c06a96` (`main`) · Status: open, unowned

## Reproduction

Both gates are plain `.mjs` and take no arguments.

```
$ cd /Users/mikevocalz/MoyoLearn
$ node tooling/check-joint-ownership.mjs; echo "EXIT=$?"
```

```
  FAIL packages/avatar/src/presence/blend.test.ts: bone names typed here (DEF-spine.006, DEF-eye.L, DEF-spine.003) — import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset
  FAIL packages/avatar/src/presence/clip-player.test.ts: bone names typed here (DEF-spine.006, DEF-eye.L, DEF-spine.003) — import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset
  FAIL packages/avatar/src/presence/clip-player.ts: bone names typed here (DEF-spine) — import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset
  FAIL packages/avatar/src/presence/feet.test.ts: bone names typed here (DEF-foot.L, DEF-foot.R, DEF-spine) — import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset
  FAIL packages/avatar/src/presence/turn-toward.test.ts: bone names typed here (DEF-spine.006, DEF-spine.003, DEF-spine) — import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset
EXIT=1
```

```
$ node tooling/check-material-inputs.mjs; echo "EXIT=$?"
```

```
  FAIL packages/avatar/src/presence/humano.ts cites tools/fold-solve.mjs, which does not exist — fix the reference, or record it in ABSENT_TOOLS with why
  FAIL packages/avatar/src/presence/humano.ts cites tools/clasp-fingers-solve.mjs, which does not exist — fix the reference, or record it in ABSENT_TOOLS with why
EXIT=1
```

## Proof that both predate this branch

The base commit's tree was extracted to a temporary directory and the gates run
against it there. `check-joint-ownership.mjs` imports `humano.ts`, which imports
`three`, so the real `node_modules` trees were symlinked in; nothing else was
changed.

```
$ git merge-base main HEAD
2c06a96d1b9a7d91bded5e4e53e16667481059c1

$ git archive 2c06a96d1b9a7d91bded5e4e53e16667481059c1 | tar -x -C "$TMP/base"
$ ln -s /Users/mikevocalz/MoyoLearn/node_modules "$TMP/base/node_modules"
$ ln -s /Users/mikevocalz/MoyoLearn/packages/avatar/node_modules "$TMP/base/packages/avatar/node_modules"

$ node "$TMP/base/tooling/check-joint-ownership.mjs"; echo "EXIT=$?"
```

```
  FAIL packages/avatar/src/presence/blend.test.ts: bone names typed here (DEF-spine.006, DEF-eye.L, DEF-spine.003) — import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset
  FAIL packages/avatar/src/presence/clip-player.test.ts: bone names typed here (DEF-spine.006, DEF-eye.L, DEF-spine.003) — import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset
  FAIL packages/avatar/src/presence/clip-player.ts: bone names typed here (DEF-spine) — import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset
  FAIL packages/avatar/src/presence/feet.test.ts: bone names typed here (DEF-foot.L, DEF-foot.R, DEF-spine) — import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset
  FAIL packages/avatar/src/presence/turn-toward.test.ts: bone names typed here (DEF-spine.006, DEF-spine.003, DEF-spine) — import HUMANO_BONES or FINGER_BONES so they cannot drift from the asset
EXIT=1
```

```
$ node "$TMP/base/tooling/check-material-inputs.mjs"; echo "EXIT=$?"
```

```
  FAIL packages/avatar/src/presence/humano.ts cites tools/fold-solve.mjs, which does not exist — fix the reference, or record it in ABSENT_TOOLS with why
  FAIL packages/avatar/src/presence/humano.ts cites tools/clasp-fingers-solve.mjs, which does not exist — fix the reference, or record it in ABSENT_TOOLS with why
EXIT=1
```

Byte-identical to the branch output, in both cases and in the same order.

## Why it is out of scope for `feat/spatial-whiteboard-xr`

`packages/avatar` is not in that branch's diff:

```
$ git diff --stat main..HEAD -- packages/avatar
(no output)
```

The branch touches the tutor's whiteboard and its spatial presentation. Nothing
in it reads a bone name, a Humano rig or a material input. Fixing these here
would put unrelated avatar changes into a whiteboard diff and would make the
branch's own review harder to read.

## What a fix looks like

**`check-joint-ownership`** wants the five files to import `HUMANO_BONES` or
`FINGER_BONES` rather than typing `'DEF-spine.006'` inline. Four of the five are
tests, and a test that hardcodes a bone name is the case the gate is arguing
about — a test fixture that drifts from the asset still passes while the runtime
breaks. The judgement call is whether a test is allowed to name a bone literally
in order to be readable; whoever owns the avatar should make it, and if the
answer is yes the gate needs a test-file exemption rather than five edits.

**`check-material-inputs`** wants `humano.ts` to stop citing two tools that do
not exist — `tools/fold-solve.mjs` and `tools/clasp-fingers-solve.mjs`. The gate
names its own escape hatch: fix the reference, or record it in `ABSENT_TOOLS`
with why. If the two solvers were run once and their output baked into the rig,
`ABSENT_TOOLS` with that sentence is the honest entry.

## Environment

```
node   v26.8.1   (engines.node is ">=24.15.0 <26" — every turbo run warns)
pnpm   10.32.1
```

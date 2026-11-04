# ADR-124 — Kinetrell is pinned to its git tag through a vendored tarball

**Date:** 2026-11-04 · **Status:** accepted
**Decides:** how `packages/motion` depends on Kinetrell, which is not on npm

## Context

PR-M01 makes Kinetrell the animator for choreographed motion. Kinetrell is
published from `github.com/mikevocalz/Kinetrell` (public) and tagged
`0.1.0-alpha.2` at commit `00d0ed4`; it has never been published to npm. The
tag carries source only: every `kinetrell/*` export points at `dist/`, which the
package's `prepare` script (`tsdown`) writes.

## What was tried first

`"kinetrell": "git+https://github.com/mikevocalz/Kinetrell.git#0.1.0-alpha.2"`,
with `kinetrell` added to `onlyBuiltDependencies` (pnpm 10 otherwise refuses a
git-hosted package with a build script: `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`).
The lockfile pinned the commit tarball on codeload, and the install and build
worked on a Mac with Node 24.22.2.

On GitHub's ubuntu runners every job's `pnpm install --frozen-lockfile` failed
in that `prepare`: tsdown reported "Failed to load the config file due to a
known Node.js bug ... upgrading Node.js to v24.11.1 or later"
(`ERR_PNPM_PREPARE_PACKAGE`, run 41914564828), although the job's own Node is
24.19.0 from `.nvmrc`. The build runs inside pnpm's temporary install of the
package, under a runtime the workflow does not choose. A dependency whose
install depends on that is not reproducible.

## Decision

Pin the tag by its built artifact, the way this repo already consumes every
non-npm package:

- `vendors/kinetrell-0.1.0-alpha.2.tgz`: the tag's source built with its own
  `tsdown`, packed with `npm pack --ignore-scripts`. `package.json` is
  byte-identical to the tag's. Provenance and sha256 are in `vendors/README.md`.
- `packages/motion/package.json` declares `"kinetrell": "0.1.0-alpha.2"`; the
  root `pnpm.overrides` maps it to `file:./vendors/kinetrell-0.1.0-alpha.2.tgz`,
  the same shape as `@viro-external/*` and the Nitro V1 ports.
- The lockfile records the tarball's sha512 integrity, so a changed file fails
  `--frozen-lockfile` instead of installing.
- No install-time build: `onlyBuiltDependencies` does not list it.

Bumping is: pack the new tag the same way, replace the tarball, update the two
version strings and `vendors/README.md`, run `pnpm install`.

## The npm admission gate

`tooling/business-studio-npm.mjs --check` audits the Graphite/Reanimated/Worklets
family through the default catalog. Kinetrell is not in its `TARGETS`, and its
peers resolve to the catalog's existing Reanimated 4.7.1, Worklets 0.13.1,
Gesture Handler 3.4.0, GSAP 3.15.0 and Lenis 1.3.26, so no installed copy of a
target changes. The gate passes (exit 0) with this change.

## Revisit when

Kinetrell publishes to npm: then it becomes a catalog entry like any other
package and the tarball goes.

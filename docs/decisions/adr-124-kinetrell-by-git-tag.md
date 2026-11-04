# ADR-124 — Kinetrell is consumed by git tag, and its `prepare` build is allowed

**Date:** 2026-11-04 · **Status:** accepted
**Decides:** how `packages/motion` depends on Kinetrell, which is not on npm

## Context

PR-M01 makes Kinetrell the animator for choreographed motion. Kinetrell is
published from `github.com/mikevocalz/Kinetrell` (public) and tagged
`0.1.0-alpha.2` at commit `00d0ed4`; it has never been published to npm. The
tag carries source only: every `kinetrell/*` export points at `dist/`, which the
package's `prepare` script (`tsdown`) writes.

The repo already vendors non-npm packages as tarballs under `vendors/` with
`file:` specifiers (Viro, expo-pico, the Nitro V1 ports). Those exist because
each one carries Moyo patches or a build nobody else publishes. Kinetrell carries
neither: the tag is the release.

## Decision

`packages/motion/package.json` declares

    "kinetrell": "git+https://github.com/mikevocalz/Kinetrell.git#0.1.0-alpha.2"

and `pnpm-workspace.yaml` adds `kinetrell` to `onlyBuiltDependencies`.

- **The lockfile pins the commit, not the tag.** pnpm resolves the tag once and
  records `https://codeload.github.com/mikevocalz/Kinetrell/tar.gz/00d0ed4…`.
  `--frozen-lockfile` installs that tarball; a moved tag cannot change what CI
  installs without a lockfile diff in review.
- **The build is allowed by name.** pnpm 10 refuses a git-hosted package with a
  build script (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`) unless it is listed.
  Without the entry the install fails outright; it does not install an empty
  package.
- **Bumping is a two-line change**: the tag in `packages/motion/package.json`
  and a fresh `pnpm install`, which rewrites the lockfile's commit.

## Rejected

- **A tarball in `vendors/`.** It works and needs no build at install, but it
  makes a second copy of a release that already has a canonical address, and
  the tarball's provenance (which commit it was packed from) would live only in
  its file name.
- **Publishing Kinetrell to npm first.** Out of this repo's control and not
  needed to pin it reproducibly.

## The npm admission gate

`tooling/business-studio-npm.mjs --check` audits the Graphite/Reanimated/Worklets
family through the default catalog. Kinetrell is not in its `TARGETS`, and its
peers resolve to the catalog's existing Reanimated 4.7.1, Worklets 0.13.1,
Gesture Handler 3.4.0, GSAP 3.15.0 and Lenis 1.3.26, so no installed copy of a
target changes. The gate's verdict is recorded in the PR that introduced this.

## Cost

A cold install (no pnpm store cache) clones the tag and runs `tsdown` with
Kinetrell's own dev dependencies. Measured locally: the whole workspace install
with the build took 32.8 s against 22–24 s for a warm one.

# web-designer-pro (vendored)

The design process and its render/scan scripts, from the supplied
`web-designer-pro` pack (no public source URL; `SKILL.md` and `references/` are
the binding text). Vendored here so CI can run the scripts against the built
apps and every contributor gets the same version.

SOT-KEYWORDS: web-designer-pro vendor shoot matrix filmstrip fallback design evidence

## What is here

- `SKILL.md`, `references/` (16 files), `assets/kits/` (five kits with their
  shots), `assets/fonts/` (metric-compatible stand-ins, licences in
  `assets/fonts/LICENSES.md` and `LICENSE-selawik.txt`).
- `scripts/`: `shoot.mjs`, `matrix.mjs`, `filmstrip.mjs`, `record.mjs`,
  `fallback.mjs`, `image.mjs`, `cutout.swift`, `doctor.mjs`, `history.mjs`,
  `lib/`. The pack description listed `doctor.mjs`, `matrix.mjs` and
  `history.mjs` as missing; the installed copy has all three, so they are
  vendored as shipped.

## Changes from the pack

1. `package.json` is dropped. The scripts load `playwright-core` from the
   working directory first, and the repo root declares it
   (`playwright-core: catalog:`, the same 1.63.0 that `playwright` installs).
   Run the scripts from the repo root. `doctor.mjs --fix` would install a
   second copy into this folder; it is not needed here.
2. `scripts/shoot.mjs`, keyboard focus walk: the running CSS transitions are
   finished before each focused/unfocused screenshot. The pack disables
   transitions with an unlayered `!important` rule, which loses to utilities
   compiled `!important` inside a cascade layer (Tailwind 4's important mode,
   which Uniwind uses), so a focus ring still fading in read as "no visible
   focus".
3. The pack's own zip is not copied.

## How Moyo runs it

- CI: the `design-evidence` job in `.github/workflows/ci.yml` builds
  `apps/web-vite` and `apps/web`, serves both, runs `shoot.mjs` (390/768/1280/
  1440; `--app` and `--dark` for `apps/web`), `matrix.mjs`, and
  `tooling/check-font-fallbacks.mjs`, and uploads the shots. Any scan FAIL
  fails the job.
- Locally: `node tooling/web-designer-pro/scripts/shoot.mjs http://127.0.0.1:4173/ --out shots/r1 --wait 2500`
  against a running `apps/web-vite` server (see the job for the boot commands).
- Process: `CONTRIBUTING.md` §Design sequence names where this sits among the
  other design steps; `DIRECTION.md` and `CRITIQUE.md` at the repo root are its
  standing outputs.

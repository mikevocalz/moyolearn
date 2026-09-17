# Version lock — what the registry actually says

<!--
What it is: the SDK 58 / WebGPU / on-device-AI version matrix, re-verified against
the npm registry and the installed tree rather than taken from the migration brief.
Why it exists: the brief's numbers are dated 2026-09-17 and it says so itself —
they are the floor of what must be confirmed, not a substitute for confirming it.
Six rows had already moved by the time this was checked.
SOT: pnpm-workspace.yaml (catalog) · pnpm-lock.yaml · the npm registry
SOT-KEYWORDS: versions matrix compute webgpu executorch runntime typegpu skia
              graphite dawn worklets peer parity verification
-->

Verified 2026-09-17 from `npm view` and from this checkout. Every cell is a
command's output, not a claim carried over from the brief.

## The matrix

| Package | Brief says | Registry | Catalog pin | Verdict |
|---|---|---|---|---|
| `expo` | `58.0.0-preview.x` | latest `57.0.23`, **next `58.0.0-preview.3`** | `58.0.0-preview.3` | agrees |
| `react-native` | `0.88.0-rc.x` | next **`0.88.0-rc.1`** | `0.88.0-rc.0` | agrees; rc.1 is out |
| `react-native-worklets` | `0.12.2` | `0.12.2` | `0.12.2` | agrees |
| `react-native-reanimated` | `4.6.0` | `4.6.0` | `4.6.0` | agrees — but see the peer note below |
| `react-native-executorch` | `0.10.x` | **`0.10.2`** | `0.9.3` | **repo is two minors behind a ground-up rewrite** |
| `react-native-webgpu` | `>= 0.10.0` | **`0.10.2`** | **`0.9.0` installed** | **below the m154 floor — see Dawn** |
| `react-native-wgpu` (old name) | renamed | `0.5.17`, stale | absent | rename confirmed |
| `@shopify/react-native-skia` | `@next` `2.12.0-next.1` | **latest `2.12.0`; `next` tag is `2.11.2-next.1`** | `2.12.0` | **brief is stale — Graphite is in stable, and already pinned here** |
| `typegpu` | `0.12.4` | **`0.12.5`** | `0.12.4` installed | **must go to 0.12.5 — `runntime` peers `^0.12.5`** |
| `@typegpu/react` | `0.12.0` | `0.12.0` | absent | agrees |
| `unplugin-typegpu` | `0.12.3` | `0.12.3` | absent | agrees |
| `runntime` | `0.1.0` | `0.1.0` | absent | agrees — the one genuinely new package |
| `three` / `@types/three` | r186 | `0.186.0` / `0.186.0` | `0.185.1` | one release behind |
| `react-native-gesture-handler` | `3.1.0` | **`3.3.0`** | `~3.2.1` | brief's number is two minors stale |
| `@swmansion/argent` | latest | `0.25.1` | — | agrees |

## Six places the brief and the registry disagree

**Skia Graphite is not on `@next` any more.** `@shopify/react-native-skia@2.12.0`
is the latest **stable** release and carries the Graphite fields; the `next`
dist-tag points *backwards* at `2.11.2-next.1`. Following the brief literally —
installing `@next` — would move Graphite backwards a minor. Install `2.12.0`.

**TypeGPU must be `0.12.5`, not `0.12.4`.** `runntime@0.1.0` declares
`peerDependencies: { "typegpu": "^0.12.5" }`. The brief's pin does not satisfy it.

**`runntime` has a second peer the brief never mentions:**
`@huggingface/transformers: "^4.2.0"` — `peerDependenciesMeta` marks it
`optional: true`, so it is not forced weight in the bundle. Worth knowing before
anyone reads the transformers.js backend section and assumes otherwise.

**ExecuTorch has two peers the brief omits.** `react-native-executorch@0.10.2`:

    "react-native-worklets": ">=0.10.0 <0.13.0"      <- brief has this
    "react-native-blob-util": "^0.24.0"              <- brief names it, no range
    "@kesha-antonov/react-native-background-downloader": ">=4.4.0"   <- absent from the brief

`react-native-blob-util`'s latest published version is `0.25.0`, which is
**outside** `^0.24.0`. The top of the satisfying line is `0.24.11`. Pin it there;
`npx expo install` will not.

**Reanimated 4.6.0 does not declare support for RN 0.88.** Its peer is
`react-native: "0.83 - 0.87"`, and this branch runs `0.88.0-rc.0`. The brief
presents 4.6.0 as the SDK 58 pin, which it is — so either the range is stale
against an RC or a newer Reanimated is required before 0.88 goes stable. Do not
resolve this by widening a range locally; it is an upstream question.

**Gesture Handler is at 3.3.0**, not the 3.1.0 the brief names. The catalog's
`~3.2.1` is between them.

## Dawn parity — the pair exists upstream, and is broken here right now

The installed tree does **not** satisfy it:

    $ node -p "require('react-native-webgpu/package.json').dawn"
    chrome-m152

    $ node -p "JSON.stringify(require('@shopify/react-native-skia/package.json').graphiteDependencies)"
    {"react-native-skia-graphite-android":"154.0.0", ...:"154.0.0", ...:"154.0.0"}

**m152 against m154.** Skia was moved to the Graphite-capable 2.12.0 while
`react-native-webgpu` stayed at 0.9.0. The brief describes a build-time guard
that fails on exactly this, which means either no iOS dependency resolution has
run against this tree yet or the guard is not wired — worth knowing before the
next native build, because the failure will look like a build regression rather
than a version skew. The fix is the version bump below, not a guard change.

## The upstream pair that resolves it

    $ npm view react-native-webgpu@0.10.2 dawn
    "chrome-m154"

    $ npm view @shopify/react-native-skia@2.12.0 graphiteDependencies
    { "react-native-skia-graphite-android":    "154.0.0",
      "react-native-skia-graphite-apple-ios":  "154.0.0",
      "react-native-skia-graphite-apple-macos":"154.0.0" }

m154 on both sides, on Skia **stable**. The shared-Dawn precondition is
satisfiable with published versions — no `@next` channel needed.

## The brief's worklets CI check is wrong for this repo

The brief proposes failing CI when the lockfile contains more than one
`react-native-worklets@` string. Run here, that fires:

    react-native-worklets@0.10.2
    react-native-worklets@0.12.2

and it is a false positive. pnpm lockfile keys encode **peer-resolution
contexts**, not installations — `react-native-reanimated@4.6.0(react-native-worklets@0.10.2)`
is a resolution identity, not a second copy. On disk there is exactly one:

    $ find . -name package.json -path '*react-native-worklets/package.json' -not -path '*/.cxx/*'
    0.12.2  ./node_modules/react-native-worklets/package.json

This repo uses the hoisted node-linker, so the check that means what the brief
wants it to mean counts **directories on disk**, not lockfile strings. Two native
worklets runtimes is the real hazard; one copy is installed.

## What the migration actually has to move

Far less is greenfield than the brief implies. Counting import sites rather than
catalog entries, excluding `node_modules`:

| Package | Files importing it |
|---|---:|
| `three` | 55 |
| `three/webgpu` | 31 |
| `@reactvision/react-viro` | 40 |
| `react-native-webgpu` | 19 |
| `@shopify/react-native-skia` | 4 |
| `typegpu` | 1 |
| `runntime` | 0 |

The WebGPU path is not a plan here, it is running code — `react-native-webgpu`
is imported across `packages/app/features/tutor`, `packages/avatar/src/presence`,
`packages/avatar/src/materials`, `packages/ui/xr` and two places in
`apps/mobile`. Treating this as a from-scratch integration would mean rebuilding
something that exists.

Already in place: Expo SDK 58 preview.3, RN 0.88.0-rc.0, Worklets 0.12.2,
Reanimated 4.6.0, Gesture Handler 3.x, Skia 2.12.0 with Graphite.

Version bumps required: `react-native-webgpu` 0.9.0 → 0.10.2 (this is what fixes
the Dawn skew above), `react-native-executorch` 0.9.3 → 0.10.2 (a ground-up
rewrite, not a minor), `typegpu` 0.12.4 → 0.12.5 (`runntime`'s peer), `three`
0.185.1 → 0.186.0.

Genuinely absent: `runntime` alone.

## Re-verification

Re-run before implementation; SDK 58 is mid-beta and `runntime` is days old.

    npm view <pkg> version
    npm view <pkg> dist-tags --json
    npm view <pkg> peerDependencies --json
    npm view react-native-webgpu@<v> dawn
    npm view @shopify/react-native-skia@<v> graphiteDependencies --json

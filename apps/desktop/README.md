# Moyo Learn for macOS

A Legend Spark 0.0.2 app (Expo SDK 55, React Native 0.83.10, react-native-macos
0.83.0). It is not part of the root pnpm workspace and has its own npm lockfile;
see `docs/desktop/adr/0001-spark-isolated-workspace.md` for why.

Requirements: Node 24.19.0 or newer, full Xcode and CocoaPods for native builds.

```sh
cd apps/desktop
npm ci            # runs Spark's postinstall; do not pass --ignore-scripts
npm run macos     # Spark Runner with Fast Refresh
npm run typecheck
npm run doctor    # dependency pins and native toolchain
npm run analyze   # production native module selection
npm run build     # standalone .app
```

Never run `pnpm install` in this directory and never add it back to the root
`pnpm-workspace.yaml`. Upgrade Spark with `npx --no-install spark upgrade --dry-run`
first, then `npx --no-install spark upgrade`.

Shared code: only `packages/theme/tokens.ts`, by relative import. Every
external symbol the app uses is listed in `docs/desktop/seams/SEAMS.md`.

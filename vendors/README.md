# vendors/

Tarballs that cannot come from a registry. Committed on purpose — the `file:`
protocol pins a path, so CI and every collaborator must resolve the same
artefact (redraw.dev/docs/installation).

## Redraw (the animated splash)

`redraw` and `react-native-redraw` are a technical preview distributed as
`.tgz` files through GitHub Releases to wcandillon.dev subscribers. There is no
public npm package — `react-native-redraw@0.0.1` on the registry is a name
placeholder whose tarball contains a `package.json` and nothing else, and
installing it gets you no library.

Everything the splash needs is already wired:

- `react-native-webgpu` 0.9.0 — the peer dependency (≥ 0.5.11), registered as a
  config plugin in `apps/mobile/app.config.ts` with the API 26 floor Dawn needs
- `unplugin-typegpu` + the `unplugin-typegpu/babel` plugin in
  `apps/mobile/babel.config.js` — without it the `"use gpu"` stroke body ships
  as plain JS and the ink head draws nothing
- the scene itself, authored against Redraw, at
  `apps/mobile/components/splash/redraw/`

TO FINISH IT, drop both tarballs here and run one command:

```
cp ~/Downloads/redraw-<ver>.tgz ~/Downloads/react-native-redraw-<ver>.tgz vendors/
pnpm add -w "redraw@file:./vendors/redraw-<ver>.tgz" \
             "react-native-redraw@file:./vendors/react-native-redraw-<ver>.tgz"
```

Then swap the one import in `apps/mobile/components/splash/MoyoSplash.tsx`
(marked `REDRAW HAND-OFF`) and rebuild — the native side is already in the
binary, so it is a JS-only change from there.

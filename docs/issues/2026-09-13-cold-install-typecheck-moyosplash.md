# `pnpm typecheck` fails on a cold clone: 10 errors in `MoyoSplash.tsx`

<!--
What it is: ten TS2322 errors that appear only on a fresh clone plus
`pnpm install --frozen-lockfile`, and the gitignored file whose absence causes
them.
Why it exists: found while verifying `feat/spatial-whiteboard-xr`. It is not
that branch's — it reproduces on a clean checkout of any commit — and it means
CI, a new contributor and any container build see a red typecheck that nobody
working in the repo can see.
SOT: apps/mobile/expo-env.d.ts · apps/mobile/tsconfig.json ·
     apps/mobile/components/splash/MoyoSplash.tsx
SOT-KEYWORDS: issue typecheck cold install expo-env.d.ts gitignore reanimated
              animationName TS2322 ci reproducibility
-->

Filed: 2026-09-13 · Found on: `feat/spatial-whiteboard-xr` @ `6e5707b` ·
Status: **fixed 2026-09-17** on `upgrade/expo-sdk-58-beta`, option 3

## Resolution (2026-09-17)

Option 3, the one this file called probably right: `apps/mobile/expo-types.d.ts`
is committed, carries `/// <reference types="expo/types" />` and a note saying
why it duplicates the generated file. It is picked up by the existing
`**/*.ts` include, so `tsconfig.json` did not change and `expo-env.d.ts` stays
generated and ignored.

Verified by removing the generated file rather than by a cold clone, which
isolates the same condition:

```
$ mv apps/mobile/expo-env.d.ts /tmp/ && cd apps/mobile && tsc --noEmit
TSC WITHOUT expo-env.d.ts: 0
```

and the negative control, with `expo-types.d.ts` moved away as well:

```
components/splash/MoyoSplash.tsx(366,59): error TS2769: No overload matches this call.
    Type '{ animationName: object; … }' is not assignable to type …
```

Same file, same call sites, the TS2769 form of the TS2322 above. So the new file
is what carries the typecheck, not a leftover artefact.

Not verified: the full cold-clone reproduction from this issue's acceptance test
(`pnpm install --frozen-lockfile && pnpm typecheck` in a fresh clone), and the
missing `.expo/types/router.d.ts` noted below, which is untouched.

## Symptom

`pnpm typecheck` is green in a working checkout and red in a fresh one. Same
commit, same lockfile, same `node_modules` contents.

## Reproduction

```
$ git clone --branch feat/spatial-whiteboard-xr /Users/mikevocalz/MoyoLearn "$TMP/cold"
$ cd "$TMP/cold"
$ git log --oneline -1
6e5707b fix(xr): draw from onDrag, and make the rail's keys visible

$ pnpm install --frozen-lockfile; echo "INSTALL_EXIT=$?"
Done in 49s using pnpm v10.32.1
INSTALL_EXIT=0

$ pnpm typecheck; echo "TYPECHECK_EXIT=$?"
```

```
mobile:typecheck: components/splash/MoyoSplash.tsx(365,59): error TS2322: Type '{ animationName: object; animationDuration: number; animationDelay: number; animationTimingFunction: "ease-out"; animationFillMode: "both"; } | undefined' is not assignable to type 'false | "" | (StyleWithPseudoValues<Omit<ViewStyle, "animationName" | "transitionProperty" | "transition" | keyof SingleCSSAnimationSettings | keyof SingleCSSTransitionSettings | keyof CSSTransitionCallbacks>> & Partial<...>) | ... 10 more ... | undefined'.
mobile:typecheck: components/splash/MoyoSplash.tsx(368,57): error TS2322: …
mobile:typecheck: components/splash/MoyoSplash.tsx(388,13): error TS2322: …
mobile:typecheck: components/splash/MoyoSplash.tsx(394,57): error TS2322: …
mobile:typecheck: components/splash/MoyoSplash.tsx(400,44): error TS2322: …
mobile:typecheck: components/splash/MoyoSplash.tsx(413,15): error TS2322: …
mobile:typecheck: components/splash/MoyoSplash.tsx(449,15): error TS2322: …
mobile:typecheck: components/splash/MoyoSplash.tsx(459,44): error TS2322: …
mobile:typecheck: components/splash/MoyoSplash.tsx(475,13): error TS2322: …
mobile:typecheck: components/splash/MoyoSplash.tsx(497,11): error TS2322: … (TextStyle variant)

 Tasks:    17 successful, 19 total
Failed:    mobile#typecheck
TYPECHECK_EXIT=2
```

Ten errors, all `TS2322`, all on a `style={[…, anim(…)]}` on an `Animated.View`
(nine) or `Animated.Text` (one, at 497).

The same command in the working checkout:

```
$ cd /Users/mikevocalz/MoyoLearn && pnpm turbo typecheck --force; echo "EXIT=$?"
 Tasks:    19 successful, 19 total
 Time:     19.105s
EXIT=0
```

## Root cause

**`apps/mobile/expo-env.d.ts` is gitignored and generated, and `tsconfig.json`
requires it.**

```
$ cat apps/mobile/expo-env.d.ts
/// <reference types="expo/types" />

// NOTE: This file should not be edited and should be in your git ignore
```

```jsonc
// apps/mobile/tsconfig.json
"include": [
  "**/*.ts",
  "**/*.tsx",
  ".expo/types/**/*.ts",
  "expo-env.d.ts",        // ← named explicitly
  "babel.config.js",
  "uniwind-types.d.ts",
  "css.d.ts"
]
```

That one `/// <reference types="expo/types" />` is what pulls in the ambient
declarations that make a CSS-animation object assignable to a Reanimated
`style` prop. Without it, `anim()`'s return type has nowhere to land and every
call site fails.

`pnpm install` does not create it. It is produced by the Expo CLI — `expo start`,
`expo prebuild`, `npx expo customize tsconfig.json` — none of which runs in a
`pnpm install --frozen-lockfile && pnpm typecheck` sequence. A developer who has
ever run the app has the file and cannot see the failure.

### Confirmation

Copying the file from the working checkout into the cold one, changing nothing
else, turns the mobile typecheck green:

```
$ cp /Users/mikevocalz/MoyoLearn/apps/mobile/expo-env.d.ts "$TMP/cold/apps/mobile/"
$ cd "$TMP/cold/apps/mobile" && ../../node_modules/.bin/tsc --noEmit; echo "TSC_EXIT=$?"
TSC_EXIT=0
```

The dependency trees are otherwise the same. `react-native-reanimated` 4.5.1,
`react-native-css` 3.0.7 and `uniwind` 1.11.0 resolve identically in both, and a
recursive diff of `node_modules/react-native-reanimated/lib/typescript` reports
no differences.

The cold tree is also missing `.expo/types/router.d.ts`, which `tsconfig.json`
includes as well. It is not implicated in these ten errors — the `expo-env.d.ts`
copy alone was enough — but it is the same class of problem and would bite the
first typed route reference.

## Why it is out of scope for `feat/spatial-whiteboard-xr`

`apps/mobile/components/splash/` is not in that branch's diff. The branch adds
`apps/mobile/app/(learner)/tutor-xr.tsx` and one dependency line to
`apps/mobile/package.json`; it does not touch the splash, Reanimated, the type
config or the tsconfig. The failure reproduces on any commit cloned cold,
including `main`.

## What a fix looks like

The choice is about who is responsible for the generated file, and the third
option is probably the right one:

1. **Generate it in the typecheck task.** A `pretypecheck` that runs
   `npx expo customize tsconfig.json` (or `expo prebuild --no-install` on
   mobile) is the officially-sanctioned route and adds Expo CLI startup time to
   every run.
2. **Commit `expo-env.d.ts`.** Two lines, stable across SDK minors, and it makes
   a cold clone typecheck. It contradicts the note inside the file and Expo's own
   template gitignore, which is a real cost but a small one.
3. **Stop depending on it.** Move `/// <reference types="expo/types" />` into a
   file the repo does own — `apps/mobile/css.d.ts` and `uniwind-types.d.ts` are
   both already committed and already in `include`. Then `expo-env.d.ts` can stay
   generated and ignored, and its absence stops mattering.

Whichever is chosen, the acceptance test is this issue's reproduction: clone
cold, `pnpm install --frozen-lockfile && pnpm typecheck`, green.

## Environment

```
node   v26.8.1   (engines.node is ">=24.15.0 <26")
pnpm   10.32.1
turbo  2.10.11
tsc    from catalog typescript ~6.0.3
```

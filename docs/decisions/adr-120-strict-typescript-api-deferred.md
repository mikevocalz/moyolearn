# ADR-120: the Strict TypeScript API stays opt-out, blocked on Reanimated

Status: deferred with evidence. `react-native-legacy-deep-imports` stays in
`apps/mobile/tsconfig.json`.
Date: 2026-09-17

## Context

React Native's Strict TypeScript API is the default from 0.87, and this repo is now on
0.88.0-rc.0. `react-native-legacy-deep-imports` is the temporary opt-out and Expo's SDK 58
notes say it is removed after 0.88, so shipping on it is borrowed time. The
`migrate-to-strict-api` skill (react-native-community, v0.1.0, installed this session) step 3
is unambiguous for our version: remove that condition, keep `"react-native"`.

## What happened when we did

Removing the entry left **10 type errors**, in two groups.

**Nine in `apps/mobile/components/splash/MoyoSplash.tsx`.** The splash builds a Reanimated
CSS animation as a plain object — `animationName`, `animationDuration`, `animationDelay`,
`animationTimingFunction`, `animationFillMode` — and spreads it into `Animated.View`'s
`style`. Under the strict types, `Animated.View`'s overloads resolve against RN's own
`ViewStyle`, which has none of those keys.

Typing it from the library did not help, and that is the finding. Reanimated 4.6.0 exports
`CSSAnimationProperties` for exactly this shape (`react-native-reanimated/lib/typescript/css/
index.d.ts` re-exports it, reached through `export * from './css'`). Annotating the helper as
`CSSAnimationProperties | undefined` produced the same rejection:

```
Type 'CSSAnimationProperties' is not assignable to type
  'false | void | "" | Readonly<Partial<Readonly<Omit<Readonly<Omit<Readonly<{ display?: ...
```

So the library's own public type for its own feature is not assignable to the style prop of
its own component once RN's strict types are in play. That is a gap in Reanimated, not
something a call site can annotate around, and the skill's step 2 is explicit that a
library-level incompatibility is fixed by updating the library — 4.6.0 is the version SDK 58
states, and it is current.

**One in `packages/ui/xr/BoardTextureHost.native.tsx`**: `StyleProp<ViewStyle>` is not
assignable to `____ViewStyleProp_Internal`, the legacy internal style type. A mixed graph —
part strict, part legacy — which is what that error means, and which resolves once the
blocker above is gone.

## Decision

Keep the opt-out. Do not disable checks, do not cast, do not annotate around a library gap
with `any` — all three would hide the same fact in a place nobody will look again.

Two genuine Strict API fixes found by the SDK 58 move are already landed and are not affected
by this deferral, because they are ref types rather than style types:

- `packages/ui/Menu.native.tsx` — `useRef<ViewInstance>` instead of `useRef<RNView>`, which
  restored `measureInWindow` and the four callback parameter types.
- `packages/ui/whiteboard-board.native.tsx` — `useRef<ComponentRef<typeof WebView>>`, after
  react-native-webview 14 made its export a function component.

## When this reverses

When Reanimated's CSS animation properties are assignable to its own `Animated.View` style
prop under the strict types. The check is one command: remove the condition from
`apps/mobile/tsconfig.json` and run `pnpm typecheck`. Green means take it.

This is time-boxed by someone else's calendar: the opt-out disappears after 0.88, so if
Reanimated has not closed the gap by the time SDK 58 goes stable, the choice narrows to
patching Reanimated's types locally or carrying the splash animation differently.

## What this does not say

It does not say the repo has deep imports. `pnpm typecheck` is green on 19/19 workspaces with
the condition in place, and the only two strict-API defects found so far were fixed rather
than suppressed.

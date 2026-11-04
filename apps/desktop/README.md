# Moyo Learn Desktop — Legend Spark preview

This is a **native macOS preview**, not a production release or a wrapper
around the Next.js site. The host uses React Native + Hermes through
[Legend Spark](https://github.com/LegendApp/legend-spark). The preview reuses
Moyo's **existing semantic color tokens** and **real shipped brand assets**
without introducing a second UI design system.

## Runtime boundary

| Target | SDK | React Native | Status |
| --- | --- | --- | --- |
| Existing Moyo iOS/Android/XR | Expo 58 | RN 0.88 | Unchanged |
| This Spark macOS preview | Expo 55 | RN 0.83 | Source scaffold only; native build unverified |
| Windows desktop | — | — | Not enabled / requires upstream native validation |

The desktop app has its own nested pnpm workspace. It is excluded from the
root workspace because root-wide overrides pin RN 0.88, Nitro v1, and Expo 58;
allowing those overrides into Spark's tested matrix would silently mix binary
ABIs. Do **not** run `spark add desktop` against `apps/mobile`: its
integration guide currently rejects Moyo's RN/Expo versions, and mobile
uses Expo Router with platform-specific native modules that have not been
audited for desktop.

The preview doesn't import `@acme/app`, `@acme/ui` or Better Auth yet:
those imports can transitively pull mobile-only Vision Camera, Expo Router,
Viro, MMKV, Worklets, SwiftPM and Nitro packages. Reuse these packages
progressively behind verified platform adapters, never via a second copy
of React Native in the same desktop process.

## Try on an Apple Silicon Mac (macOS 14+)

Use full Xcode, CocoaPods, Node 24.19+ and pnpm 10.32.1.

```sh
cd apps/desktop
corepack enable
corepack pnpm install --no-frozen-lockfile
corepack pnpm doctor
corepack pnpm macos
```

Run tests without native dependencies using `node --test tests/*.test.mjs`.
The local nested lockfile must be generated, inspected and committed once the
published Spark preview and native build both pass on an Apple Silicon Mac.
The root `pnpm-lock.yaml` and app's Expo 58 catalog must stay unchanged.

## What works at source level

- Window-resize-aware native React Native navigation (sidebar, compact header).
- Native Spark File/View menu registration and command handlers.
- Native OS file chooser showing only the selected file **name**; no file
  contents are read, cached, uploaded or parsed.
- Temporary, **in-memory** lesson scratchpad with a Clear action, Zustand state.
- Existing Moyo color semantics and actual mobile logo assets reused.

## Explicitly not implemented

- Better Auth desktop session, token protection, organization/role guards,
  guardian policy enforcement, school/district/learner data.
- AI tutoring, video, audio, homework OCR, live whiteboards, Viro/XR, Rive,
  device microphone or camera, offline student caches and file import.
- Signed/notarized distribution, auto-update, sandbox entitlements, Intel Mac
  or Windows native validation. The preview does **not** promise these features.

The unauthenticated shell uses informational cards, not fake enabled buttons.

## Nitro v1 / nitro-node integration gate

`shirakaba/nitro-node` is a valuable proof: its Expo Desktop demo uses
Expo 55 / RN macOS 0.83 with Hermes and JSI backported from RN 0.88, and
the exact Nitro nightly already used by Moyo's root workspace. It separately
hosts Nitro in Node V8 via Microsoft's node-api-jsi.

It **does not** embed Node.js or Node builtin APIs in Legend Spark. Do not
add its Node native addon to the desktop JS bundle or force Nitro v1 through
Spark's pinned Nitro 0.37 adapter. `src/nitro-readiness.ts` fails closed
until Moyo has an independently built, auditable native adapter.

Before enabling: reproduce the upstream patched-Hermes fixture, verify one
Hermes/JSI/Nitro ABI in the *desktop* build, implement disposal and async
dispatcher, test memory/Worker ownership, audit school data isolation, then
run Debug + Release builds with codesigning and notarization. Maintain
Expo Modules v2 only on the compatible Expo 58 mobile target.

## Acceptance gates

1. Confirm Spark version and install the nested graph without root overrides.
2. Native Debug build and interactive launch on macOS Apple Silicon.
3. Test resize below/above 850 logical points, large text, VoiceOver,
   keyboard, native menus, OS chooser cancellation and reduced motion.
4. Verify no learner identifiers or lesson contents leave the preview.
5. Add authenticated native routes one by one, backed by server entitlements.
6. Prove student/tutor real-time voice, video, whiteboard and OCR adapters
   separately before representing the desktop app as product-complete.
7. Only then sign, notarize and distribute. Windows is tracked separately.

The existing Moyo foldable policy remains intact; this desktop-only pane
threshold never replaces Surface Duo hardware-aware navigation.

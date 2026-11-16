# Hosted native runtime checks

The dependency-admission gate in [npm-policy.md](./npm-policy.md) requires iPad and Android native builds and device checks. The native workflows now execute the already-existing `moyo://native-3d-smoke` screen after compilation. A successful build alone does not satisfy these runtime steps.

## What executes

| Lane | Built artifact and target | Runtime assertions |
| --- | --- | --- |
| iOS `simulator` | The existing arm64 SwiftPM Debug app, installed on an actual available iPad simulator from the runner's inventory | Adapter response; native triangle submission/presentation; cube initialization and positive measured FPS; background an active renderer, return, stop it and obtain fresh FPS from a new renderer; cold app relaunch and fresh FPS |
| Android `mobile-runtime` | The existing `mobileDebug` flavor, built for x86_64 and installed on an API 35 emulator with SwiftShader | The same interaction and renderer-lifecycle assertions |
| Android `quest` | Existing arm64 `questDebug` assembly and generated Ninja-pool verification | Unchanged build gate; the new mobile emulator does not stand in for a Quest headset |

The flow uses actual taps on the existing semantic `Triangle`, `Cube` and `Stop` controls. It checks that stopping removes the FPS label before requesting a new renderer, so a stale positive label cannot satisfy the post-resume assertion. It does not change the app's rendering, routing or dependencies to make the checks pass. A missing adapter, native crash, bundle failure, missing frame output, unsupported flow command, failed assertion or missing evidence fails the job; there is no test retry or success fallback.

The runner refuses physical Android targets and non-iPad Apple targets. Only isolated GitHub Actions runners can invoke it, because the flow clears that temporary app's state and grants its declared OS permissions. It starts Metro with production URL overrides and telemetry disabled. The local API returns `null` for the anonymous-session lookup and HTTP 503 for every other operation. No user, student, subscription, payment, school or production fixture is created; the application's demo-auth mode is not used.

Metro stays bound to localhost. Its subprocess uses IPv4-first DNS resolution so Expo's listener matches the IPv4 readiness URL and Android reverse bridge, while preserving inherited Node options. A contract starts an actual localhost HTTP listener in a child process and reaches it through `127.0.0.1`; this verifies the bridge assumption without claiming a device pass.

The Android app's PICO Platform Service dependencies and version constraints are scoped to the Pico flavor by the existing config-plugin repair. The upstream global declarations otherwise import a PICO service requiring API 28 into the API 26 mobile build. Phone and Quest builds do not need those PICO services; their SDK floors remain unchanged. The checked-in Gradle output and fresh prebuild use the same idempotent transform, which rejects changed ownership markers or unknown declaration forms.

The PICO native module receives the app's `reactNativeArchitectures` property through an explicitly rooted Gradle settings callback. The previous callback's unqualified property lookup read the Settings script and fell back to ARM even for the x86_64 emulator build. Both Android lanes execute a real Gradle regression covering the old failure, x86_64, the default and explicit arm64 requests, and a multi-ABI request using the installed PICO lookup. Expo regeneration preserves the repaired callback, and the headset flavor ABI filters remain unchanged.

## Evidence and its limits

Each execution uploads `receipt.json`, JUnit, the full tool/Metro logs, per-attempt diagnostics, and five named screenshots: adapter, triangle, cube, resumed cube and cold-launch cube. The receipt records the actual checked-out Git SHA (including a PR merge commit when applicable), PR head, workflow run, pnpm-lock and flow digests, built binary digest, bundled JavaScript digest, exact virtual device and tool pin. It is written as `passed` only after the device test exits successfully, JUnit contains executed passing cases with no skipped/failed cases, and all five PNGs exist. An existing artifact directory is refused to prevent a stale report satisfying another execution.

These are **simulator and emulator** checks. Android explicitly uses a software GPU; the adapter screenshot retains any `SOFTWARE FALLBACK` label. Positive FPS demonstrates an executing native frame loop, not acceptable hardware performance or final pixel correctness. Review the retained triangle/cube screenshots before claiming visual success. These checks do not establish physical touch latency, pen/hinge/Quest behavior, thermal limits, background performance budgets, or the complete adaptive-layout acceptance matrix. The iOS lane retains its existing SwiftPM/Ganesh build and does not establish CocoaPods/Graphite or visionOS runtime acceptance. All other repository gates remain required.

No hosted-runtime success is asserted by this documentation change. Link the completed final-head workflow run and inspect its actual artifacts before treating the runtime gate as complete.

## Tool provenance

`agent-device@0.21.37` is downloaded from its exact npm tarball URL and verified against the published SHA-512 integrity before extraction. Its exact bundled `help install`, `help maestro` and `help test` contracts were inspected while authoring the flow. It is temporary CI tooling, not an added mobile runtime dependency. See the upstream [agent-device skill](https://github.com/callstack/agent-device/blob/main/skills/agent-device/SKILL.md) and [Maestro compatibility documentation](https://github.com/callstack/agent-device/blob/main/website/docs/docs/run-maestro-flows.md).

New workflow actions use verified official commits: [Android emulator runner v2](https://github.com/ReactiveCircus/android-emulator-runner/commit/a421e43855164a8197daf9d8d40fe71c6996bb0d), [pnpm setup v4](https://github.com/pnpm/action-setup/commit/b906affcce14559ad1aafd4ab0e942779e9f58b1), and [Java setup v4](https://github.com/actions/setup-java/commit/cf277c60eb25467037889841efdb72551f06f6c3). The existing reviewed checkout, Node and artifact-upload pins are reused. Android's KVM and software-renderer configuration follows the emulator action's supported inputs.

Run the focused contracts after the frozen workspace install:

```sh
node --test tooling/native-runtime-smoke.test.mjs
node --test apps/mobile/plugins/__tests__/pico-*.test.cjs
node --test tooling/pico-native-architectures.test.mjs
```

Those contracts check target selection, evidence rejection, local anonymous API boundaries, tool integrity and preservation of the native workflow gates. They do not represent a launched app or a device pass.

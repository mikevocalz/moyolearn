# Remote branch cleanup proposal

Read from `origin` on 2026-11-25 with `git branch -r --merged origin/main` and `--no-merged`. 103 remote branches excluding `HEAD`. Nothing has been deleted; every deletion needs Mike's approval.

## Contained in `main` (56), proposed for deletion

`main` and `release/meta-vr-start-2026` are in this set and stay; the release branch is retired separately once PR #157 lands.

chore/business-studio-latest-npm, chore/device-validation-one-tile, chore/device-validation-probes, chore/device-validation-spatial-layout, chore/foldable-screen-skills-20261011, chore/nitro-v1, chore/nitro-v1-ios-spm, chore/nitro-v1-visionos, claude/bug-hunting-fixes-85ahpk, claude/gifted-ptolemy-r9kv7p, codex/controller-ink-continuity, codex/elevenlabs-v4, codex/muse-board-input, codex/native-ink-package, codex/xr-polish, design/reset-v2, docs/noto-business-lifecycle, docs/noto-payload-crm-integration, docs/noto-schedule-integration, experiment/pgboss-converge, feat/a2f-host-code, feat/business-creative-studio, feat/business-photocraft-engine-admission, feat/homework-intelligence, feat/natalie-human, feat/qdk-chemistry-lab, feat/spatial-whiteboard-xr, fix/auth-native-origin, fix/beta-headtracking-and-ward-paging, fix/business-studio-semantic-gestures, fix/ci-root-route-expectation, fix/detect-unapplied-migrations, fix/ios-spm-native-links, fix/ios-spm-new-arch-defines, fix/iphone-duo-safe-header, fix/jobs-drain-on-deployed, fix/jobs-drain-retention, fix/login-natalie-on-deployed, fix/login-verification-on-main, fix/natalie-conversational-presence, fix/natalie-tutor-realism, fix/proxy-fails-closed, fix/skia-graphite-macos-package, fix/tutor-room-plate-a11y, fix/wire-password-reset, natalie-web-stage, ops-dashboard, overhaul/phase1-audit, perf/tracesift-profiling, shipaton-capture-crop, shipaton-coaching-turn, tutor-presence-phase1, upgrade/expo-sdk-58-beta, web-vite-photo-swap.

## Squash-merged through a PR (12), content already on `main`

Their PRs are merged but the branches are not ancestors of `main`, so `--merged` cannot see them. Proposed for deletion after a glance at each PR.

docs/pr-dispositions-2026-11-04 (#139), docs/skia-v3-defer-2026-11-04 (#142), feat/homework-end-to-end-20261104 (#141), feat/desktop-01-spark-bootstrap (#143), feat/motion-01-kinetrell (#144), chore/skills-web-designer-pro (#145), feat/motion-03-signatures (#146), feat/desktop-02-native-shell (#147), feat/desktop-03-nitro-adapter (#148), feat/desktop-04-auth-session (#149), feat/desktop-05-learning-surfaces (#150), feat/desktop-06-release-pipeline (#151).

## Holding v1 work, keep until PR #157 and its stacked branches land

codex/homework-prior-work-data-20261114, codex/homework-prior-work-ui-20261114, codex/hands-integration-20261114, release/moyo-billing-schema-20261116, codex/signaliq-marketing-consent (#152), chore/finish-open-pr-ci-20261114 (#156), integrate/v1-main-20261125, fix/front-door-release-20261125, fix/safety-and-media-20261125, fix/prices-and-entitlements-20261125, chore/npm-latest-20261125.

## Not merged and not v1 (29), Mike decides

chore/sdk58-preview7, codex/moyo-billing-schema-20261116-2147, codex/moyo-stripe-setup, codex/sdk58-preview7-current-main, codex/visionos-native-validation, codex/voice-v4-readiness, dev, feat/android-foldable-windowmanager-v2, feat/forge-board-single-document, feat/homework-end-to-end-blockers-20261015, feat/homework-worksheet-question-flow-20261015, feat/moyo-legend-spark-desktop-preview (#137 closed), feat/specs-moyo-platform-lab, feat/specs-tutor-room-authoring, feat/specs-tutor-room-proof, feat/tutor-native-quickdraw-panel, finish/pr-completion-20261016, fix/fold-row-local-coordinates, fix/login-verification-natalie-voice, release/moyo-signaliq-20261114, test/android-foldable-rail-coverage, upgrade/expo-sdk-58-preview5, upgrade/npm-latest-skia-v3-2026-11-02, upgrade/sdk58-dedup-onto-beta, upgrade/viro-3.0.2-upstream-next, upgrade/viro-3.0.2-upstream-parity, wip/MoyoLearn-local-before-pull-20261102-2026-11-04, wip/forge-pen-diagnostics-2026-11-04, wip/spatial-layout-snapshot-2026-10-14.

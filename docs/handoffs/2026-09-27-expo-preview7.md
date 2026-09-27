# Expo preview.7 reconciliation

Based on main after controller fix #76. Registry `expo@next` was
58.0.0-preview.7 on September 27, 2026. Versions come from that published
package's bundledNativeModules.json, not an arbitrary latest-package sweep.

Preserves React/React DOM/RSC 19.3.0, RN 0.88.0-rc.2, the visionOS fork alias,
Viro 3.0.1-moyo.1 plus its patch, and the Rive vendor. Expo's manifest recommends
RN rc.1; main's deliberate rc.2 is retained and requires native validation.

Updates the Expo satellites, Reanimated 4.7, Worklets 0.13 and Screens 4.28.
Direct asset/filesystem/background-task/task-manager declarations now match.
Adds expo-constants directly to mobile for Router's required native peer.
Overrides prevent optional peers from pulling a second Expo/Router/Worklets
runtime. The frozen lockfile no longer contains Expo 57 or Worklets 0.10.

The old Router 57.0.15 mount-race patch is no longer registered. Inspection of
58.0.8's NavigationContainer and useLinking confirms the old
setLastUnhandledLink callback path has been removed; applying that old patch to
58 would target a removed API. Physical cold-boot deep-link behavior remains a
device acceptance gate, not a conclusion from source inspection.

This supersedes the version-bump portion of #71. It does not automatically
supersede every change in #67: that PR also carries auth/toolchain pins, docs,
declarations and hook fixes that need separate current-main reconciliation.
Do not import its old override block wholesale or suppress native peer warnings
as a substitute for compilation.

The Expo Modules visionOS platform port remains separate. A newer v2 runtime
does not itself establish xros support. Native CocoaPods/Gradle builds and
Quest/Pico/Apple runtime verification are required before release acceptance.

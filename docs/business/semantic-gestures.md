# Campaign Studio: semantic UI and current gestures

Stack: #92 Campaign Studio -> #93 latest-npm admission -> this change. Uses the registry-resolved catalog and lockfile from #93. Never restore its old Reanimated/Skia pins to make this build. No new npm dependency is introduced.

## Implemented scope

The current web Campaign Studio now uses `EmailReorderGroup` and hook-based `usePanGesture` handles instead of HTML drag/drop. Wrappers, labels, fields and controls compose Moyo's existing `Section`, `View`, `Text`, `Button` and form primitives. The only low-level HTML element is the opaque iframe in `packages/ui/html/email-document.web.tsx`: it displays the serialized email, not application chrome. Download side effects and read-only browser measurement are isolated in that same explicit platform primitive. This is a web/Safari interaction implementation; no native PhotoCraft or Pencil parity claim.

Dedicated handles use `touchAction="none"`; text editing and scrolling over the actual fields remain outside the recognizer. Gesture activation/deactivation/finalization use the current hook API and `event.canceled`. No legacy builder relations, deprecated runtime helpers, React useState or alternate animation library is added. Reanimated shared-value `get()`/`set()` drives transient translation; `scheduleOnRN` crosses at semantic gesture boundaries. There is no per-frame document or Zustand write. Settling is immediate, so reduced-motion users get the same working interaction without decorative motion. Kinetrell remains the only permitted new high-level animation owner.

Each editor gets an isolated DOM measurement scope. Variable-height rows use actual static-shell rectangles, not a guessed fixed row height or a pointer's transformed local coordinate. Release resolves first, intermediate and final insertion positions. A successful changed drop produces one document-history entry; no-op/outside/canceled drops produce none. Gesture state is consumed before commit, so a repeated callback cannot double-apply it.

Revision changes, restore, undo/redo, save-disable, unmount, blur, Escape, visibility, scrolling and resize invalidate a pending gesture. A second pointer taints it. A late callback from another handle cannot consume the active transaction. The measurement snapshot must match again at release; font reflow, missing/zero-sized rows, duplicate IDs and moved targets fail closed.

Existing Move up/Move down controls remain first-class keyboard, screen-reader and touch alternatives. Drag success announces its new position through the existing semantic live region. No control is hidden behind a gesture-only interaction.

The generated newsletter retains real HTML text, links, image alternatives and its immutable sender/unsubscribe footer. Preview remains an opaque sandbox with scripts/forms/same-origin/popups disabled, no referrer, and remote images blocked until explicitly enabled. The preview policy accepts the serializer's actual lowercase doctype. It is not an arbitrary-HTML sanitizer or an email-client compatibility test.

## Tests and merge gates

Local: 25 geometry/transaction/document-policy tests and 11 source-guard tests. Node 22.16.0 with type stripping is not the repository's required Node runtime. These tests do not simulate Gesture Handler or prove browser/native rendering. The workflow reruns them, the existing campaign contracts and live latest-npm check on the repo Node version.

Blocking: cold-cache semantic TSX typecheck/lint/build, actual browser drag/keyboard/touch/trackpad/resize/blur checks, screen-reader announcements, text-selection preservation, and native-build regressions. The standalone document primitive must be reviewed separately from the composite source guard. There is no auto-scroll during drag: scrolling cancels safely; use keyboard moves for an off-screen destination.

PhotoCraft native work remains a separate bridge/render/input track. Never embed the desktop egui application or a hidden WebView and call it a native iPad implementation. Pencil capabilities, native canvas pan/pinch/rotation, GPU parity and hinge-safe panes require their own validation.

## References and ownership

Use repository CONTRIBUTING, current React best-practices, Software Mansion's Gesture Handler 3 migration guide and Worklets scheduleOnRN documentation. Relevant API sources:
- https://docs.swmansion.com/react-native-gesture-handler/docs/gestures/use-pan-gesture/
- https://docs.swmansion.com/react-native-gesture-handler/docs/core-components/gesture-detectors/
- https://docs.swmansion.com/react-native-worklets/docs/threading/scheduleOnRN/

Required project skills/tooling references remain expo/skills, mattpocock/skills, Argent/agent-device, coreyhaines31/marketingskills, pbakaus/impeccable, petergyang/no-ai-slop and the tailored mikevocalz-foldable-layouts policy in PR #91. Native physical-right rails and web navigation are different contracts; do not impose a native rail on the web shell. Ownership: UI/accessibility, gestures/runtime, email security, QA/browser and native compatibility. A named skill is not a claimed executed device test.

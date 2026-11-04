# Moyo Learn native desktop implementation rules

1. Read the repository root `AGENTS.md` first. Respect its pinned
   `mikevocalz-foldable-layouts` skill for any shared/resizable pane work,
   along with `expo/skills` (`expo-overview`, `expo-native-ui`,
   `expo-design-system`) and the installed Legend Spark SDK skill.
2. The nested `apps/desktop/pnpm-workspace.yaml` is a **compatibility
   boundary**, not a convenience. Never delete the root exclusion or apply
   the root pnpm overrides to this Spark preview. No direct SDK 58 downgrade.
3. Keep the original Moyo semantic palette and branded assets. Use native
   React Native views / Legend Spark APIs. Never substitute Electron,
   a WebView editor, an HTML clone, or a second invented design system.
4. No `useState` for application state. Use the app's Zustand store,
   stable refs for native resources, and unique menu/window owner IDs.
5. Native operations must be capability-checked and disposed on unmount.
   Test window resize, keyboard and screen reader, reduced motion and menu
   focus. Do not claim Windows or Intel Mac support from a JavaScript bundle.
6. Do not import `nitro-node`'s Node V8 host into Hermes or install a
   second Nitro proxy. It is a compatibility reference until a compiled
   native adapter validates Nitro v1, Hermes/JSI ABI, lifetime and async work.
7. Sign-in, guardian permissions, student records, school membership,
   offline student data and server requests remain unavailable in preview.
   Add them behind the shared existing server-enforced Better Auth checks,
   not a local mock identity or unguarded API path.
8. Never report a production-ready native Mac app without a successful
   signed Release build, notarization and runtime test on Apple Silicon.
   Treat source/CI-only checks as source/CI-only.

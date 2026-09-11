# Patches

## `@seshuk/payload-storage-bunny@3.0.0`

**Why:** the adapter targets Payload 3 and imports `initClientUploads` from
`@payloadcms/plugin-cloud-storage/utilities`. Payload 4 removed that export —
verified absent from both `@payloadcms/plugin-cloud-storage@4.x` and `payload@4.x`
core. It is the ONLY symbol the adapter imports that no longer exists; every
other one (`cloudStoragePlugin`, `createClientUploadHandler`, `sanitizePrefix`,
`getFileKey`, `getFilePrefix`) is still there.

**What the patch does:** vendors `initClientUploads` verbatim from
`@payloadcms/plugin-cloud-storage@3.88.0` into the adapter's entry file and drops
the import. The function only mutates `config.endpoints` and
`config.admin.{dependencies,components.providers}` — all unchanged in Payload 4 —
so it runs unmodified.

**Also required, in the root `package.json`:**

```json
"pnpm": { "overrides": {
  "@payloadcms/plugin-cloud-storage": "4.0.0-canary.29",
  "@payloadcms/translations": "4.0.0-canary.29"
} }
```

Payload 4 hard-fails at `getPayload()` if any `@payloadcms/*` package disagrees
with core, and the adapter pulls the 3.x line transitively. Keep these pinned to
whatever `payload` itself is on.

**Verified end to end** against the live zone: boot, `payload.create()` with a
file, bytes present under `moyolearn/` with matching content, absent from the
zone root, and `payload.delete()` cascading to Bunny.

**Remove this when** the adapter ships a Payload 4 build. Upstream issue:
`docs/decisions/payload-storage-bunny-payload4-report.md`.

## `expo-router@57.0.15`

**Why:** cold boots logged `Can't perform a React state update on a component
that hasn't mounted yet`, on roughly one boot in three. Symbolicated to
`build/fork/useLinking.native.js` — `getInitialState()` runs during
`NavigationContainerInner`'s FIRST render, and the `getInitialURL()` promise it
returns calls `setLastUnhandledLink` (a `useState` setter on that same
not-yet-committed fiber) when it resolves. Upstream still has it: the code at
`expo-router@latest` is identical, so this is not an upgrade away.

**What the patch does:** gates the setter on the actual mount, in BOTH
`NavigationContainer` copies (`build/fork` and `build/react-navigation/native`,
which take turns depending on the entry). Before the container commits the
value is held in a ref; the mount effect flushes it. Deferring with
`setTimeout(0)` was tried first and is NOT enough — React schedules its own
work on a macrotask too, so the deferred write still sometimes beat the commit,
which is exactly the intermittency that made it look fixed. Nothing reads
`lastUnhandledLink` before the commit (the container renders `fallback` until
that promise resolves), so deep-link handling is unchanged.

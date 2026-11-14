# Optional SignalIQ schools-page pilot

The marketing app (`apps/web-vite`) contains a consent control on `/for-schools`
and `/privacy`. The feature is disabled when either public build setting is
absent or invalid. A fresh browser starts off. No SDK request, identifier, or
event is created before an explicit grant. Global Privacy Control overrides a
stored or new grant and clears the saved grant.

The only eligible pathname is exactly `/for-schools`. Other marketing pages,
learning, learner, tutor, teacher, authentication, onboarding, administration,
and checkout pages never qualify. Mounting the preference control on `/privacy`
does not load the SDK or send an event. The route component owns the session;
unmounting it revokes and disposes that session. This adapter is not mounted in
the root document or any learning app.

After consent, the adapter loads `/sdk/v1.js` from the configured SignalIQ
origin, creates its restricted website facade with `consent: false`, rechecks
the grant, GPC and current path, then grants consent and sends
`page({ path: '/for-schools' })`. It sends no custom events and exposes no
identify call. Query strings, fragments, page titles, referring pages, form
contents, learner records, names, email addresses and user identifiers are not
passed to SignalIQ. Both the script request and SDK transport suppress the
HTTP Referer. The SDK script also uses `crossOrigin: anonymous`; SignalIQ serves
only that public SDK asset with wildcard CORS, leaving ingestion authorization
unchanged. SDK-generated events also include a random browser identifier and
event time. The service sees technical request metadata such as the network
address; both the control and privacy text disclose this.

SignalIQ owns the anonymous browser identifier after consent. Moyo stores only
the preference (`moyo:schools-analytics:v1`, `granted` or `denied`). Revocation
immediately calls `setConsent(false)` and `dispose()`, clearing pending SDK
events, retries and anonymous storage, and attempting to abort pending sends.
Requests already received cannot be unsent. Deleting received data is a
separate request. Denial and GPC also remove only the SDK v1 documented
`siq_anon` localStorage key in a guarded operation, so a previous document's
identifier can be removed without loading the SDK. No unrelated site storage
is cleared. Cross-tab preference changes, focus, visibility changes and
back/forward navigation recheck the choice/GPC/path. Pending script loads are
aborted on denial or route exit and late completions cannot create a client.
Browser storage failures leave the choice effective for the current visit;
subsequent visits default off.
Focus, visibility and asynchronous SDK completion also re-read the stored
choice, so a missed storage event cannot leave an old grant active. If a write
fails, the explicit choice remains in this mounted browser environment only;
a later preference event supersedes that fallback. SDK teardown exceptions do
not interrupt disposal attempts or release of the browser listeners.

## Configuration and preview

Do not configure this pilot until the owner has created a real SignalIQ
workspace and an ingestion-only website key for it. Never use a server,
provider, administration, or personal API credential as the public write key.
Keep these settings absent for the default disabled release:

```text
VITE_SIGNALIQ_WRITE_KEY=<public ingestion-only website key>
VITE_SIGNALIQ_ENDPOINT=https://<approved SignalIQ host>/api/ingest/v1/events
```

These values are compiled into the marketing client at build time. Changing
Vercel settings requires a new build. The adapter requires HTTPS, the exact
ingestion path, and no URL credentials, query or fragment. The SDK URL is
derived from that same origin. No dependency or native configuration changes
are needed. Existing Vite/Nitro Vercel output settings remain authoritative.

The production marketing canonical domain is `www.moyolearn.com`;
`moyolearn.com` redirects to it. Authorize only the exact intended browser
origin on the SignalIQ website key. A Vercel preview requires its own explicit
origin authorization (and preferably a separate test workspace/key); do not
enable wildcard preview origins. No Vercel settings, keys or deployment are
created by this change.

No CSP was found in the inspected marketing source, Vite or Vercel
configuration. If a deployment-level CSP is present, add only the approved
SignalIQ origin to `script-src` and `connect-src` while preserving the rest of
the policy. Do not weaken it to `*` or add `unsafe-inline` for this feature.

Run `pnpm --filter web-vite test` (also included in the workspace test task),
`pnpm --filter web-vite typecheck`, and `pnpm --filter web-vite lint` with the
workspace's installed dependencies. The focused test command uses Node 24's
built-in TypeScript stripping and test runner; no test dependency is added.
For an owner-approved preview, use the project's existing Vercel preview
workflow with the build root/config still set to `apps/web-vite`.
Verify the source baseline first: the existing production deployment has no
verified Git SHA, and current main contains unrelated marketing changes. Stage
without assigning production domains, review the full result, and only then
consider promotion through the owner-controlled release process.

In a clean browser, check `/for-schools` with Network open: there must be no
SignalIQ SDK or ingestion request while off. Enable analytics, then verify one
path-only page event, no query/fragment even when the address contains them,
and no Referer header. Turn it off and verify no future delivery. Repeat with
GPC on, a denied cross-tab choice, a slow SDK request followed by revocation,
and navigation to private routes. Confirm the control is keyboard accessible
and announces its state. Do not send real test events without authorization.
No live ingestion or deployment was performed while authoring this change.

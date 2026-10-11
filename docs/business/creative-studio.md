# Moyo Business Creative Studio

A business-owner workspace combining two different jobs: **make a visual asset** and **compose/deliver a newsletter**. A graphic editor is not an email layout engine, and neither is an audience-permission system.

## Status of this PR

**Implemented:** web Campaign Studio at `/campaigns`, inside the existing `(business)` role shell; heading, paragraph, image, button and divider blocks; desktop drag reorder plus keyboard/touch reorder; undo/redo; desktop/phone HTML preview; editable JSON download/restore; server-side, organization-scoped Mailcheap draft creation. Remote preview images start blocked. Owner-only server permissions and existing plan/host gates remain authoritative.

**Not implemented by this PR:** PhotoCraft Rust integration, native iPad canvas, Pencil support, Skia/TypeGPU effects, native creative asset library, automatic PhotoCraft exports/uploads, CRM subscriber sync, sending from Moyo, scheduling from Moyo, campaign analytics, rich template/brand-kit management, or full round-trip editing of Mailcheap HTML. The source pin and implementation design for that native work are below. There is no fake native component, imaginary upstream API, or embedded web view presented as a native port.

The editor is a first block-composition slice, not a completed Canva/Photoshop replacement. No deployment, production connection, subscriber import or email send was performed while authoring this PR. Keep the PR draft until the framework and device validation gates are satisfied.

## Source review and licensing

Pinned source references are in [`upstream-lock.json`](./upstream-lock.json), inspected October 11, 2026.

| Upstream | Verified architecture | Use in Moyo |
| --- | --- | --- |
| [Mailcheap](https://github.com/marclou/mailcheap/tree/67d13b028a6ecae9ec56d49c4b2db58019217eba) | Self-hosted newsletter app; Amazon SES delivery; MongoDB-backed application; public API can create a campaign draft from HTML or Markdown. | Use the documented draft API behind Moyo's authorization boundary. Keep marketing delivery separate from authentication, receipts and learner notifications. |
| [PhotoCraft](https://github.com/storytold/photocraft/tree/fa2fe1c90fa77235d648a2d21428491593e1c2d9) | Rust workspace with document, command, raster, format, CPU composition and wgpu composition crates; egui desktop UI and a WASM browser application. | Adapt the engine and document concepts behind Moyo's own native/shared UI. Do not attempt to import the desktop app as a React component. |

Mailcheap's root license is MIT, copyright 2026 Marc Lou. PhotoCraft's root license is **MIT OR Apache-2.0**, copyright 2026 ArtCraft Team and PhotoCraft contributors. Its NOTICE explicitly excludes the ArtCraft name, wordmark and logos from the open-source code license. Fonts, icons, dictionaries and optional build assets have separate notices. Preserve upstream notices and audit transitive dependencies before bundling source or binaries. Use Moyo branding and its existing font/image licensing process. This PR does not redistribute upstream code, fonts, logos or binaries.

PhotoCraft describes itself as early alpha. Its menu/command coverage, PSD corpus results and GPU tests are upstream claims and test coverage, **not evidence that Moyo's native port works**. A new renderer needs its own parity proof.

## Product flow

1. **Designs:** create from a tutoring flyer, newsletter hero, class announcement or social-card template. Open a canvas with the business's authorized assets and brand settings.
2. **Edit:** layer-aware text, images, shapes, transforms, cropping, masks and selected image adjustments. Preserve an editable source document independently of exported pixels.
3. **Publish asset:** flatten an explicit revision to an email-compatible PNG/JPEG, convert to the approved web color space, strip unwanted metadata, validate dimensions/size, and store an immutable business-owned asset. This publishing path is a separate implementation track; the current composer accepts an already-published HTTPS image URL.
4. **Compose newsletter:** insert the published asset among real headings, paragraphs and links. Never flatten the entire newsletter into one image. Keep alt text and the opt-out footer intact.
5. **Review:** preview widths, subject and inbox preview copy, link destinations, asset availability, sender identity and subscription eligibility. Download the editable document.
6. **Create draft:** Moyo sends the rendered snapshot to that business's explicitly configured Mailcheap instance. A receipt links to the created draft. This operation does not send an email.
7. **Deliver:** in the current slice, an authorized operator reviews audience/consent, sender verification and the final rendering in Mailcheap before separately choosing its delivery action.

The eventual business navigation groups are **Designs / Campaigns / Assets / Brand kit / Audience / Reports**. Only Campaigns has a route in this PR; do not add dead destinations. The pilot Campaigns item is owner-only. Staff delegation needs a marketing-specific permission rather than granting everyone with a staff hat the owner's API key.

## Mailcheap integration contract

Source: [`app/api/v1/campaigns/route.js`](https://github.com/marclou/mailcheap/blob/67d13b028a6ecae9ec56d49c4b2db58019217eba/app/api/v1/campaigns/route.js).

Moyo's browser submits a version-1 block document to `POST /api/business/campaigns`. It cannot supply `orgId`, `userId`, provider origin, newsletter slug, raw HTML, recipient arrays, scheduling fields or a send command. Unknown document and block fields fail validation.

The service uses `protectedOperation`: session/host context, `requiresMembership: ['owner']`, and `requires: 'write'` for draft creation. The settings read uses the same owner wall with the free read capability. Child context is explicitly refused. Nothing queries student mastery, sessions, safety records, accommodations or billing details to create a campaign.

Only the service reads the server-only `MAILCHEAP_CONNECTIONS_JSON` environment value. It is an array of records:

```json
[
  {
    "orgId": "EXACT_ORGANIZATION_ID_FROM_YOUR_DATABASE",
    "origin": "https://mail.your-business.example",
    "apiKey": "SERVER_ONLY_API_KEY_PLACEHOLDER",
    "newsletter": "parent-newsletter",
    "businessName": "Your verified business name",
    "postalAddress": "Your actual business mailing address"
  }
]
```

Set this in the web server's secret/environment configuration, never a `NEXT_PUBLIC_*` variable, source control, mobile config, or client storage. Do not deploy the example values. Missing mappings disable handoff for that organization; there is no global-key fallback. Invalid configuration fails closed and never returns the configuration contents. The client receives only destination/brand information selected after authorization.

**Important isolation constraint:** upstream Mailcheap is not a multi-tenant Moyo authorization layer. Until it has independently verified organization-scoped authorization, provision separate Mailcheap deployments **and separate underlying data/credentials** per business. The validator rejects duplicate origins, but different hostnames alone do not prove database isolation. Operators must verify the actual deployment boundary. Never offer a shared all-business Mailcheap admin login to customers. A scalable shared-provider rewrite requires its own tenant model, row scoping, least-privilege credentials and penetration tests.

The adapter calls exactly `POST <configured-origin>/api/v1/campaigns` with `Authorization: Bearer <server-key>` and `{ newsletter, subject, previewText, html }`. It requires HTTP 201 and a valid Mongo-style document ID; the link is rebuilt against the approved origin, not trusted from a returned URL. HTTPS-only configured origins, no user credentials or URL paths, no HTTP redirects, no outgoing cookies, a ten-second timeout, bounded response reads and no automatic POST retries apply.

A timeout can occur after the upstream draft was created. The UI therefore says **unconfirmed**, not failed-and-safe-to-repeat, and requires the user to check Mailcheap before another creation attempt. This is not an exactly-once or idempotent API. Subsequent edited snapshots create separate drafts; there is no undocumented PATCH behavior.

## Email documents and privacy

The portable JSON document holds no identities, recipient list or secrets. Structural validation allows unfinished fields in an editable save/restore, while export requires real HTTPS image/button URLs, image descriptions, a subject and content. There are at most 30 blocks and 64 KiB of editable JSON; rendered HTML has its own 90,000-byte limit. Table-based output uses inline styles and resolved Moyo semantic colors, not app CSS. Structural email dimensions belong to `EMAIL_LAYOUT`, not screen utility classes.

The configured business name/postal address and unsubscribe placeholder are generated server-side. Authored text is escaped, including braces, so text cannot introduce Mailcheap macros or suppress its footer logic. Upstream `lib/render-email.js` replaces `{{unsubscribe_url}}` at delivery and handles inbox preview text.

The preview frame has an opaque sandbox, no scripts/forms/same-origin privilege, a restrictive CSP and no referrer. Images are blocked until the author explicitly loads them. Nothing submits a campaign just because the editor is opened. Preview is a design aid, not proof of Gmail/Outlook/Apple Mail rendering.

Editable state is per component instance via Zustand and resets on a new authenticated organization/user scope. There is no browser local-storage cache of marketing data. Downloads are explicit. A tab-unload warning is provided, but SPA navigation is not a guaranteed persistence boundary: users must download before leaving. The rendered Mailcheap copy cannot restore the original block history.

Adult recipients require independently recorded marketing consent. Being an existing guardian/customer, paying for tutoring, or appearing in a CRM is not a marketing subscription. Keep suppression, unsubscribe, bounce and complaint handling separate from transactional messages. Before delivery, verify SES/domain configuration, actual sender identity/postal address, recipient permissions and provider event handling. This PR does not assert legal or deliverability certification.

## Native PhotoCraft adaptation: chosen design

### Keep the engine; replace the desktop shell

Reuse/adapt the Rust **document, operations, raster, paint, composition, I/O and PSD** crates where their dependency graph supports the target. Build a thin, versioned C ABI for native iOS/Android and a WASM-facing command boundary for web. The ABI belongs in an adapter crate; do not add unsafe application glue throughout upstream engine crates. The public bridge exposes document handles, validated commands, revisions, cancellable jobs and explicit resource release. No Rust pointer is a JavaScript number; use opaque native handles with generation checks.

Moyo owns React Native/Expo controls, semantic `@acme/ui` components, accessibility, responsive panes, asset permissions and navigation. Do not ship egui menus as a hidden native WebView. The existing upstream WASM application may be useful for a separately labelled evaluation, but is not evidence of a native iPad integration.

### Renderer responsibilities

| Layer | Responsibility | Constraint |
| --- | --- | --- |
| PhotoCraft engine | Document/layer model, editable operations, image/PSD I/O, reference rendering and command history. | One authority for document content/history. Do not keep a conflicting full pixel graph in Zustand. |
| Skia / Graphite | Moyo canvas presentation, text/vector overlays, selection outlines, rulers and handles, where the selected build exposes the needed interfaces. | Skia is not an import adapter for PhotoCraft's egui UI. |
| React Native WebGPU | Own the native GPU device/queue and application surface chosen for the accelerated Moyo renderer. | Native wgpu and JavaScript WebGPU are not interchangeable object graphs. |
| TypeGPU | Typed WGSL compute/render passes for specifically ported filters, masks, histograms and composition stages. | Reuse the same verified JS GPUDevice. TypeGPU does not convert Rust or SkSL automatically. |
| Worklets/native workers | Low-latency gesture sampling, command batching and bounded background image processing. | No full-image copies through React state and no expensive filters on the input thread. |
| Kinetrell | Panel/inspector motion and other Moyo chrome animation. | Honor reduced motion; do not add another animation system. |

PhotoCraft currently uses **wgpu 30** in the inspected GPU manifest, aligned with its eframe build. Its browser package uses eframe's WebGPU/WebGL2 support. That does **not** establish that a Rust texture can be used by Skia Graphite or a JS `GPUTexture`. Choose one GPU owner for a compositing pass, explicitly bridge handles/fences/formats and prove lifetimes. Never claim zero-copy until measured. Do not run a complete PhotoCraft compositor followed by a second complete Skia compositor every frame.

For the initial native adaptation, preserve the engine's CPU compositor as an oracle. Validate a dirty-tile export/import path before replacing effects with TypeGPU. A bounded dirty-tile transfer is an honest reference path, not a claimed zero-copy implementation. Promote optimized texture interop only when parity, cancellation, device-loss and resource-release tests pass. Keep unsupported effects disabled with a clear limitation; never silently flatten an editable file on import.

References: [TypeGPU interoperability](https://docs.swmansion.com/TypeGPU/), [Skia textures](https://shopify.github.io/react-native-skia/docs/animations/textures/), [PhotoCraft GPU manifest](https://github.com/storytold/photocraft/blob/fa2fe1c90fa77235d648a2d21428491593e1c2d9/crates/gpu/Cargo.toml).

### iPad and foldable interaction contract

Landscape tablet uses a tools rail, central artboard and collapsible Layers/Properties inspector. Portrait, Stage Manager and split-screen use actual available width, not an “is iPad” check; inspectors collapse before covering the artwork. Respect the existing fold/hinge-safe layout system on Android tablets/foldables. Keyboard commands must coexist with text-field editing; Pencil pressure/tilt/hover/squeeze are capabilities, not assumptions about every stylus. Finger gestures pan/zoom without drawing, with a configurable finger-drawing mode and left-handed tool placement.

Brush strokes coalesce samples and commit as one undo unit. Predicted samples are visual only until confirmed. A resize/rotation/hinge change must preserve document-space coordinates. Use pointer capture, cancellation, and multi-touch tests. Accessibility provides labelled tools, a navigable layer list and property controls outside the GPU canvas.

For memory: sparse/copy-on-write tiles, viewport-driven resolution, bounded undo/tile/effect caches, task cancellation and device-loss recovery. As a planning calculation, a 4096×4096 RGBA8 layer is 64 MiB before masks, scratch textures or history; 10 full-size layers are already 640 MiB. Tile/cache budgets need measurement on the lowest supported device, not merely an M-series simulator. Set proposed frame/memory targets only after capturing a baseline; do not present them as measured results.

### Artboards are not email documents

The native editable design stores layer structure, asset references, dimensions, color space and a schema/engine version. Published assets store business ownership, source document/revision, content hash, format, dimensions, accessibility description and an immutable delivery URL. The service must validate ownership when attaching an asset to a campaign, not trust a client-supplied business ID. Email clients receive PNG/JPEG plus accessible HTML text and buttons—not a PSD, canvas, WebGPU buffer or the editor document.

## Implementation and acceptance tracks

**Campaign slice in this PR:** exercise `/campaigns` as a real owner and as denied roles; configure an isolated staging Mailcheap instance; create a draft and confirm zero delivery; reload via downloaded JSON; test remote-image toggle, drag and keyboard reorder, mobile widths, dirty navigation and retries. Check the rendered message in supported email clients before using it for a real campaign.

**Engine admission:** pin a reviewed PhotoCraft revision; inspect Cargo dependency licenses and build constraints; compile the selected engine crates for device/simulator and WASM; prove open/edit/undo/save with an original regression corpus. Parser quotas, malformed PSDs, decompression bombs, plugin/control-channel exclusion and document limits are blocking checks.

**Native presentation:** prove one document/command path on iPad and Android, then dirty tiles, Skia presentation and a small TypeGPU parity corpus. Document every unsupported PSD operation and color conversion. Add real-device pen/gesture/resize tests, memory pressure, cancellation, device loss and export revision consistency before exposing the native route.

**Business completion:** durable tenant drafts/revision history; published asset storage and signed ownership checks; brand kits/templates; marketing-specific staff permissions and approval flow; opt-in audience management; idempotent delivery jobs, suppression and authenticated provider events; meaningful reporting. These require separate implemented work, not enabled navigation items.

## Verification and engineering ownership

Focused contracts: `pnpm --filter web campaigns:test` (also part of the web test script). The independent `Business campaign contracts` workflow runs without provider credentials or a workspace install. Existing full CI still owns framework checks.

Local evidence at authoring: **50 dependency-free Node tests passed**, including a real local HTTP redirect test, and a strict standalone TypeScript check passed for the document/render/protocol/HTTP core. The local runtime was Node 22.16.0/TypeScript 5.8.3, not the repository's required Node version. GitHub/npm DNS was unavailable in the execution container; full cold-cache monorepo checks, browser rendering, native builds and live Mailcheap delivery validation were not run. Do not mark these as passing.

Applied guidance: the available email-best-practices and React-best-practices skills, repository CONTRIBUTING rules, and the existing Moyo UI/auth patterns. The engineering roster is UI/accessibility, Rust/FFI, GPU/performance, identity/data security, email/deliverability, QA/device testing and documentation. Continue to use the project's requested skill repositories (expo/skills, mattpocock/skills, Argent/agent-device, coreyhaines31/marketingskills, pbakaus/impeccable, petergyang/no-ai-slop) where available; a named skill is not evidence of having executed a review or device test.

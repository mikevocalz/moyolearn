# Media on Bunny — two products, one schema, direct uploads
**Doc 29 · Moyo platform pack · Date:** Aug 25, 2026
**Decision:** Bunny.net hosts all media — images, video, documents. Payload's media schema is the index of record; Bunny holds the bytes. Upload and replace work identically from the React Native app and the Payload admin, both with real progress.

---

## 1. The split that determines everything: Bunny is two products
Treating Bunny as one blob store is the mistake that costs a rewrite later.

| Class | Product | Why |
|---|---|---|
| **Images** (avatars, marketing, tutor photos) | **Bunny Storage** + pull zone + Optimizer | Optimizer does resize/format/quality as CDN query params — no derivative pipeline of ours, no Payload image resizing |
| **Documents** (worksheets, PDFs, guardian exports) | **Bunny Storage**, token-authenticated | Static bytes; the interesting part is access control, §5 |
| **Video** (lesson clips, tutor intros, recordings) | **Bunny Stream** | Storage will not transcode. Stream gives adaptive-bitrate encoding, a hosted player, token/domain security, DRM, and analytics — none of which Storage has |
| **Learner homework captures** (doc 24) | **Storage, token-auth, private zone, TTL** | These are a child's work on a child's desk. §5 is not optional for this class |

One Payload collection can still front all four — the `mediaClass` field routes to the right backend. Two products, one schema.

## 2. Don't write the adapter — one exists
[`maximseshuk/payload-storage-bunny`](https://github.com/maximseshuk/payload-storage-bunny) is a Payload storage adapter for Bunny that already covers what we need: **TUS resumable uploads** (chunked, resume on interruption, built for serverless request-timeout and file-size limits), an `autoMode` toggle that lets the admin switch between standard and TUS uploads, media preview in admin table cells and document views for images/video/audio/documents, and per-collection config. Evaluate it at PR-97 against the installed Payload version; if it fits, we configure rather than build. Fall back to a custom adapter (`handleUpload` / `handleDelete` / `generateURL` / `staticHandler`) only if it doesn't.

## 3. Upload architecture — the client talks to Bunny, the server mints credentials
**Never proxy bytes through our server.** It doubles bandwidth, breaks on serverless timeouts, caps file size, and — the reason that matters here — makes a real progress bar impossible, because the browser only sees progress to *our* server, not to Bunny.

**Video (Bunny Stream, TUS):** the documented flow is exactly right for us —
1. Server calls the **Create Video API** to get a `videoId`.
2. Server generates a **presigned signature** (SHA256) with an expiry.
3. Client uploads directly with `tus-js-client` to `https://video.bunnycdn.com/tusupload`, passing `AuthorizationSignature`, `AuthorizationExpire`, `VideoId`, `LibraryId` as headers.
4. `onProgress(bytesUploaded, bytesTotal)` drives the bar. `findPreviousUploads()` resumes an interrupted upload.
This is the whole point of the design: **end-users upload directly without our API key ever reaching the client.**

**Images and documents (Bunny Storage):** same shape — server mints a short-lived signed upload URL, client PUTs directly with `XMLHttpRequest`'s `upload.onprogress` (or TUS via the adapter for large files). Bunny added **presigned URL support through an S3-compatible layer** recently; confirm the exact mechanism against the current Storage docs at PR — this is the piece most likely to have changed.

**The rule, stated once:** the Bunny AccessKey and library API keys live server-side only. Anything the client holds is short-lived, scoped to one file, and expires.

## 4. Two-phase progress — the bug everyone ships
A video is **not ready when the upload bar hits 100%.** It then queues and encodes, and Stream reports status as `QUEUED → PROCESSING → ENCODING → FINISHED / FAILED` over webhooks. A single bar that fills to 100% and then sits there while nothing plays is the most common media UX failure in this category.

So the progress model has two phases, and the UI says which one it's in:
```
Phase 1  Uploading      0–100%   client-side, from TUS/XHR progress events
Phase 2  Processing     indeterminate → determinate when Bunny reports encode %
Ready    playable/servable
Failed   with a retry that resumes rather than restarts
```
Images and documents skip phase 2 and go straight to Ready. Webhook receiver (pg-boss job) updates the Payload doc's `status` field; the client subscribes or polls that field, never Bunny directly.

## 5. Access control — the part that matters because children use this
- **Public zone** (marketing images, tutor profile photos): plain CDN URLs, cached hard.
- **Token-authenticated zone** (documents, learner captures, session recordings): Bunny's token authentication with short expiry, URLs minted per-request by a `protectedOperation`. **A learner's homework photo must never sit behind a guessable public CDN URL.**
- **Learner media is learner content** (docs 19/24): it inherits the transcript TTL and the erasure cascade. Deleting a learner's data means deleting the Bunny objects and the Stream videos, not just the Payload rows — the erasure job calls Bunny's delete APIs and records the result. Orphan sweep runs weekly and reports discrepancies.
- **EXIF/GPS stripped before upload** (doc 24) — on the client, before the bytes leave the device.
- Signed URLs are never logged, never put in analytics, never emailed.

## 6. The Payload schema
```ts
// collections/Media.ts — sketch; field names settle at PR
{
  mediaClass: 'image' | 'document' | 'video' | 'learner-capture',  // routes the backend
  provider: 'bunny-storage' | 'bunny-stream',
  // Storage
  storageZone?: string,
  objectPath?: string,
  // Stream
  libraryId?: string,
  videoId?: string,
  // lifecycle
  status: 'pending' | 'uploading' | 'processing' | 'ready' | 'failed',
  bytes?: number,
  mimeType?: string,
  checksum?: string,
  // delivery
  visibility: 'public' | 'token-auth',
  expiresAt?: Date,          // learner classes only; drives the erasure cascade
  // provenance
  uploadedBy: relationship,
  replacedFrom?: relationship,   // "change a document" keeps history
}
```
**Replace, don't overwrite.** Changing a document writes a *new* object and points the record at it, keeping `replacedFrom`. Overwriting the same path means a CDN cache that serves the old file for hours and no way to answer "what did this look like last term."

## 7. One upload core, two surfaces
`packages/app/features/media/useBunnyUpload.ts` holds the state machine — request credentials → upload with progress → confirm → subscribe to processing. React Native and the admin both consume it; only the file-picking differs (`expo-image-picker` / `expo-document-picker` vs the admin's input). The progress component follows doc 08 §4.8's bar anatomy: **track ink @ 12%, fill grade-green, failure in redpen** (a failed upload genuinely *is* an error, unlike learner progress, which is never "wrong"), value label in `data` mono adjacent to the bar, never inside it below 24px height. Cool dial: 44px minimum target on cancel/retry.

## 8. PRs
- **PR-97 · Adapter evaluation + config** — `payload-storage-bunny` against installed Payload; zones, pull zone, Optimizer, Stream library.
- **PR-98 · Credential-minting endpoints** — Create Video + signature, Storage signed URLs, all server-side, `protectedOperation`-gated.
- **PR-99 · `useBunnyUpload`** — state machine, TUS + XHR paths, resume, cancel.
- **PR-100 · Progress UI** — two-phase bar, doc-08 anatomy, RN + admin.
- **PR-101 · Webhook receiver** — Stream status → Payload `status`, pg-boss retries.
- **PR-102 · Access control + erasure** — token auth, TTL, erasure cascade calling Bunny deletes, weekly orphan sweep.

## 9. Sources (linked)
[Bunny TUS resumable uploads (docs)](https://docs.bunny.net/stream/tus-resumable-uploads) · [Bunny: presigned & resumable uploads announcement](https://bunny.net/blog/bunny-stream-introducing-pre-signed-and-resumable-uploads/) · [Bunny Storage changelog (presigned/S3)](https://bunny.net/docs/storage/changelog) · [payload-storage-bunny adapter](https://github.com/maximseshuk/payload-storage-bunny) · [Bunny Stream capabilities review](https://swarmify.com/blog/bunny-stream-review/) · [tus protocol](https://tus.io/) · Pack docs 07/08/19/24/28.

# Spike: can a client PUT directly to Bunny Storage?

**Date:** 2026-08-26 · **Status:** RESOLVED — yes, verified against a live zone
**Unblocks:** the images/documents half of the upload work (the video half was never blocked)

## The question

Doc 29 §3 asks for client-uploads-direct with the server minting only short-lived
credentials. For **Stream** that was already settled — TUS with a SHA256
presigned signature. For **Storage** it was open, and the doc flagged why: Bunny
added an S3-compatible layer recently and the exact presign mechanism was
unverified. Until answered, we did not know whether a browser could PUT at all.

The docs alone could not answer it. Bunny lists `Presign` as supported but every
worked example is `aws s3 presign`, which emits GET URLs; and the page says
"Presigned URLs require authentication", which reads like a contradiction of the
whole point. It also warns that CORS "is not configurable".

## What was actually measured

Signed with SigV4 against the live zone (region `ny`), Access Key ID = storage
zone name, Secret = zone password.

| Test | Result |
|---|---|
| Classic Storage API `PUT` / `GET` / `LIST` / `DELETE` under `moyolearn/` | 201 / 200 (round-trip byte-identical) / 200 / 200 |
| Unsigned request to `ny-s3.storage.bunnycdn.com` | **403 AccessDenied** — not 501 |
| SigV4-signed `ListObjectsV2` | **200** |
| **Presigned `PUT`, request carrying no credentials whatsoever** | **200 OK** |
| `OPTIONS` preflight on that URL with a foreign `Origin` | **204, `Access-Control-Allow-Origin: *`** |

The 403-not-501 is the detail that made the rest worth trying: Bunny's docs say a
region without S3 support answers `501 NotImplemented`. A 403 meant the endpoint
was live and only the signature was missing.

## Answers

1. **S3 compatibility is enabled on this zone.** It cannot be retrofitted — it is
   set at zone-creation time — so this was luck, not configuration. Any NEW zone
   must be created with it switched on or none of the below works.
2. **Presigned PUT works, credential-free.** "Presigned URLs require
   authentication" means the signature IS the authentication; it does not mean an
   additional key must ride along. A browser holding only the URL can write.
3. **CORS is not a blocker.** Non-configurable, but non-configurable *open* —
   preflight returns 204 and `*`. Nothing to set up; also nothing to lock down,
   which is why the URL's TTL is the only real control.

## What this means for the build

Doc 29 §3's architecture holds for **both** products, so images/documents and
video share one shape: the server mints a short-lived credential, the client
uploads directly, and the bytes never touch our API.

- **Storage (images, documents):** server presigns a PUT, client PUTs. Progress
  comes from `XMLHttpRequest.upload.onprogress` — `fetch` cannot report upload
  progress. Use multipart above 100MB, which Bunny recommends and fully supports.
- **Stream (video):** unchanged — TUS via `tus-js-client`, resumable through
  `findPreviousUploads()`.

The two-phase progress model in §4 still applies to video only: Storage has no
transcode phase, so an image is done when the PUT completes.

## Constraints worth carrying into the implementation

- **TTL is the only lever.** Anyone with the URL can write until it expires, so
  keep it short (minutes) and mint per-object, never per-session.
- **Credentials are all-or-nothing.** Access Key ID is the zone name and Secret is
  the zone password; there is no scoped write key. That is precisely why the
  presigned URL must be minted server-side and the key must never ship.
- **The zone is shared with sosinspires-mono.** One credential opens both
  products' media. Everything Moyo writes is namespaced under `moyolearn/`
  (`BUNNY_MEDIA_PREFIX`), but the namespace is a convention, not a boundary —
  the key can still read and write outside it. Splitting the zone is the fix
  before this carries real children's media.
- 500 RPS combined up+down, 1 Gbps, both shared with SOS.
- No batch delete, no custom `x-amz-meta-*`, no versioning, no ACLs, no SSE.
- `Content-Type` signed into the URL must match the header the client sends, or
  the signature fails.

## Still open

`@seshuk/payload-storage-bunny@3.0.0` (note: `@seshuk`, not `@maximseshuk` —
that name 404s on npm) peers `payload ^3.83.0`, and this repo runs
`4.0.0-canary.29`. It will not install cleanly. Nor is there a stable Payload 4
line for `@payloadcms/storage-s3` or `plugin-cloud-storage` — only
`4.0.0-internal.*` builds. So the adapter does not remove the work; the transport
above is ours to write either way.

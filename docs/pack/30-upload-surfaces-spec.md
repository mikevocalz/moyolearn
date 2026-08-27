# Upload Surfaces — dropzone, replace target, transfer tray
**Doc 30 · Moyo platform pack · Date:** Aug 25, 2026
**Scope:** the file-input experience across app and admin — single and multiple, replacing an avatar or logo, uploading spreadsheets and documents. Sits on doc 29's Bunny transport and doc 08's Cool-dial design law. Zustand only, no bare `useState`.

---

## 0. Audit first — these components already exist locally

**This spec is a target, not a build order.** The repo already has dropzone components and other upload-adjacent UI. Doc 08 set the house convention for this case — it audits `packages/ui/Button.tsx` as it exists and marks only genuine additions `[add]` — and this doc follows it. **Read the existing components before writing anything.**

**The expensive thing is the public API, not the internals.** A component already imported in thirty places is costly to rename or replace and cheap to fix from the inside. Default to **keeping the call signature and rewriting the guts**; propose an API change only where the current shape makes a §2–§6 law impossible to satisfy, and say why.

**Audit each existing component against these, and record the answer per component:**

| Check | Why it matters | If it fails |
|---|---|---|
| Drag-only, or is there a visible click-to-browse fallback? | touch and assistive tech cannot drag | fix in place, small |
| Are accepted types and size limits printed **inside the zone before** first interaction? | limits revealed as rejection is the top failure in this category | fix in place, small |
| Real `<input type="file">` in the DOM, or a `<div onClick>`? | determines whether keyboard and screen-reader support are possible at all | structural — rewrite internals |
| Per-file progress with real bytes, or one spinner for the batch? | a spinner makes slow indistinguishable from stuck | structural |
| Per-file retry, or batch restart? | needs doc-29 TUS resume underneath | structural |
| Which of §5's eleven states exist? | most components have three | additive |
| Does it own its own transport (`fetch`/`axios` to our API)? | doc 29 requires client→Bunny direct with server-minted credentials; a component that POSTs to `/api/upload` needs rewiring, not restyling | **structural — the biggest one** |
| `useState` anywhere? | house rule is Zustand only, scoped per instance | mechanical |
| Arbitrary Tailwind values (`p-[13px]`, `text-[11px]`)? | banned by the doc-08 spacing lint; fails CI | mechanical |
| Does one component serve both the avatar case and the multi-file case? | §1 — an avatar should not have a dashed rectangle | split into `ReplaceTarget` + `Dropzone`, preserving both call sites |
| Already built on react-dropzone? | if yes, §9 is a no-op and this is much smaller than it looks | good news |

**Then write the delta**, not the spec: for each existing component, one of *keep as-is* · *extend `[add]`* · *rewrite internals, same API* · *split* · *replace and migrate call sites* — with the reason. The PRs in §11 are written as if greenfield; **rewrite them as deltas once the audit is done.** Several may collapse to nothing.

**Standing convention from here on:** every spec in this pack audits what exists before proposing what to build, and marks additions `[add]`. Doc 08 does it, this doc now does it, and the ones that didn't are wrong rather than exempt.


## 1. Three components, because one control can't do all three jobs
The most common mistake here is shipping one dashed rectangle for every case. An avatar does not want a dashed rectangle.

| Component | When | Shape |
|---|---|---|
| **`ReplaceTarget`** | single file that already has a value — **avatar, logo, cover image, a resume on file** | **The thing itself is the drop target.** The avatar *is* the control: hover/focus reveals a "Replace" affordance over it; it accepts a drop; click opens the picker. No box, no dashed border. Workable does this well — the current file sits in a row with "Replace file or drag and drop here" inline |
| **`Dropzone`** | adding one-to-many files — worksheets, spreadsheets, documents, bulk media | The bordered zone **with the rules printed inside it**, plus a file list below |
| **`TransferTray`** | any upload that can outlive the view it started in | A detached, minimizable panel — Proton Drive's is the reference: `7 uploading (0%)` with All / Active / Completed / Failed tabs and per-file speed. Fireflies floats a smaller version in the corner |

**Rule of thumb from the research:** lead with the drop zone where users add several files often; lead with a button where upload is a rare single-file step; **never ship a drag-only zone with no clickable fallback.**

## 2. The law: state the rules before the user tests them by failure
Every accepted type and every size limit is printed **inside the zone, before the first interaction.** Revealing a limit only as a rejection error — after the user picked the file — is the single most common failure in this category. Fireflies states types *and* per-type ceilings together (`MP3, M4A, WAV, MP4 or WEBM · Max video 2.0 GB, Max audio 500 MB`); Lindy states `We support documents and audio files. 20MB maximum.` Do the same, in `caption` (12px floor), inside the frame.

Where a quota exists, show consumption the way Chatbase does — `11 KB / 20 MB` — not just the ceiling.

## 3. Validation happens on drop, not on upload
Whop's bulk pattern is the one to copy, because it makes problems *fixable in place* rather than fatal:
- Each rejected or imperfect file gets an inline reason on its own row — "This media type is not currently supported", "Needs cropping to valid size" — never a blanket "Upload failed".
- Fixable problems get an inline action on the row (`Crop`), plus a summary banner: *"4 images need cropping. Click to fix."*
- The footer counts both: `4 files need cropping · 1 invalid file`, and the primary button reflects reality — **`Upload 0 files`, disabled**, rather than an enabled button that will fail.
- Invalid rows use `redpen`; needs-attention rows use `highlighter` (doc 08 §4.8's semantics — reserve red for actually wrong).

## 4. Per-file everything
- **Per-file progress with real bytes**, never one indeterminate spinner for a batch. A spinner makes a slow upload indistinguishable from a stuck one, and users re-trigger it.
- **Per-file status** — queued · uploading · processing · done · failed. Doc 29's two-phase model applies: video is not done when bytes hit 100%.
- **Per-file retry that resumes**, not a batch restart. TUS keeps its fingerprint (doc 29), so retry continues where it stopped.
- **Per-file remove**, and an undo for removal — drag-and-drop is inaccurate by nature, so recovery is part of the design.
- A flat "Done" or "Failed" over a batch hides which files actually landed. Never do that.

## 5. States (build all of them; demos die in the ones nobody built)
`idle` · `drag-over-page` (the whole page acknowledges an incoming drag — a small target on a large screen is hard to hit precisely) · `drag-over-zone` · `drag-reject` (type/size known from the drag payload where the browser exposes it) · `validating` · `uploading` · `processing` · `partial-success` · `error` · `at-limit` (quota reached — explain what to remove) · `disabled-while-active` (only where the backend genuinely can't accept concurrent adds).

## 6. Accessibility — non-negotiable, and where most dropzones fail
- The real `<input type="file">` stays in the DOM and stays focusable. The visual zone is a label for it, never a `<div>` with an `onClick`.
- **Keyboard:** the zone is tabbable, Enter/Space opens the picker, every file row's actions are reachable and ≥44px (Cool dial).
- **Screen reader:** an `aria-live="polite"` region announces file added, validation result, and completion. Progress bars carry `role="progressbar"` with `aria-valuenow`; the batch announces at meaningful milestones, not every percent.
- **Touch has no drag** — mobile shows a tap-to-choose sheet (Camera / Photo Library / Files), never a "drag files here" instruction the device can't honor.
- **Paste support** (`Cmd/Ctrl+V`) for screenshots. Cheap to add, invisible until someone needs it, and delightful when they do.

## 7. The Moyo-specific rules
- **Design language:** doc 08 Cool dial — `inset` 16, `caption` 12 floor, `label` 13/500 for row filenames, `data` mono for sizes and percentages (tabular figures so the column aligns), targets 44+. The zone border is **`border-2` ink, structural** — its *state* changes by fill and by the highlighter underlay, **never by border color**, because in this language borders are structure and not emphasis. Highlighter appears **once**: the active drop state. Progress bars follow §4.8 anatomy — track ink @ 12%, fill grade-green, failure in redpen.
- **Replace keeps history** (doc 29 §6): replacing an avatar writes a new object and sets `replacedFrom`. Never overwrite a path — the CDN will serve the old bytes for hours.
- **Learner-uploaded files** are learner content: token-authenticated delivery, TTL, erasure cascade, EXIF stripped client-side before the bytes leave the device (docs 19/24/29).
- **Spreadsheets and documents** get a type-specific icon plus the extension in mono, not a generic paperclip — a list of eleven identical grey icons is unscannable.
- **Thumbnails for images**, because a filename is not verification that the right file was picked.

## 8. The app (React Native) — a different interaction model, not a port

There is no drag-and-drop on a phone, so the component API stays the same and the *interaction* is rebuilt. Two flows matter: **changing an avatar** and **uploading a document.**

### 8.1 Changing an avatar
The entry point is the avatar itself, and tapping it opens an **action sheet**, never a modal with a dashed box:
```
Take Photo
Choose from Library
Remove Photo          (destructive, only when a value exists)
Cancel
```
Then, in order — each step exists because skipping it produces a specific known failure:

1. **Permissions, asked in context.** Camera and library are requested at the moment of the tap, with plain copy about why. **iOS limited photo access is the default many users pick** — handle "Selected Photos" as a first-class state, and surface a "Select more photos" affordance rather than treating it as a denial. Denied → a screen that deep-links to Settings with the exact toggle named, never a dead end.
2. **Crop and zoom on a circular mask.** A photo picked on a phone is almost never framed for a 96px circle; without this step every avatar is a corner of someone's head. Pinch to zoom, drag to reposition, the mask matches the final shape.
3. **Resize and compress before upload.** A 12MP photo for an avatar is absurd — downscale to the largest rendered size ×3 and re-encode. This is the difference between a 4MB upload on cellular and a 120KB one.
4. **Strip EXIF/GPS on device, before the bytes leave** (docs 24/29). An avatar carrying home coordinates is a real leak, not a theoretical one.
5. **Optimistic display.** The new avatar renders immediately from the local URI while the upload runs — `useOptimistic`, which is the sanctioned exception to the Zustand rule (doc 17's write path).
6. **Progress lives on the avatar**, as a ring around it. A separate progress bar for a single small image is heavier than the thing it describes.
7. **Failure reverts to the previous avatar** with an inline retry — never a broken image, never a blank circle. The optimistic value snapping back *is* the error message; the retry is the affordance.

### 8.2 Uploading a document
`expo-document-picker` opens the Files app on iOS and the storage-access framework on Android. Details that bite:
- **Copy to cache on pick.** The returned URI can be a security-scoped or `content://` reference that expires or isn't readable later. Copy first, upload from the copy, clean up after.
- **Multi-select is the picker's job**, not ours — one call returns many files, which then flow into the same per-file queue and rows as the web build (§4).
- **Backgrounding kills foreground uploads.** If the user leaves the app mid-upload, iOS suspends the task. Either use a background-capable upload session or state plainly that the upload needs the app open — and make the TUS resume from doc 29 the recovery path, so returning continues rather than restarts.
- **Cellular warning above a size threshold**, with a "wait for Wi-Fi" option that queues.
- **Offline** joins the same queue doc 24 uses for homework captures — one queue, one set of rules.

### 8.3 Share-sheet ingestion
Register as a share target so a parent can send a PDF straight from Files or Mail into Moyo without opening the app first. It is a small amount of native config and it removes the most annoying step in the whole flow.

### 8.4 The child-safety decision this surfaces
**Learner avatars are not photo uploads.** A children's product that lets a child upload a self-portrait creates a moderation surface, a PII surface, and a grooming-adjacent risk in any social context — for a benefit a curated set delivers just as well. So:
- **Learners:** choose from a curated illustrated set. No camera, no library, no upload path in the UI at all.
- **Guardians, tutors, staff:** photo upload as specced above.
- The action sheet in §8.1 therefore never renders on a learner profile — this is enforced by the role in the registry, not by hiding a button.
If a guardian wants a real photo on a child's profile, that is a guardian-initiated action on the guardian's account, subject to doc 07's rules — and it is worth asking whether it needs to exist at all before building it.

## 9. Library
[**react-dropzone**](https://github.com/react-dropzone/react-dropzone) — headless, ~5M weekly downloads, and it owns exactly the parts worth not rewriting: drag state, focus handling, keyboard accessibility, MIME validation, size limits, multi-file queuing. It deliberately does not perform uploads, which is why it fits — doc 29's `useBunnyUpload` owns that. **Do not use Filepond or UploadThing**: both want to own the transport, and ours is Bunny. React Native has no drag-and-drop; the RN build uses `expo-document-picker` / `expo-image-picker` behind the same component API.

## 10. State
Zustand only, scoped per instance via `createScopedStore` — a module-level store would mean two dropzones on one screen sharing a queue. The queue is client state (files, validation results, per-file phase); anything the server knows lives in Query.

## 11. PRs
- **PR-103 · `Dropzone`** — react-dropzone, rules-in-zone, page-level drag state, all §5 states.
- **PR-104 · `ReplaceTarget`** — avatar/logo in-place replace, crop-on-select for images, `replacedFrom`.
- **PR-105 · File list + validation** — per-file rows, inline fixes, summary footer, count-accurate primary.
- **PR-106 · `TransferTray`** — detached, minimizable, tabbed, survives navigation.
- **PR-107 · A11y pass** — live region, keyboard, paste.
- **PR-108 · Native avatar flow** — action sheet, permissions incl. iOS limited library, circular crop, resize/compress, EXIF strip, optimistic + ring progress, revert-on-fail.
- **PR-109 · Native document flow** — picker with copy-to-cache, multi-select into the shared queue, cellular threshold, background/resume behaviour.
- **PR-110 · Share-sheet target** + registry gate that removes the upload path entirely on learner profiles.

## 12. Sources (linked)
**Research:** [SaaS file upload & drag-and-drop UX patterns 2026](https://www.saasui.design/blog/saas-file-upload-ux-patterns) · [Filestack: upload UI components, states and errors](https://blog.filestack.com/upload-file-ui-design-components-states-and-errors/) · [Filestack: drag-drop, progress, preview](https://blog.filestack.com/upload-ui-components-drag-drop-progress-preview/) · [Smart Interface Design Patterns: drag-and-drop UX](https://smart-interface-design-patterns.com/articles/drag-and-drop-ux/) · [Queensland Government Design System: file upload](https://www.designsystem.qld.gov.au/components/file-upload) · [Uploadcare: uploader UX](https://uploadcare.com/blog/file-uploader-ux-best-practices/) · [PkgPulse: React file upload libraries 2026](https://www.pkgpulse.com/guides/best-file-upload-libraries-react-2026) · [react-dropzone](https://github.com/react-dropzone/react-dropzone) · [NN/g: Drag-and-Drop, How to Design for Ease of Use](https://www.nngroup.com/articles/drag-drop/)

**Mobbin references:** [Whop — bulk validation with inline fixes](https://mobbin.com/screens/03fc821c-eec1-4278-bf97-8f8ac202d34c) · [Proton Drive — transfer manager](https://mobbin.com/screens/12f6528d-e78a-4540-9087-784c0baa9172) · [Fireflies — rules stated + floating tray](https://mobbin.com/screens/0e45d455-f884-44a9-8600-16830793250e) · [Workable — replace-file pattern](https://mobbin.com/screens/eaf43a41-dda3-4d9c-886b-21160666710b) · [Lindy — compact modal dropzone](https://mobbin.com/screens/50bd3a40-45f3-44a4-a9da-fe935dffefe1) · [Chatbase — quota + bulk select](https://mobbin.com/screens/591d4424-f134-42bb-954f-2f8d1b188936) · [Revolut Business — per-file status](https://mobbin.com/screens/2a7be71f-2e9a-404c-9c56-c846d8616783) · [AutoSend — image library](https://mobbin.com/screens/665e0e67-4875-40e4-814b-80eb440f85ec)

**Expo (pin exact APIs at PR):** [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/) · [expo-document-picker](https://docs.expo.dev/versions/latest/sdk/document-picker/) · [expo-image-manipulator](https://docs.expo.dev/versions/latest/sdk/imagemanipulator/)

Pack docs 07/08/17/19/24/28/29.

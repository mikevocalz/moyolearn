# PR #123 checkpoint: reachable guardian practice review

<!-- What: connect the existing practice preview to guardian navigation. -->
<!-- Why: the prior component had no imports, routes or entry point. -->
<!-- SOT: PracticePreview; GuardianHomeworkTimeline; guardian web/native route guards. -->
<!-- SOT-KEYWORDS: homework pr123 practice route guardian print approval handoff -->

## Delivered

Math rows in the guardian timeline now open
`/homework/[submissionId]/practice`. Both Next.js and Expo Router host the
existing `PracticePreview` behind their guardian shell. The shared screen is
exported through `@acme/app`; each route keys it by submission ID so mutation
results cannot carry over to a different worksheet.

The introduction no longer asserts that an unattempted worksheet demonstrates
struggle. Existing generation still distinguishes targeted skills from general
grade-band practice. Approval/regeneration and print actions are disabled while
conflicting requests are pending.

## Verification

- Cold-cache root typecheck: 19 successful tasks, zero cached.
- Targeted ESLint: exit 0.
- Public-barrel guard: passed for UI and app.
- Client/print-HTML tests: 14 passed; authorization service tests: 3 passed.
- CodeRabbit reviewed the route, screen, barrel and current native generated
  changes with zero findings. The final disabled-state additions were checked
  with lint and the focused tests.
- `git diff --check`: passed.

Logs: `.scratch/pr123/practice-route-{typecheck,lint,tests,review}.log` and
`.scratch/pr123/barrels.log`.

## Browser walkthrough

On the isolated local database and Chromium session from the previous checkpoint:

1. Opened the first child's Math timeline row through **Review math practice**.
2. Created an eight-item draft through **Make a practice set**.
3. Reviewed the draft and approved it; printing controls appeared only after
   approval.
4. **Print practice sheet** opened the authenticated sheet in a new tab.
   DOM inspection found eight question rows and no `Answer:` text.
5. **Print answer key** opened the separate adult key with the answers.
6. Revoked only the synthetic guardian's first-child relationship in the scratch
   database. A fresh key request from the preview tab returned HTTP 403 with
   JSON, not answer HTML. Restored that fixture relationship afterwards.

The print document's CSP correctly prevented an attempted fetch from inside
the print document. The authorization assertion was then made from the normal
preview tab. No physical print job or native share sheet was invoked.

Screenshots:

- [Timeline entry](screens-20261016/practice-entry.png)
- [Draft review](screens-20261016/practice-draft.png)
- [Question sheet](screens-20261016/practice-print-sheet.png)
- [Separate adult key](screens-20261016/practice-print-key.png)

## Open work

Native compilation is still running. Crop persistence, missing-grade-band
handling, native print/share and the wider release gates remain open.

Further inspection found that `worksheet-cache.ts:hydrate` returns immediately
when a new device has no local cache, without discovering server submissions.
The guardian timeline also uses `keepPreviousData` across child query keys,
which can temporarily show the previous child's rows under a newly selected
child during a slow request. These require a separate cache/isolation fix and
regression evidence; this route checkpoint does not claim to resolve them.

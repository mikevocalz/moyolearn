# Moyo Learn for Mac: release checklist

Each line names the command or file that proves it. A release ships only when
every unchecked line below is checked with a link or log.

SOT: .github/workflows/desktop-release.yml · docs/desktop/production-modules.md
SOT-KEYWORDS: desktop release checklist sign notarize updates windows sentry

## One-time setup (owner: repo admin)

- [ ] GitHub Environment `desktop-release` exists with **required reviewers** (at least one person other than whoever pushes the tag). Required, not optional: the environment holds the signing certificate, and without reviewers any push of a `desktop-v*` tag signs and notarizes whatever it points at.
- [ ] Deployment branches and tags on `desktop-release` set to **selected only**: tag pattern `desktop-v*` and branch `main`. Required: without it a workflow on any branch can request the environment's secrets. The workflow's first step also refuses a commit that `main` does not contain, but that check runs inside the job, after the environment has been granted.
- [ ] Secrets in that environment: `DESKTOP_DEVELOPER_ID_P12_BASE64`, `DESKTOP_DEVELOPER_ID_P12_PASSWORD`, `DESKTOP_DEVELOPER_ID_APPLICATION` (certificate name or SHA-1), `DESKTOP_TEAM_ID`, `DESKTOP_ASC_API_KEY_P8_BASE64`, `DESKTOP_ASC_API_KEY_ID`, `DESKTOP_ASC_API_ISSUER_ID`. Names only; values never enter the repo, a log or a PR.
- [ ] A Developer ID Application certificate exists for the team. None is installed on the build Mac used for these PRs (`security find-identity -v -p codesigning` lists 0 Developer ID Application identities on 2026-11-04).

## Every release

- [ ] `desktop.config.json` `macos.buildNumber` incremented (`spark package` refuses to reuse a changed archive under the same build number, package.js:110).
- [ ] CI `Desktop` workflow green on the release commit: Nitro drift check, `tsc --noEmit`, `npm test`, `spark doctor`, `spark analyze`, `modules --check`, `spark build`. The release workflow reruns all of them before it touches a secret.
- [ ] `docs/desktop/production-modules.md` regenerated from `.spark/selection-report.json` and reviewed: no module included that the app does not import.
- [ ] Tag `desktop-vX.Y.Z` → `Desktop release` workflow → artifact `moyo-learn-macos` (`apps/desktop/dist/<App>.zip`).
- [ ] On a clean macOS 14+ Apple Silicon Mac (not the build machine): unzip, open, no Gatekeeper prompt; `spctl -a -vv "Moyo Learn.app"` says "Notarized Developer ID"; `stapler validate` passes.
- [ ] Spark's `docs/desktop-manual-acceptance.md` run on that Mac; results pasted in the release notes.
- [ ] Sign in with a staging guardian account and a staging tutor account; Keychain Access shows `moyo.session.cookie` under the app's service; sign out removes it.
- [ ] Cold launch to first interactive window, three runs after a reboot, recorded with the Mac model. The app has no launch marker yet, so the method is a screen recording from the Dock click to the sidebar painting, timed frame by frame.

## Not available yet (each blocks the line it names)

| Item | Blocker | Decision |
| --- | --- | --- |
| Signed, notarized build | Credentials above | DEFER until the environment exists |
| Whole-app updates (`@legendapp/spark/updates`) | No feed host; `spark updates init <feedURL>` also creates an EdDSA signing key in the login Keychain whose custody needs an owner | DEFER: pick the Vercel project and key holder first |
| Sentry `platform:macos` tag into the mobile project | `@sentry/react-native` is not in the desktop graph and its macOS support on react-native-macos 0.83 is unverified | DEFER |
| Windows acceptance report | No Windows 11 machine (ARM64 or x64) available to this run; Spark marks Windows native acceptance pending | DEFER; `docs/desktop/windows-acceptance-2026-11-04.md` records "untested" for every category |
| Argent run against the packaged app | Needs the signed build and a live GUI session | DEFER |

# MB-02: Business identity, shell and navigation

<!-- What: Business identity, shell and navigation, bounded against current Moyo Business source-of-truth modules. -->
<!-- Why: independent education-first operations without duplicating the learning platform. -->
<!-- SOT-KEYWORDS: moyo business business shell implementation acceptance -->

**Status:** Implementation contract only; no production feature, migration, device test or third-party write in this change.
**Base reviewed:** `main@a6afe6593060b73c8fc7b61d2ee0e0800204f1f3`; **blockers for implementation:** MB-01 (#101).
**Related existing work:** #99 (adaptive UX draft).

## Existing ownership and intended files

- `apps/web/app/(business)/layout.tsx` (inspect actual exports and tests before editing)
- `apps/web/app/(business)/ops/page.tsx` (inspect actual exports and tests before editing)
- `packages/app/features/shell` (inspect actual exports and tests before editing)
- `packages/ui` (inspect actual exports and tests before editing)
- `packages/theme` (inspect actual exports and tests before editing)
- `apps/web-vite` (inspect actual exports and tests before editing)

## User-visible vertical slice

- Owner signs into an existing tutoring organization and sees 'Moyo Business' instead of generic Moyo Learn operations while preserving their current organization host and `/ops` route.
- Staff accesses only permitted destinations; changing workspace resolves a new authorized membership and invalidates previous-organization query caches.
- Owner opens an existing `/leads`, `/families`, `/campaigns` or `/settings` deep link; direct URL, back and refresh route to the same authorized record.

## Data, security and UX contracts

- Keep `(business)` as a first-party customer shell using existing `RoleShell`, not Payload admin or a new app deployment.
- Separate public marketing product positioning from authenticated organization-host routing. Reserve proposed `business` host only in a separately reviewed hostname/slug migration.
- Expose at most five primary business destinations; context-specific CRM/Finance/Marketing links are second-level destinations, not duplicate role shells.
- Web keeps persistent header and mobile-width web tabs (no side rail). Native ordinary phone uses bottom tabs; native foldable cover/open, tablet and XR use physical RIGHT rail even RTL, per pinned skill.
- Route switching and Inspector open/close cannot reset active CRM selection, unsaved draft or scroll; use existing Zustand/ref continuity and semantic UI.

## Acceptance and failure-path evidence

- Existing role restrictions deny learner and unrelated guardians while owner/staff permissions stay intact; direct deep links do not bypass membership.
- Two organizations with different branding never share cached records after workspace switching.
- Phone, web desktop, tablet and foldable (cover/book/tabletop/RTL) show correct navigation; no hinge-overlapping touch target; screen reader and keyboard focus are reachable.
- Reduced-motion variant and loading/empty/error/forbidden/offline states are inspected in Storybook and supported device runs.
- No marketing domain or new deployment is activated by this slice.

## Merge, rollback and review

Flagged shell and UI/route aliases roll back without schema or finance changes.

**Review roster:** Staff-level Expo/React Native + web architect, UX/accessibility designer, identity reviewer and QA.

**Required source/skills:** Root AGENTS.md/CONTRIBUTING.md; mattpocock/skills: pr, codebase-design; expo/skills (when changing Expo UI); pbakaus/impeccable; petergyang/no-ai-slop; pinned mikevocalz-foldable-layouts for adaptive work. Read domain-specialist source/skills before implementation; versions and external design tools must be verified against the installed lockfile. Existing `@acme/ui`, semantic web elements, Solito/Expo routes and Zustand/refs take precedence over building replacements.

**Evidence at draft creation:** GitHub source/spec inspection and PR creation only. No typecheck, lint, test, build, browser, simulator, hardware or live external-provider validation was performed. Update this section with exact commands/results and device matrix when implementation lands. Do not merge a documentation contract as though it were a functional feature.

'use client';
// The client boundary /schools needs and nothing more.
//
// The roster is a SERVER read (page.tsx runs it behind `protectedOperation`),
// so the only honest "try again" is re-running that read — and Next exposes
// exactly one way to do it from the client: `router.refresh()` on the App
// Router's own router. Solito's universal router deliberately does not carry
// `refresh` (push / replace / back / parseNextPath only), and this route is
// web-only by contract (district.schools: "web-rail only"), so the Next router
// is the right one to reach for rather than a fork of the universal one.
//
// It exists as a separate file because a server component cannot hand a
// function across the boundary: `onRetry` has to be created on the client
// side of it. The alternative was a Retry button wired to nothing, which is
// the defect this page was fixed for.
// SOT: design/screens/district/district.schools/contract.md (failure_paths.offline "Retry")
// SOT-KEYWORDS: schools district client boundary retry refresh server read roster
import { useRouter } from 'next/navigation';
import { SchoolListScreen } from '@acme/app';
import type { InstitutionRead, OrgBranding } from '@acme/app';

export function SchoolsView({
  schools,
  org,
}: {
  schools: InstitutionRead<OrgBranding[]>;
  org: OrgBranding | null;
}) {
  const router = useRouter();
  return (
    <SchoolListScreen
      schools={schools}
      org={org}
      onRetry={() => {
        router.refresh();
      }}
    />
  );
}

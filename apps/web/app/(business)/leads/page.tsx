import { Suspense } from 'react';
import { LeadsScreen } from '@acme/app';
import { LoadingSkeleton } from '@acme/ui';

/*
  SUSPENSE, not `force-dynamic` — the boundary the pipeline carried on the old
  /ops page, moved here with it.

  `useViewParams` reads `useSearchParams()` because a pipeline view — "the
  at-risk families I own, by value" — is a link people paste to each other.
  Next cannot statically prerender a component that reads the query string, so
  the build fails on this page without a boundary to bail out at.

  `force-dynamic` would also have silenced it, and it is the wrong trade: it
  gives up prerendering the whole route, shell included, to solve a problem that
  belongs to one subtree. The boundary keeps the static parts static and says
  where the dynamic part starts.

  The fallback is a skeleton rather than a spinner because this route resolves
  into a dense table — a spinner collapses the layout and then the table shoves
  it aside, which reads as a jump rather than a load.
*/
export default function LeadsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton count={6} className="m-inset" />}>
      <LeadsScreen />
    </Suspense>
  );
}

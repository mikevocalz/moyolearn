import { OpsScreen } from '@acme/app';

/*
  `/ops` inside the (business) group: route-group parens do not touch URLs, so
  this page serves the same /ops every deep link and the rail's Overview item
  already point at — what changed is the CHROME. The screen used to carry its
  own DashboardShell and a private sidebar; now RoleShell (the (business)
  layout) is the one org chrome, exactly as it is for /safety and every other
  rail destination.

  No Suspense boundary any more, deliberately: the pipeline — and with it the
  useSearchParams read that forced one — moved to /leads. This screen reads no
  query string.
*/
export default OpsScreen;

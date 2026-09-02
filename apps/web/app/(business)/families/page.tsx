import { FamiliesScreen } from '@acme/app';

/*
  The interim families surface — a server-derived grouping over leads (see
  packages/app/features/ops/family-groups.ts for why this is a derivation and
  not a household collection). No search-param reads, so no Suspense boundary.
*/
export default FamiliesScreen;

import { FamiliesScreen } from '@acme/app';

/*
  The households surface — ADR-109's real family rows with their pipeline
  rollups; rows open to /families/[familyId]. No search-param reads, so no
  Suspense boundary.
*/
export default FamiliesScreen;

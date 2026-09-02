import { EnrollmentScreen } from '@acme/app';

/*
  Enrollment over the existing stage machinery: complete a conversion (the same
  stage POST the pipeline badge makes) and hand the family to /schedule — the
  J6 exit the org.crm contract requires. No search-param reads, so no Suspense.
*/
export default EnrollmentScreen;

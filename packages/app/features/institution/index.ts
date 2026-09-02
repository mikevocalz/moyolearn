// Institution feature public API.
// SOT: packages/app/features/institution/institution.policy.ts
// SOT-KEYWORDS: institution feature policy export types

export { can, allowedActions, requirePermission, InstitutionPermissionDenied } from './institution.policy.ts';
export { InstitutionPlaceholderScreen } from './placeholder-screen.tsx';
export { SchoolListScreen } from './schools-list-screen.tsx';
export { PeopleListScreen } from './people-list-screen.tsx';
export { InstitutionReportsScreen } from './reports-screen.tsx';
export { InstitutionScreen } from './screen.tsx';
export { InstitutionScreen as InstitutionScreenNative } from './screen.native.tsx';
export type { OrgMember } from './people.types.ts';
export type { EnrollmentReport } from './reports.types.ts';
export type {
  InstitutionAction,
  InstitutionRead,
  InstitutionResource,
  InstitutionScope,
} from './institution.types.ts';

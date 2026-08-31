// Institution feature public API.
// SOT: packages/app/features/institution/institution.policy.ts
// SOT-KEYWORDS: institution feature policy export types

export { can, allowedActions, requirePermission, InstitutionPermissionDenied } from './institution.policy.ts';
export { InstitutionPlaceholderScreen } from './placeholder-screen.tsx';
export { SchoolListScreen } from './schools-list-screen.tsx';
export type {
  InstitutionAction,
  InstitutionResource,
  InstitutionScope,
} from './institution.types.ts';

// @acme/app · ops domain public API — features import THIS, never a deep path.
// SOT: CLAUDE.md (The block)
// SOT-KEYWORDS: ops index barrel domain public-api dashboard crm leads families enrollment
export { OpsScreen } from './screen';
export { OpsDashboardContent, type OpsDashboardContentProps } from './ops-dashboard-content';
export { LeadsScreen } from './leads-content';
export { LeadDetailScreen } from './lead-detail-content';
export { FamiliesScreen } from './families-content';
export { FamilyDetailScreen } from './family-detail-content';
export { EnrollmentScreen } from './enrollment-content';
export { useOpsTablePrefs } from './ops.prefs.store';
export {
  DEFAULT_TABLE_PREFS,
  HIDEABLE_COLUMNS,
  type OpsDensity,
  type OpsTablePrefs,
} from './ops.prefs';
export {
  useLeads,
  useLead,
  useCreateLead,
  leadsQueryKey,
  leadQueryKey,
  type LeadsView,
  type LeadsPage,
} from './use-leads';
export {
  useFamilies,
  useFamily,
  useUpdateFamilyContacts,
  familiesQueryKey,
  familyQueryKey,
  type FamilyDetailPayload,
} from './use-families';
export { type FamilyContact, type FamilyRecord } from './family-record';
export { useViewParams, type ShareableView, type ViewParams } from './use-view-params';
export { applyStageChange, MANUAL_STAGES, type StageChange } from './stage-change';
export { useStageAction } from './use-stage-action';
export { type FamilyGroup } from './family-groups';
export { NEW_LEAD_STAGE, parseNewLead, type NewLeadInput } from './lead-create';
export {
  leadsRootPath,
  leadDetailPath,
  familiesRootPath,
  familyDetailPath,
  enrollmentRootPath,
} from './ops-paths';
export { useSessions, sessionsQueryKey, type SessionsRead } from './use-sessions';
export {
  REVENUE_BY_ORG,
  STAGE_TONE,
  MIN_COHORT,
  attendanceCell,
  type Lead,
  type Session,
  type Stage,
} from './ops.data';

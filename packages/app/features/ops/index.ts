// @acme/app · ops domain public API — features import THIS, never a deep path.
// SOT: CLAUDE.md (The block)
// SOT-KEYWORDS: ops index barrel domain public-api dashboard crm
export { OpsScreen } from './screen';
export { OpsDashboardContent, type OpsDashboardContentProps } from './ops-dashboard-content';
export { useOpsChrome } from './ops.store';
export { useOpsTablePrefs } from './ops.prefs.store';
export {
  DEFAULT_TABLE_PREFS,
  HIDEABLE_COLUMNS,
  type OpsDensity,
  type OpsTablePrefs,
} from './ops.prefs';
export { useLeads, leadsQueryKey, type LeadsView, type LeadsPage } from './use-leads';
export { useViewParams, type ShareableView, type ViewParams } from './use-view-params';
export { applyStageChange, MANUAL_STAGES, type StageChange } from './stage-change';
export { useStageAction } from './use-stage-action';
export {
  SESSIONS_BY_ORG,
  REVENUE_BY_ORG,
  STAGE_TONE,
  MIN_COHORT,
  attendanceCell,
  type Lead,
  type Session,
  type Stage,
} from './ops.data';

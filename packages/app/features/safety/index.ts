// @acme/app · safety domain public API — features import THIS, never a deep path.
//
// SERVER SHAPES AND THE CLIENT SCREENS. The access model came first on purpose:
// doc 31 §5's surfaces were PR-115/116, and the rule about who may see an
// incident was settled before anything drew one. The org triage queue is drawn
// on BOTH platforms of `SafetyQueueScreen` now — the read-only mobile companion
// tab, and the web rail view (`OrgSafetyContent`) where the triage moves live
// per org.safety's contract — reading the SAME projections exported below,
// through the one `/api/safety/incidents` route. The guardian view (§5.2) and
// the intake forms still have no screen here.
//
// The service itself is NOT re-exported from this barrel. It opens with
// `import 'server-only'` and its callers are routes, which reach it through
// `@acme/app/server`; a value export here would put it on a mobile bundle's
// import graph.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.2 §5 · docs/design/route-audit-36.md §1 · CLAUDE.md (The block)
// SOT-KEYWORDS: safety index barrel domain public-api incident guardian triage queue screen org mobile
export type {
  GuardianIncidentView,
  StaffRosterEntry,
  StaffTimelineActor,
  StaffTimelineLine,
  TriageQueue,
  TriageRow,
  TutorIncidentView,
} from './incidents.service';

export { SafetyQueueScreen } from './screen';
export { IncidentQueueContent } from './incident-queue-content';
export { OrgSafetyContent } from './org-safety-content';
export {
  useAppendStaffNote,
  useIncidentQueue,
  useStaffRoster,
  useTriageIncident,
  incidentQueueKey,
  staffRosterKey,
  type IncidentQueueRead,
  type StaffRosterRead,
  type TriageMove,
} from './use-incident-queue.ts';
export {
  useOrgSafetyStore,
  type QueueSeverityFilter,
  type QueueStatusFilter,
} from './org-safety.store.ts';
export {
  incidentQueueItemsFrom,
  slaClock,
  unassignedS4Line,
  CATEGORY_LABEL,
  STATUS_LABEL,
  type IncidentQueueItem,
  type QueueTone,
} from './queue-view.ts';

// tutor.incidents (doc 36 §3.3) — the reporter's own lifecycle view, over
// `GET /api/tutor/incidents`. Same rule as the queue exports above: the
// screen reads projections, never the service.
export { TutorIncidentsScreen } from './tutor-incidents-screen';
export { TutorIncidentsContent } from './tutor-incidents-content';
export {
  useTutorIncidents,
  useAppendIncidentNote,
  tutorIncidentsKey,
  type TutorIncidentsRead,
} from './use-tutor-incidents.ts';
export {
  useTutorIncidentsStore,
  type TutorIncidentStatusFilter,
} from './tutor-incidents.store.ts';

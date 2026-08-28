// @acme/app · safety domain public API — features import THIS, never a deep path.
//
// SERVER SHAPES AND ONE CLIENT SCREEN. The access model came first on purpose:
// doc 31 §5's surfaces were PR-115/116, and the rule about who may see an
// incident was settled before anything drew one. The org triage queue is now
// drawn — `SafetyQueueScreen`, the mobile surface route-audit-36.md recorded as
// an honest gap — and it reads the SAME projections exported below, through the
// existing `/api/safety/incidents` route. The guardian view (§5.2) and the
// intake forms still have no screen here.
//
// The service itself is NOT re-exported from this barrel. It opens with
// `import 'server-only'` and its callers are routes, which reach it through
// `@acme/app/server`; a value export here would put it on a mobile bundle's
// import graph.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.2 §5 · docs/design/route-audit-36.md §1 · CLAUDE.md (The block)
// SOT-KEYWORDS: safety index barrel domain public-api incident guardian triage queue screen org mobile
export type {
  GuardianIncidentView,
  TriageQueue,
  TriageRow,
} from './incidents.service';

export { SafetyQueueScreen } from './screen';
export { IncidentQueueContent } from './incident-queue-content';
export { useIncidentQueue, incidentQueueKey, type IncidentQueueRead } from './use-incident-queue.ts';
export {
  incidentQueueItemsFrom,
  slaClock,
  unassignedS4Line,
  type IncidentQueueItem,
  type QueueTone,
} from './queue-view.ts';

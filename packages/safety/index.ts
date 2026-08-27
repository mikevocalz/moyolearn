// @acme/safety — the Safety Plane (doc 07 §3). Server-side only: a compromised
// client cannot lower it, so nothing here is imported into a feature. Learner
// inference goes through `runSafetyPlane` or it does not happen.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §2 · §3 · docs/pack/12-systems-design-prompt.md §5
// SOT-KEYWORDS: safety barrel plane firewall crisis red team classifier fail closed unavailable

export { runSafetyPlane, runSafetyPlaneStream, takeSentences } from './src/plane.ts';
export type {
  Classifier,
  Generator,
  IdentityContext,
  InputClass,
  PlaneLog,
  PlaneOutcome,
  PlaneResult,
  PlaneStreamEvent,
  StreamingGenerator,
} from './src/plane.ts';
export { screen, ruleById, FIREWALL_RULES } from './src/firewall.ts';
export type { FirewallRule, FirewallRuleId, FirewallVerdict, TextOrigin } from './src/firewall.ts';
export {
  crisisResponse,
  guardianAlert,
  isPedagogicallyStorable,
  CRISIS_RESOURCES,
  CRISIS_STEPS,
} from './src/crisis.ts';
export type { CrisisResource, CrisisResponse, CrisisStep, GuardianAlert } from './src/crisis.ts';
export { probesFor, runPassed, summariseRun, PROBES, RED_TEAM_VERSION } from './src/red-team.ts';
export type { Probe, ProbeFamily, RedTeamRun } from './src/red-team.ts';
export { safetyLayer, safetyLayerSync, SafetyLayerUnavailable, SAFETY_LAYERS } from './src/unavailable.ts';
export type { SafetyLayer } from './src/unavailable.ts';
export {
  externalRefusalSafetyEvent,
  isTutoringPaused,
  pausedSafetyEvent,
  safetyEventExpiry,
  safetyEventFor,
  PAUSE_STATUS_MINUTES,
  SAFETY_EVENT_CATEGORIES,
  SAFETY_EVENT_DISPOSITIONS,
  SAFETY_EVENT_TTL_DAYS,
} from './src/events.ts';
export type { SafetyEvent, SafetyEventCategory, SafetyEventDisposition } from './src/events.ts';

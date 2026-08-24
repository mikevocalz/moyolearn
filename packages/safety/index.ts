// @acme/safety — the Safety Plane (doc 07 §3). Server-side only: a compromised
// client cannot lower it, so nothing here is imported into a feature. Learner
// inference goes through `runSafetyPlane` or it does not happen.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §2 · §3
// SOT-KEYWORDS: safety barrel plane firewall crisis red team classifier

export { runSafetyPlane } from './src/plane';
export type {
  Classifier,
  Generator,
  IdentityContext,
  InputClass,
  PlaneLog,
  PlaneOutcome,
  PlaneResult,
} from './src/plane';
export { screen, ruleById, FIREWALL_RULES } from './src/firewall';
export type { FirewallRule, FirewallRuleId, FirewallVerdict, TextOrigin } from './src/firewall';
export {
  crisisResponse,
  guardianAlert,
  isPedagogicallyStorable,
  CRISIS_RESOURCES,
  CRISIS_STEPS,
} from './src/crisis';
export type { CrisisResource, CrisisResponse, CrisisStep, GuardianAlert } from './src/crisis';
export { probesFor, runPassed, summariseRun, PROBES, RED_TEAM_VERSION } from './src/red-team';
export type { Probe, ProbeFamily, RedTeamRun } from './src/red-team';

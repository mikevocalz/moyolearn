// @acme/app · safety domain public API — features import THIS, never a deep path.
//
// SERVER SHAPES ONLY, and no screen. Doc 31 §5's surfaces (the intake forms, the
// guardian view, the triage queue) are PR-115/116; what this domain exports today
// is the access model and the projections they will render, so the rule about who
// may see an incident is settled before anything draws one.
// SOT: docs/pack/31-grade-voice-safety-incidents.md §4.2 §5 · CLAUDE.md (The block)
// SOT-KEYWORDS: safety index barrel domain public-api incident guardian triage
export type {
  GuardianIncidentView,
  TriageQueue,
  TriageRow,
} from './incidents.service';

// AI activity & permissions — consent records and derived observations.
//
// Retention is UI, not policy prose: every raw artefact carries a visible
// expiry, and the AI-training consent we never request is modelled as a
// permanently-off, non-toggleable record rather than being omitted (R9/R10).
// SOT: docs/pack/04-screen-briefs.md §S12
// SOT-KEYWORDS: ai activity permissions consent retention derived observation expiry

export interface ConsentToggle {
  id: string;
  label: string;
  /** Plain language, states the effect — never legal prose. */
  effect: string;
  value: boolean;
  /** Locked-off records are shown, not hidden: absence is not a promise. */
  locked?: boolean;
}

export interface DerivedObservation {
  id: string;
  summary: string;
  source: string;
}

export interface RawArtefact {
  id: string;
  label: string;
  expiresLabel: string;
}

export const CONSENTS: ConsentToggle[] = [
  {
    id: 'practice',
    label: 'Allow AI practice sessions',
    effect: 'Your child can work with Natalie between tutor sessions.',
    value: true,
  },
  {
    id: 'voice',
    label: 'Allow voice input',
    effect: 'Voice recordings are converted to text and deleted right away.',
    value: true,
  },
  {
    id: 'summaries',
    label: 'Weekly summary emails',
    effect: 'You get one email a week about what your child worked on.',
    value: false,
  },
  {
    id: 'training',
    label: 'Use my child’s work to train AI models',
    effect: 'We never do this, and we do not ask for it. This cannot be turned on.',
    value: false,
    locked: true,
  },
];

export const OBSERVATIONS: DerivedObservation[] = [
  { id: '1', summary: 'Difficulty when a ≠ 1', source: '2 AI practice sessions this week' },
  { id: '2', summary: 'Sign errors in binomials', source: '1 AI practice session this week' },
  { id: '3', summary: 'Factoring improved 64% → 72%', source: 'Across 4 sessions' },
];

export const RAW_ARTEFACTS: RawArtefact[] = [
  { id: '1', label: 'Session transcript · Mon 4:00 PM', expiresLabel: 'Deleted Sep 17, 2026' },
  { id: '2', label: 'Session transcript · Wed 4:00 PM', expiresLabel: 'Deleted Sep 19, 2026' },
];

// Session prep demo data — replace with real derived observations.
// SOT: docs/pack/04-screen-briefs.md §S5
// SOT-KEYWORDS: session prep mastery misconception provenance tutor

export interface MasteryItem {
  skill: string;
  value: number;
  previous: number;
  tone: 'grade' | 'redpen';
}

export const SESSION_PREP = {
  studentName: 'Jordan',
  provenance: 'From 2 AI practice sessions this week',
  mastery: [
    { skill: 'Factoring', value: 72, previous: 64, tone: 'grade' as const },
    { skill: 'Quadratic expressions', value: 45, previous: 50, tone: 'redpen' as const },
    { skill: 'Distributing negatives', value: 88, previous: 82, tone: 'grade' as const },
  ],
  misconceptions: ["a ≠ 1", 'sign errors in binomials'],
};

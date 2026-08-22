// Tutor Today demo data — replace with real queries.
// SOT: docs/pack/04-screen-briefs.md §S4
// SOT-KEYWORDS: tutor today next session prep run list

export interface TutorSession {
  id: string;
  studentName: string;
  timeLabel: string;
  mode: 'in-person' | 'virtual';
  travel?: string;
  prepLine: string;
  isNext: boolean;
}

export const TUTOR_SESSIONS: TutorSession[] = [
  {
    id: '1',
    studentName: 'Jordan',
    timeLabel: 'Today, 3:30 PM',
    mode: 'in-person',
    travel: '35 min travel to Brooklyn',
    prepLine: 'Difficulty when a ≠ 1 — 2 AI practices this week',
    isNext: true,
  },
  {
    id: '2',
    studentName: 'Maya',
    timeLabel: 'Today, 5:00 PM',
    mode: 'virtual',
    prepLine: 'Multiplying binomials — steady, needs pacing cues',
    isNext: false,
  },
  {
    id: '3',
    studentName: 'Priya',
    timeLabel: 'Tomorrow, 9:00 AM',
    mode: 'in-person',
    travel: '12 min travel to Moyo Main St',
    prepLine: 'Reviewing factoring — improvement +8%',
    isNext: false,
  },
];

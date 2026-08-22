// Family calendar — family coordination, not operations.
//
// AI practice events are OFF by default (S13 research: noise). Reschedule is
// reachable at L1 and is labelled honestly: tutor approval required.
// SOT: docs/pack/04-screen-briefs.md §S13
// SOT-KEYWORDS: family calendar event child reschedule agenda

export type FamilyEventKind = 'session' | 'assignment' | 'appointment';

export interface FamilyEvent {
  id: string;
  childName: string;
  title: string;
  /** Plain-speech time, e.g. "4:00 PM · 30 min". */
  timeLabel: string;
  kind: FamilyEventKind;
  reschedulable: boolean;
  requiresApproval: boolean;
}

export interface FamilyDay {
  id: string;
  label: string;
  weekday: string;
  dayOfMonth: number;
  events: FamilyEvent[];
}

export const FAMILY_DAYS: FamilyDay[] = [
  {
    id: 'mon',
    label: 'Today',
    weekday: 'Mon',
    dayOfMonth: 18,
    events: [
      {
        id: '1',
        childName: 'Maya',
        title: 'Tutoring · Natalie',
        timeLabel: '4:00 PM · 55 min',
        kind: 'session',
        reschedulable: true,
        requiresApproval: true,
      },
      {
        id: '2',
        childName: 'Maya',
        title: 'Math worksheet due',
        timeLabel: 'By 8:00 PM',
        kind: 'assignment',
        reschedulable: false,
        requiresApproval: false,
      },
    ],
  },
  {
    id: 'tue',
    label: 'Tomorrow',
    weekday: 'Tue',
    dayOfMonth: 19,
    events: [
      {
        id: '3',
        childName: 'Maya',
        title: 'Piano lesson',
        timeLabel: '5:30 PM · 30 min',
        kind: 'appointment',
        reschedulable: true,
        requiresApproval: false,
      },
    ],
  },
  {
    id: 'wed',
    label: 'Wednesday',
    weekday: 'Wed',
    dayOfMonth: 20,
    events: [],
  },
];

// Family calendar — family coordination, not operations.
//
// AI practice events are OFF by default (S13 research: noise).
//
// `reschedulable` / `requiresApproval` are GONE. They existed to draw a
// "Request new time" button, and J2 records that the booking middle — discovery
// → booking → confirmation — does not exist: no endpoint, no collection, no
// approval path. The flags described a capability the product does not have, so
// the screen drew a live control that went nowhere. Data that only a dead
// control reads is dead data; both are removed together, and they come back
// with the booking flow, not before.
//
// `past` and `reportSessionId` replace them: the contract's read-side exits
// (`open_child`, `past_event_report`) are the two things a family calendar CAN
// honestly do today, and both need to know whether an event has already
// happened. A day is `past` relative to the strip, which is what "read the
// report of a past event" means to a reader scanning a week.
// SOT: design/screens/guardian/guardian.calendar/contract.md · docs/pack/04-screen-briefs.md §S13
// SOT-KEYWORDS: family calendar event child agenda past report session exits fixture

export type FamilyEventKind = 'session' | 'assignment' | 'appointment';

export interface FamilyEvent {
  id: string;
  /** Names the child this belongs to; `childId` is the seam the exits route on. */
  childId: string;
  childName: string;
  title: string;
  /** Plain-speech time, e.g. "4:00 PM · 30 min" — never a raw date. */
  timeLabel: string;
  kind: FamilyEventKind;
  /**
   * The session whose report this event leads to, or null when there is none to
   * read (every future event, and every event that is not a tutoring session).
   * Null is not "missing" — it is the honest answer, and the row draws no
   * report exit for it.
   */
  reportSessionId: string | null;
}

export interface FamilyDay {
  id: string;
  label: string;
  weekday: string;
  dayOfMonth: number;
  /** Already happened — the half of the week that has reports rather than plans. */
  past: boolean;
  events: FamilyEvent[];
}

export const FAMILY_DAYS: FamilyDay[] = [
  {
    id: 'sun',
    label: 'Yesterday',
    weekday: 'Sun',
    dayOfMonth: 17,
    past: true,
    events: [
      {
        id: '0',
        childId: 'maya',
        childName: 'Maya',
        title: 'Tutoring · Natalie',
        timeLabel: '4:00 PM · 50 min',
        kind: 'session',
        reportSessionId: 'sess-maya-0917',
      },
    ],
  },
  {
    id: 'mon',
    label: 'Today',
    weekday: 'Mon',
    dayOfMonth: 18,
    past: false,
    events: [
      {
        id: '1',
        childId: 'maya',
        childName: 'Maya',
        title: 'Tutoring · Natalie',
        timeLabel: '4:00 PM · 55 min',
        kind: 'session',
        reportSessionId: null,
      },
      {
        id: '2',
        childId: 'maya',
        childName: 'Maya',
        title: 'Math worksheet due',
        timeLabel: 'By 8:00 PM',
        kind: 'assignment',
        reportSessionId: null,
      },
    ],
  },
  {
    id: 'tue',
    label: 'Tomorrow',
    weekday: 'Tue',
    dayOfMonth: 19,
    past: false,
    events: [
      {
        id: '3',
        childId: 'jordan',
        childName: 'Jordan',
        title: 'Piano lesson',
        timeLabel: '5:30 PM · 30 min',
        kind: 'appointment',
        reportSessionId: null,
      },
    ],
  },
  {
    id: 'wed',
    label: 'Wednesday',
    weekday: 'Wed',
    dayOfMonth: 20,
    past: false,
    events: [],
  },
];

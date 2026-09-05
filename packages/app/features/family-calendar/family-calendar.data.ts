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
// `FAMILY_DAYS` is gone. It was the last fixture on this surface and it is
// struck rather than guarded: a `children.length` gate would have hidden the
// invented sessions from an empty account and kept showing them to a real one.
// The types stay — they are the shape the projection fills when it lands.
// SOT-KEYWORDS: family calendar event child agenda past report session exits week strike

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

const DAY_MS = 86_400_000;

/**
 * The week the strip renders, Sunday through Saturday, around `today`.
 *
 * Every day comes back with `events: []`, and that is the disposition rather
 * than an oversight. The seeded week this module used to export named Maya and
 * Jordan against four hardcoded dates, so it survived `family.store` being
 * emptied and told a guardian with no children that two of them had tutoring
 * booked — on a week that was not the current one either. No guardian-scoped
 * read exists to replace it: of the 55 routes under `apps/web/app/api`, none
 * projects a family's sessions or due work. `ops/sessions` is org-scoped, and
 * `learner/assignments` resolves its learner from ctx, so a guardian cannot
 * ask it about their child.
 *
 * The dates are real because a date control may be honest on its own. The
 * agenda stays empty until the projection lands, and the screen's `no_data`
 * state says so.
 */
export function weekOf(today: Date): FamilyDay[] {
  const midnight = new Date(today);
  midnight.setHours(0, 0, 0, 0);
  const sunday = new Date(midnight);
  sunday.setDate(midnight.getDate() - midnight.getDay());

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    const offset = Math.round((date.getTime() - midnight.getTime()) / DAY_MS);
    const named = date.toLocaleDateString(undefined, { weekday: 'long' });

    return {
      id: date.toISOString().slice(0, 10),
      label: offset === 0 ? 'Today' : offset === -1 ? 'Yesterday' : offset === 1 ? 'Tomorrow' : named,
      weekday: date.toLocaleDateString(undefined, { weekday: 'short' }),
      dayOfMonth: date.getDate(),
      past: offset < 0,
      events: [],
    } satisfies FamilyDay;
  });
}

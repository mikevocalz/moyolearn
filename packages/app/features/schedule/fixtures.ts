import { addMinutes, set, startOfDay } from 'date-fns';
import type { Resource, ScheduleDay, ScheduleEvent } from './model.ts';
// Portraits live in `fixtures/avatars.ts` so this roster and the ops cast show
// the same face for the same person; a second copy is how the two start drifting.
import { portrait } from '../../fixtures/avatars.ts';

/**
 * Demo data for the schedule screen.
 *
 * Deliberately includes the layout cases that are easy to get wrong: a spanning
 * event with two shorter ones beside it, a back-to-back pair that must NOT be
 * treated as overlapping, and a resource with no bookings at all.
 */

const ZONE = 'America/New_York';

const START_HOUR = 8;
const END_HOUR = 20;

/**
 * Demo data is built RELATIVE to a reference day, defaulting to today.
 *
 * It used to be pinned to a fixed 2026-06-15, which made the calendar open on
 * a date months in the past. Tests pass an explicit reference so they stay
 * deterministic; the app passes none and gets the current day.
 */
export function buildDemoDay(reference: Date = new Date()): ScheduleDay {
  const dayStart = set(startOfDay(reference), { hours: START_HOUR });
  const at = (hour: number, minute = 0) =>
    addMinutes(dayStart, (hour - START_HOUR) * 60 + minute);

  return {
    dayStart,
    timeZone: ZONE,
    startHour: START_HOUR,
    endHour: END_HOUR,
    resources: DEMO_RESOURCES,
    events: buildDemoEvents(at),
  };
}

type At = (hour: number, minute?: number) => Date;

export const DEMO_RESOURCES: Resource[] = [
  { id: 'maya', name: 'Maya Rodriguez', avatarUrl: portrait('women', 19), accent: 'ember' },
  { id: 'daniel', name: 'Daniel Okafor', avatarUrl: portrait('men', 54), accent: 'gold' },
  { id: 'priya', name: 'Priya Raman', avatarUrl: portrait('women', 13), accent: 'forest' },
  { id: 'kenji', name: 'Kenji Watanabe', avatarUrl: portrait('men', 26), accent: 'sky' },
  { id: 'elena', name: 'Elena Fischer', avatarUrl: portrait('women', 23), accent: 'rose' },
];

function buildDemoEvents(at: At): ScheduleEvent[] {
  return [
  // Ada — a long block with two shorter lessons beside it. Exercises cluster
  // sizing: both short lessons must render at the same width.
  { id: 'a1', resourceId: 'maya', title: 'Studio hold', start: at(9), end: at(13), kind: 'block' },
  { id: 'a2', resourceId: 'maya', title: 'Theory I', start: at(9, 30), end: at(10, 30), kind: 'lesson' },
  { id: 'a3', resourceId: 'maya', title: 'Theory II', start: at(11, 30), end: at(12, 30), kind: 'lesson' },

  // Grace — back-to-back, must stay full width (touching is not overlapping).
  { id: 'g1', resourceId: 'daniel', title: 'Intake', start: at(9), end: at(10), kind: 'lesson' },
  { id: 'g2', resourceId: 'daniel', title: 'Composition', start: at(10), end: at(11, 30), kind: 'lesson' },
  { id: 'g3', resourceId: 'daniel', title: 'Lunch', start: at(12), end: at(13), kind: 'break' },

  // Alan — a single short lesson, to prove the minimum-height clamp.
  { id: 't1', resourceId: 'priya', title: 'Check-in', start: at(10), end: at(10, 15), kind: 'lesson' },
  { id: 't2', resourceId: 'priya', title: 'Ensemble', start: at(14), end: at(16), kind: 'lesson' },

  // Katherine — a straightforward afternoon.
  { id: 'k1', resourceId: 'kenji', title: 'Orbital mechanics', start: at(13), end: at(15), kind: 'lesson' },
  { id: 'k2', resourceId: 'kenji', title: 'Office hours', start: at(15, 30), end: at(17), kind: 'lesson' },

  // Edsger has nothing booked — the empty-column case.
  ];
}

/** Today's demo schedule. Stable for the session; rebuilt on reload. */
export const DEMO_DAY: ScheduleDay = buildDemoDay();

export const DEMO_EVENTS = DEMO_DAY.events;

/** Kept for stories that want a fixed instant rather than the live clock. */
export const DEMO_NOW = new Date();

'use client';
import { Schedule } from './Schedule.tsx';
import { DEMO_DAY } from './fixtures.ts';
import { useNow } from './use-now.ts';
import type { Slot } from './slots.ts';
import { useScheduleStore } from './store.ts';

/**
 * Schedule screen — the Solito anchor. Renders the calendar against demo data;
 * swap `DEMO_DAY` for a query once a backing collection exists.
 */
export interface ScheduleScreenProps {
  /** Opens the new-booking sheet. Wired by the route, which owns navigation. */
  onNewBooking?: () => void;
  /** Fill the parent — set by the split view, whose pane is the constraint. */
  fill?: boolean;
}

export function ScheduleScreen({ onNewBooking, fill }: ScheduleScreenProps = {}) {
  const selectEvent = useScheduleStore((state) => state.selectEvent);
  const now = useNow();

  const handleBook = (slot: Slot) => {
    // Until booking creation lands, confirming a slot selects it, which is what
    // the grid and the slot list both read for their selected state.
    selectEvent(slot.start.toISOString());
  };

  return (
    <Schedule
      day={DEMO_DAY}
      now={now}
      /*
        DEMO_DAY names itself on the surface. The screen's own doc line has
        said "swap DEMO_DAY for a query" since it was written, and the contract
        records the same gap — but only the code knew: five portraits and a full
        day of lessons read as an org's real Wednesday to everyone else.
      */
      exampleData
      onBook={handleBook}
      /*
        Passed through UNDEFAULTED. The fallback here was
        `() => selectEvent(null)`, so on web — the only host that passes no
        handler — the screen's primary action deselected an event and returned
        the calendar unchanged. `Schedule` shuts the control and states why
        instead of firing at nothing.
      */
      onNewBooking={onNewBooking}
      fill={fill}
    />
  );
}

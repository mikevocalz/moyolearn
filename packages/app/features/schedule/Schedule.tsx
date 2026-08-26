'use client';
import { View, Text, Pressable } from '@acme/ui/tw';
import { Button, Card, Container, Dial, EmptyState, LoadingSkeleton, SegmentedControl, useSizeClass } from '@acme/ui';
import { Calendar } from '@acme/ui/icons';
import { BookingSurface } from './BookingSurface.tsx';
import { ScheduleGrid } from './ScheduleGrid.tsx';
import type { ScheduleDay } from './model.ts';
import { formatTimeRange } from './format.ts';
import type { Slot } from './slots.ts';
import { useScheduleStore, type ScheduleView } from './store.ts';

export interface ScheduleProps {
  /** Fill the parent instead of applying the screen max-width. */
  fill?: boolean;
  day: ScheduleDay;
  /** Injected rather than read from the clock, so renders stay deterministic. */
  now: Date;
  loading?: boolean;
  onBook: (slot: Slot) => void;
  /** Header action — create a booking outside the slot list. */
  onNewBooking: () => void;
}

const VIEWS: { value: ScheduleView; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

/**
 * Today's Schedule.
 *
 * Knows nothing about the split view it is rendered in — it reads the WINDOW
 * size class, exactly as it would if it were the only thing on screen. That is
 * what lets the detail pane host it without either side importing the other.
 */
export function Schedule({
  fill, day, now, loading = false, onBook, onNewBooking }: ScheduleProps) {
  const sizeClass = useSizeClass();
  const view = useScheduleStore((state) => state.view);
  const setView = useScheduleStore((state) => state.setView);
  const selectedEventId = useScheduleStore((state) => state.selectedEventId);
  const selectEvent = useScheduleStore((state) => state.selectEvent);

  const [firstResource] = day.resources;
  /*
    Look the event UP; do not try to read a time out of its id.

    This was `new Date(selectedEventId)`, which assumed the id was a timestamp.
    `selectEvent` is wired to real events whose ids are `'a1'`, so every click
    produced an Invalid Date and `format()` threw a RangeError — the whole
    schedule fell into its error boundary the first time anyone selected
    anything.

    The event carries its own `start` and `end`, so there is nothing to parse.
  */
  const selectedEvent = selectedEventId
    ? (day.events.find((event) => event.id === selectedEventId) ?? null)
    : null;

  return (
    // Recessed canvas: the grid card is surface-raised, so a deeper ground is
    // what makes it read as a floating sheet rather than a bordered box.
    <Dial temperature="cool">
      <Container
        // Inside a split pane the PANE is the measure constraint, so a second cap
        // on top of it just leaves dead space to the right — collapsing the
        // sidebar would visibly do nothing. Standalone, the screen keeps the
        // normal readable cap.
        width={fill ? 'full' : undefined}
        // The `full` variant is `max-w-none px-0` — it drops the container's own
        // horizontal padding along with the cap, so the pane has to put it back
        // or the grid sits flush against the pane edge.
        className={`flex-1 gap-4 bg-surface-sunken py-4 ${fill ? 'px-4 sm:px-6' : ''}`}
      >
        <View className="flex-row items-center gap-stack">
          <Text className="flex-1 text-xl font-semibold text-text md:text-2xl lg:text-3xl">Today&apos;s Schedule</Text>

          {/* The platform's own segmented control (@expo/ui), not a hand-rolled
              row of pressables — same reasoning as every other native control in
              the kit. */}
          <SegmentedControl options={VIEWS} value={view} onChange={setView} />

          <Button variant="primary" title="New booking" onPress={onNewBooking} />
        </View>

        {loading ? (
          <LoadingSkeleton count={6} className="h-12 w-full" />
        ) : day.resources.length === 0 ? (
          <EmptyState
            icon={<Calendar className="text-text-muted" />}
            title="No one is scheduled today"
            description="Add an instructor to this day to start booking lessons."
          />
        ) : sizeClass === 'compact' && firstResource ? (
          <BookingSurface day={day} resource={firstResource} onBook={onBook} />
        ) : (
          <ScheduleGrid day={day} now={now} />
        )}

        {selectedEvent ? (
          <Card className="gap-stack">
            <View className="flex-row items-center justify-between">
              {/* The event's own range, rendered in the CALENDAR's zone.
                  `format()` renders in the host's zone, so a schedule authored
                  in New York and read in London showed the wrong hour — the
                  same bug `zonedMinutesOfDay` exists to avoid on the grid. */}
              <Text className="text-base font-semibold text-text">
                {selectedEvent.title} · {formatTimeRange(selectedEvent, day.timeZone)}
              </Text>
              <Pressable onPress={() => selectEvent(null)}>
                <Text className="text-sm text-text-muted">Close</Text>
              </Pressable>
            </View>
            <View className="flex-row gap-element">
              <Button variant="outline" title="Edit" onPress={() => { /* Wave 3: edit */ }} />
              {/* The event's real span, not a fabricated 30 minutes. */}
              <Button
                variant="primary"
                title="Book"
                onPress={() => onBook({ start: selectedEvent.start, end: selectedEvent.end, available: true })}
              />
            </View>
          </Card>
        ) : null}
      </Container>
    </Dial>
  );
}

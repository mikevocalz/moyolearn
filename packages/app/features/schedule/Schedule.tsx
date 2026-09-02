'use client';
// org.schedule's resource-major calendar — columns are tutors and rooms, never
// clients (doc 36 §3.4's binding orientation, restated in the contract).
//
// The day it draws is STILL the fixture (`schedule/fixtures.ts` — the
// contract's own Status: "real UI on DEMO_DAY fixtures"), so the surface says
// so on itself rather than presenting five invented tutors as an org's roster.
// The label is the ops-overview revenue idiom, and it leaves with the live
// sessions read, not before.
//
// `onNewBooking` is OPTIONAL by type for the same reason: a host that can
// open the booking sheet passes one, and a host that cannot gets a disabled
// control with the reason on screen — never a button that quietly deselects
// an event and calls that a booking.
// SOT: design/screens/org/org.schedule/contract.md · docs/pack/36-role-navigation-flows.md §3.4
// SOT-KEYWORDS: schedule calendar resource major day week booking fixture example data heading
// Mobbin: https://mobbin.com/screens/02f2467d-9239-45da-8747-646d19989917 (Zoho
//   CRM — calendar header: page title on the leading edge, Day/Week segment and
//   the create action on the trailing edge, resource lanes beneath) ·
//   https://mobbin.com/screens/710a5c70-57fb-4177-ad6f-5a1a2e14c397 (Wix Booking
//   Calendar — staff-view columns headed by avatar + name over a time gutter) ·
//   https://mobbin.com/screens/1b3c5a4b-5f4e-4825-a1c1-a3534bdeeec8 (Fresha — a
//   demo resource is marked as demo IN the column header, beside the real ones) ·
//   https://mobbin.com/screens/dcc6b94e-b619-4d43-9149-4e712eca95a3 (Deputy —
//   a standing status strip sits above the grid, in flow, not floating over it).
//   Structure only.
import { View, Text, Pressable } from '@acme/ui/tw';
import { Badge, Button, Card, Container, Dial, EmptyState, Heading, LoadingSkeleton, SegmentedControl, useSizeClass } from '@acme/ui';
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
  /**
   * True when `day` is the built-in fixture rather than an org's real calendar.
   * Drives the on-surface label; a caller reading live sessions passes false.
   */
  exampleData?: boolean;
  onBook: (slot: Slot) => void;
  /**
   * Header action — create a booking outside the slot list. Absent means the
   * host has no booking surface to open, and the control renders disabled with
   * the reason stated, rather than firing at nothing.
   */
  onNewBooking?: () => void;
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
  fill, day, now, loading = false, exampleData = false, onBook, onNewBooking }: ScheduleProps) {
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
          {/*
            A real <h1>. This was a styled <Text>, so /schedule was the one org
            rail destination with NO heading anywhere in its outline — the page
            looked titled and announced as an untitled slab of controls.
          */}
          <Heading level={1} size="title" className="flex-1">
            Today&apos;s Schedule
          </Heading>

          {/* The platform's own segmented control (@expo/ui), not a hand-rolled
              row of pressables — same reasoning as every other native control in
              the kit. */}
          <SegmentedControl options={VIEWS} value={view} onChange={setView} />

          {/*
            A control that works or is honestly shut. `onNewBooking` used to
            default to `() => selectEvent(null)` one level up, so on web the
            primary action of this screen deselected an event and looked like
            it had booked something.
          */}
          <Button
            variant="primary"
            title="New booking"
            disabled={onNewBooking === undefined}
            onPress={onNewBooking}
          />
        </View>

        {/*
          The data label, in flow above the grid (Deputy's standing strip) and
          never floating over it. Five tutors, their portraits and a full day of
          lessons are convincing enough to be read as this org's actual
          Wednesday — which is precisely why it has to say what it is.
        */}
        {exampleData ? (
          <View className="flex-row flex-wrap items-center gap-element">
            <Badge label="Example data" />
            <Text className="text-caption text-text-muted">
              These tutors and lessons are a sample day. Your org&apos;s real calendar appears here
              once sessions are wired to this view.
            </Text>
          </View>
        ) : null}

        {onNewBooking === undefined ? (
          // The disabled control's reason, on screen rather than in a tooltip:
          // an aria-disabled button with no stated cause reads as broken.
          <Text className="text-caption text-text-muted">
            Booking isn&apos;t open on this surface yet — sessions are created from the mobile
            schedule while the write path is being wired.
          </Text>
        ) : null}

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
              {/*
                DECISION — "Edit" is GONE rather than disabled. Its handler was
                an empty body with a `Wave 3` note inside it, so it looked
                pressable, took the press and did nothing; there is no event
                editor anywhere in this feature for it to be shut against, and
                a control with no destination is absence, not a disabled state
                (the Import-button law). It returns with the editor.
              */}
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

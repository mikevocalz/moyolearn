'use client';
// Family calendar — "what's coming up for the family this week, and when is
// each child's next session". A reading surface: the contract's
// `max_interactions_to_primary: 0` means reviewing the week is delivered on
// open, and everything below it is an exit, never an edit.
//
// TWO CHANGES OF SUBSTANCE AGAINST THE PREVIOUS VERSION:
//
//  1. THE RESCHEDULE BUTTON IS GONE. Every reschedulable event drew a live
//     "Request new time" whose handler was empty — a control that looked
//     available, took a press, and did nothing. It is not in the contract's
//     secondary_actions either, and J2 names why: the booking middle
//     (discovery → booking → confirmation) does not exist, so there is no
//     endpoint for it to call. Disabling it with a reason would still promise a
//     capability the product has not got; it is removed, and it returns with
//     the booking flow.
//  2. EVENTS NOW HAVE THE CONTRACT'S EXITS. A calendar of unreachable rows is
//     a wall: `open_child` (the row itself → the child's hub) and
//     `past_event_report` (a finished session → its report) are the two exits
//     the contract names, and both now exist. Future sessions carry no report
//     link, because there is nothing to read yet.
//
// Cool-warm mix: the background is the parent surface and child chips carry the
// accent.
//
//  3. THE SEEDED WEEK IS STRUCK, NOT GUARDED. `FAMILY_DAYS` named Maya and
//     Jordan against four hardcoded dates, so it outlived `family.store` being
//     emptied and showed tutoring to an account with no children — on a week
//     that was not the current one. A `children.length` gate would only have
//     hidden that from the empty account while still lying to a real one. The
//     strip is now the real week from `weekOf()` and the agenda is empty until
//     a guardian-scoped read exists; none of the 55 routes under
//     `apps/web/app/api` projects one.
//
// Mobbin: https://mobbin.com/screens/3a21d1a0-0bec-472b-9c07-8a33dddf45cf
// (Microsoft Outlook — a horizontal week strip above a dated agenda list;
// the selected day is the only date control, and each entry reads as
// time + title + who) ·
// https://mobbin.com/screens/6ab8b275-a280-48a4-bc27-5359722b07da
// (Alan — day strip over a session list where past days are dimmed rather than
// removed, so a week keeps its shape) ·
// https://mobbin.com/screens/6491097a-3861-4c87-ac75-caed6336b83b
// (Greenlight — per-child filter chips leading a family surface, selection
// re-scoping the list beneath) ·
// https://mobbin.com/screens/1ba00325-1eb4-4bae-973c-249c2ff8ab8c
// (SchoolAI — a session row leading with who it is about, its outcome reachable
// from the row rather than a separate destination) ·
// https://mobbin.com/screens/c97c5b47-31cd-4424-b427-2a540705bab4
// (Cleo AI — date-grouped cards each carrying one quiet action, the date line
// beside the content rather than as urgency).
// Structure only. Tones, type ramp and spacing tiers are docs 02/08.
// SOT: design/screens/guardian/guardian.calendar/contract.md · docs/pack/04-screen-briefs.md §S13
// SOT-KEYWORDS: family calendar child chip agenda day strip exits open child past report empty

import { useMemo } from 'react';
import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  FadeIn,
  Heading,
  PressScale,
  Text,
} from '@acme/ui';
import { ArrowRight, CalendarDays } from '@acme/ui/icons';
import { useFamilyStore } from '../family/family.store';
import { weekOf, type FamilyEvent } from './family-calendar.data';
import { useFamilyCalendarStore } from './family-calendar.store';

export function FamilyCalendarContent() {
  const router = useRouter();
  const selectedDayId = useFamilyCalendarStore((s) => s.selectedDayId);
  const selectedChildId = useFamilyCalendarStore((s) => s.selectedChildId);
  const selectDay = useFamilyCalendarStore((s) => s.selectDay);
  const selectChild = useFamilyCalendarStore((s) => s.selectChild);
  // The one child seam (G-8) — the same store the family hub and the switcher
  // write, so "Maya" means the same child here as everywhere else.
  const children = useFamilyStore((s) => s.children);

  // One week per mount. Recomputing on every render would hand `day` a new
  // identity each pass and re-key the whole strip mid-interaction.
  const days = useMemo(() => weekOf(new Date()), []);

  /*
    Opens on TODAY, not on the first day in the strip. The week carries its past
    days so a finished session has somewhere to be read from, and defaulting to
    index 0 would land a parent on Sunday — the contract's question is "what's
    coming up", answered in zero interactions.
  */
  const today = days.find((d) => !d.past) ?? days[0]!;
  const day = days.find((d) => d.id === selectedDayId) ?? today;

  /*
    The filter is DERIVED against the live child list, not read raw from the
    store. `family-calendar.store` has no link to `family.store`, so a child id
    selected before the list changed would otherwise survive it and filter the
    agenda to empty — with the chips that would reset it already hidden by the
    `children.length > 0` gate below. Deriving it means the stale id cannot
    outlive the child.
  */
  const childFilter = children.some((c) => c.id === selectedChildId) ? selectedChildId : null;

  const filtered =
    childFilter === null
      ? day.events
      : day.events.filter((event) => event.childId === childFilter);

  return (
    <View className="gap-7">
      <FadeIn>
        <Section className="gap-1">
          <Heading level={1} size="title">
            Family calendar
          </Heading>
          {/* The Example marker went with the fixture it was admitting to. The
              dates below are the real week, so there is nothing left to disclaim
              here; the agenda's own empty state carries why it is empty. */}
        </Section>
      </FadeIn>

      {/* Child chips — filter, not tabs. Consistent color everywhere. */}
      {children.length > 0 ? (
        <FadeIn delay={80}>
          <View className="flex-row flex-wrap gap-element">
            <PressScale
              className={`min-h-11 justify-center rounded-full border-2 px-3 py-1.5 ${
                childFilter === null
                  ? 'border-border bg-primary'
                  : 'border-border bg-surface-raised'
              }`}
              aria-selected={childFilter === null}
              onPress={() => selectChild(null)}
            >
              <TWText className={childFilter === null ? 'text-on-primary' : 'text-text'}>
                All
              </TWText>
            </PressScale>
            {children.map((child) => {
              const active = childFilter === child.id;
              return (
                <PressScale
                  key={child.id}
                  className={`min-h-11 justify-center rounded-full border-2 px-3 py-1.5 ${
                    active ? 'border-border bg-primary' : 'border-border bg-surface-raised'
                  }`}
                  aria-selected={active}
                  onPress={() => selectChild(child.id)}
                >
                  <TWText className={active ? 'text-on-primary' : 'text-text'}>{child.name}</TWText>
                </PressScale>
              );
            })}
          </View>
        </FadeIn>
      ) : null}

      {/* Day strip */}
      <FadeIn delay={160}>
        <View className="flex-row gap-element">
          {days.map((d) => {
            const active = d.id === day.id;
            return (
              <PressScale
                key={d.id}
                className={`flex-1 items-center gap-1 rounded-card border-2 px-2 py-3 ${
                  active ? 'border-border bg-primary shadow-card' : 'border-border bg-surface-raised'
                }`}
                outerClassName="flex-1"
                aria-label={`${d.label}, ${d.events.length} events`}
                aria-selected={active}
                onPress={() => selectDay(d.id)}
              >
                <TWText className={`text-xs ${active ? 'text-on-primary/80' : 'text-text-muted'}`}>
                  {d.weekday}
                </TWText>
                {/* A past day stays in the strip and recedes — removing it would
                    hide where this week's reports came from, and a week that
                    starts at today reads as a week with a piece cut off. */}
                <TWText
                  className={`text-lg font-bold ${
                    active ? 'text-on-primary' : d.past ? 'text-text-muted' : 'text-text'
                  }`}
                >
                  {d.dayOfMonth}
                </TWText>
              </PressScale>
            );
          })}
        </View>
      </FadeIn>

      {/* Agenda */}
      <FadeIn delay={240}>
        <Section className="gap-stack">
          <Text variant="label" tone="muted">
            {day.label}
          </Text>
          {filtered.length > 0 ? (
            <View className="gap-element">
              {filtered.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  onOpenChild={() => {
                    router.push('/children');
                  }}
                  onOpenReport={
                    event.reportSessionId === null
                      ? null
                      : () => {
                          router.push(`/reports/${event.reportSessionId ?? ''}`);
                        }
                  }
                />
              ))}
            </View>
          ) : (
            /*
              This zero is calm because it is TRUE BY CONSTRUCTION, not because
              a read came back empty. J2 records that the booking middle —
              discovery → booking → confirmation — has no endpoint and no
              collection, so no family can have a session booked and the copy
              may say so without asserting an unverified zero. It deliberately
              does not claim there is no due work: `learner/assignments` holds
              that, and this surface simply cannot ask it guardian-side.
            */
            <EmptyState
              icon={<CalendarDays size={28} className="text-text-muted" />}
              title="Nothing booked this week"
              description={
                childFilter === null
                  ? 'Booking is not switched on yet, so there is nothing to show here. Sessions will appear once it is.'
                  : 'Nothing for this child. Choose All to see the rest of the family.'
              }
              action={
                childFilter === null ? (
                  <Button
                    title="See your children"
                    variant="outline"
                    onPress={() => {
                      router.push('/children');
                    }}
                  />
                ) : (
                  <Button
                    title="Show the whole family"
                    variant="outline"
                    onPress={() => selectChild(null)}
                  />
                )
              }
            />
          )}
        </Section>
      </FadeIn>
    </View>
  );
}

/**
 * One event. The row itself is the contract's `open_child` exit — "open the
 * child behind an event" is the question a parent asks of a calendar row, and
 * making the whole row answer it keeps the target big and the anatomy quiet.
 *
 * The report link renders only when there IS a report (a finished session). A
 * future session carries none, and drawing one would be the dead control this
 * screen just lost, in a new coat.
 */
function EventRow({
  event,
  onOpenChild,
  onOpenReport,
}: {
  event: FamilyEvent;
  onOpenChild: () => void;
  onOpenReport: (() => void) | null;
}) {
  return (
    <Card className="gap-element">
      <PressScale
        onPress={onOpenChild}
        outerClassName="w-full"
        className="w-full flex-row items-center gap-stack"
        aria-label={`${event.title}, ${event.childName}, ${event.timeLabel}`}
      >
        <Avatar name={event.childName} size="sm" />
        <View className="flex-1 gap-0.5">
          <TWText className="text-base font-semibold text-text">{event.title}</TWText>
          <TWText className="text-sm text-text-muted">
            {event.childName} · {event.timeLabel}
          </TWText>
        </View>
        <ArrowRight size={18} className="text-text-muted" />
      </PressScale>
      {onOpenReport !== null ? (
        <Button title="Read the report" variant="ghost" className="self-start" onPress={onOpenReport} />
      ) : null}
    </Card>
  );
}

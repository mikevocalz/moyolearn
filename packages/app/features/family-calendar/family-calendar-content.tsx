'use client';
// Family calendar — where does my family need to be.
//
// Cool-warm mix: the background is the parent surface, child chips carry the
// accent colour specific to each child, and reschedulable events show a warm
// secondary affordance. Reschedule is L1 — no hunting.
// SOT: docs/pack/04-screen-briefs.md §S13
// SOT-KEYWORDS: family calendar child chip agenda reschedule

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Button, Heading, PressScale, Text, FadeIn } from '@acme/ui';
import { CHILDREN } from '../home/parent-home.data';
import { FAMILY_DAYS, type FamilyEvent } from './family-calendar.data';
import { useFamilyCalendarStore } from './family-calendar.store';

export function FamilyCalendarContent() {
  const selectedDayId = useFamilyCalendarStore((s) => s.selectedDayId);
  const selectedChildId = useFamilyCalendarStore((s) => s.selectedChildId);
  const selectDay = useFamilyCalendarStore((s) => s.selectDay);
  const selectChild = useFamilyCalendarStore((s) => s.selectChild);

  const activeDayId = selectedDayId ?? FAMILY_DAYS[0]!.id;
  const day = FAMILY_DAYS.find((d) => d.id === activeDayId) ?? FAMILY_DAYS[0]!;
  const children = CHILDREN;

  const filtered =
    selectedChildId === null
      ? day.events
      : day.events.filter((event) => event.childName === children.find((c) => c.id === selectedChildId)?.name);

  return (
    <View className="gap-7">
      <FadeIn>
        <Heading level={1} size="title">
          Family calendar
        </Heading>
      </FadeIn>

      {/* Child chips — filter, not tabs. Consistent color everywhere. */}
      {children.length > 0 ? (
        <FadeIn delay={80}>
          <View className="flex-row flex-wrap gap-element">
            <PressScale
              className={`rounded-full border-2 px-3 py-1.5 ${
                selectedChildId === null
                  ? 'border-border bg-primary'
                  : 'border-border bg-surface-raised'
              }`}
              onPress={() => selectChild(null)}
            >
              <TWText className={selectedChildId === null ? 'text-on-primary' : 'text-text'}>All</TWText>
            </PressScale>
            {children.map((child) => {
              const active = selectedChildId === child.id;
              return (
                <PressScale
                  key={child.id}
                  className={`rounded-full border-2 px-3 py-1.5 ${
                    active ? 'border-border bg-primary' : 'border-border bg-surface-raised'
                  }`}
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
          {FAMILY_DAYS.map((d) => {
            const active = d.id === activeDayId;
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
                <TWText className={`text-lg font-bold ${active ? 'text-on-primary' : 'text-text'}`}>
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
          <Text variant="label" tone="muted">{day.label}</Text>
          {filtered.length > 0 ? (
            <View className="gap-element">
              {filtered.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </View>
          ) : (
            <TWText className="text-body text-text-muted">No family events on this day.</TWText>
          )}
        </Section>
      </FadeIn>
    </View>
  );
}

function EventRow({ event }: { event: FamilyEvent }) {
  return (
    <View className="w-full gap-element rounded-card border-2 border-border bg-surface-raised p-3 shadow-card">
      <View className="flex-row items-center gap-stack">
        <Avatar name={event.childName} size="sm" />
        <View className="flex-1 gap-0.5">
          <TWText className="text-base font-semibold text-text">{event.title}</TWText>
          <TWText className="text-sm text-text-muted">{event.timeLabel}</TWText>
        </View>
      </View>
      {event.reschedulable ? (
        <View className="flex-row gap-element">
          <Button
            variant="outline"
            title={event.requiresApproval ? 'Request new time' : 'Reschedule'}
            onPress={() => { /* Wave 3: reschedule flow */ }}
          />
        </View>
      ) : null}
    </View>
  );
}

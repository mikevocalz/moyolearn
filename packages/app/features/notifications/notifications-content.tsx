'use client';
// The org Inbox surface (unread header + mark-all, Today/Earlier groups,
// icon-well rows) with Legend Motion. A row is a DOOR: pressing it marks the
// item read and opens the exit where it is handled (org.inbox contract — every
// item carries an action target; triage happens on the schedule/CRM surface,
// never in the list).
//
// The items are the store's SEED until the server wiring lands (its own header
// records the gap). Named families with timestamps and unread dots are the most
// believable copy on any surface — "the Chen family asked to move Thursday
// 4:00pm" is a fact an owner would act on — so the surface labels them rather
// than letting a dev fixture pass for the day's inbound. The label is the
// ops-overview revenue idiom and it leaves with the seed.
// SOT: design/screens/org/org.inbox/contract.md
// SOT-KEYWORDS: org inbox notifications content rows groups unread exit door example data seed
// Mobbin: https://mobbin.com/screens/8551be3e-e992-4933-bde7-64f6a2c6c3c8 (Asana
//   Inbox — date bands label runs of rows: Today, Yesterday, Past 7 days) ·
//   https://mobbin.com/screens/2e7cf2ed-0d26-4544-93c4-4a7b6cba2e8d (GitHub
//   Notifications — unread dot on the leading edge, relative time trailing) ·
//   https://mobbin.com/screens/a2b51485-af81-4c80-8f06-b357e0fe5bda (Wrike —
//   an explanatory panel rides IN the inbox list, in flow with the items it
//   describes, rather than floating over them) ·
//   https://mobbin.com/screens/bc218968-834c-4ea7-b237-23075dd901c0 (Steep —
//   a standing "using demo data" notice names the source of what is on screen).
//   Structure only.
import { formatDistanceToNow, isToday } from 'date-fns';
import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText, Pressable } from '@acme/ui/tw';
import { Badge, Heading, Text, FadeIn, EmptyState } from '@acme/ui';
import { Bell } from '@acme/ui/icons';
import { WELL, INK } from '../home/home.data';
import { useNotifications, type Notification } from './notifications.store';

function NotificationRow({ item, index }: { item: Notification; index: number }) {
  const markRead = useNotifications((s) => s.markRead);
  const router = useRouter();
  return (
    <FadeIn delay={80 + index * 45}>
      <Pressable
        aria-label={`${item.title} — open where it’s handled`}
        onPress={() => {
          markRead(item.id);
          router.push(item.href);
        }}
        className={`flex-row items-start gap-stack px-4 py-3.5 transition-colors duration-fast hover:bg-surface-sunken ${
          item.read ? '' : 'bg-primary/5'
        }`}
      >
        <View className={`h-10 w-10 items-center justify-center rounded-xl ${WELL[item.tone]}`}>
          <item.icon size={18} className={INK[item.tone]} />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-element">
            <TWText className={`flex-1 text-sm text-text ${item.read ? 'font-medium' : 'font-bold'}`}>
              {item.title}
            </TWText>
            {!item.read ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
          </View>
          <Text variant="caption" tone="muted">{item.body}</Text>
          <Text variant="caption" tone="muted" className="text-[11px]">
            {formatDistanceToNow(item.at, { addSuffix: true })}
          </Text>
        </View>
      </Pressable>
    </FadeIn>
  );
}

function Group({ label, items, offset }: { label: string; items: Notification[]; offset: number }) {
  if (!items.length) return null;
  return (
    <Section className="gap-element">
      <Text variant="label" tone="muted">{label}</Text>
      <View className="overflow-hidden rounded-card border-2 border-border bg-surface-raised shadow-card">
        {items.map((item, i) => (
          <View key={item.id} className={i > 0 ? 'border-t-2 border-border' : ''}>
            <NotificationRow item={item} index={offset + i} />
          </View>
        ))}
      </View>
    </Section>
  );
}

export function NotificationsContent({ title = 'Notifications' }: { readonly title?: string }) {
  const items = useNotifications((s) => s.items);
  const markAllRead = useNotifications((s) => s.markAllRead);
  const unread = items.filter((n) => !n.read).length;
  // Real date groups — the old slice(0, 3) split was a lie that happened to
  // match the seed's shape; anything that arrived yesterday-but-early-in-the-
  // array would have been labelled "Today".
  const today = items.filter((n) => isToday(n.at));
  const earlier = items.filter((n) => !isToday(n.at));

  return (
    <View className="gap-group md:gap-10 lg:gap-12">
      <FadeIn>
        <Section className="flex-row items-end justify-between gap-stack">
          <View className="gap-0.5">
            <Heading level={1} size="display-sm">{title}</Heading>
            {unread > 0 ? <Text variant="caption" tone="muted">{unread} unread</Text> : null}
          </View>
          {unread > 0 ? (
            <Pressable
              role="button"
              aria-label="Mark all notifications read"
              onPress={markAllRead}
              className="rounded-md border-2 border-border-strong bg-primary px-3.5 py-2 shadow-card transition-all duration-fast hover:bg-primary-pressed active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
            >
              <TWText className="text-sm font-semibold text-on-primary">Mark all read</TWText>
            </Pressable>
          ) : null}
        </Section>
      </FadeIn>

      {items.length === 0 ? (
        // The heading used to sit over pure whitespace when the list was
        // empty — an unnamed state. Name it, calmly.
        <EmptyState
          icon={<Bell size={28} className="text-text-muted" />}
          title="You're all caught up"
          description="Nothing new right now. New activity shows up here as it happens."
        />
      ) : (
        <>
          {/*
            In flow above the first band (Wrike's in-list panel), not floating
            over the rows and not a dismissible toast: the caveat has to be
            readable at the same moment as the item it qualifies.
          */}
          <View className="flex-row flex-wrap items-center gap-element">
            <Badge label="Example data" />
            <Text variant="caption" tone="muted">
              These are sample items shaped like real inbound work. Your org&apos;s inbox appears
              here once the feed is wired.
            </Text>
          </View>
          <Group label="Today" items={today} offset={0} />
          <Group label="Earlier" items={earlier} offset={today.length} />
        </>
      )}
    </View>
  );
}

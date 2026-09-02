'use client';
// The ops Overview — Cool dial, doc 02 archetype D (Feed) at ops density.
//
// This is a FIRST-PARTY surface, deliberately not the Payload admin. Payload's
// panel is a CMS shell: its templates, list views and login are fixed, so
// theming it yields "Payload in Moyo colours" and never a product screen. The
// CMS stays for content editors; the business runs here.
//
// The Pipeline region — table, toolbar, filters, pager — moved WHOLE to
// leads-content.tsx when doc 36 §3.4's CRM rail group split the /ops blob.
// What remains is what an Overview is for: the greeting, today's sessions,
// and the month's numbers. The pipeline read here is stats-only (limit 1),
// because `statsFor` computes over the WHOLE org, never the visible page.
// SOT: docs/pack/28-crm-spec.md · docs/pack/08-visual-hierarchy-spacing-spec.md §5
// SOT-KEYWORDS: ops dashboard overview today sessions revenue hero attention stats
// Mobbin: https://mobbin.com/screens/7edb1dcf-9015-471a-8625-11a0f51767d7 (Uxcel —
//   page header with a greeting line above the controls, not beside them) ·
//   https://mobbin.com/screens/f703018d-c080-4aca-acdc-b555ed2e5f97 (Hootsuite —
//   one dominant panel, supporting stats demoted underneath it) ·
//   https://mobbin.com/screens/5ee90a6f-5d97-495c-ad2a-d3dd74ab8b7d (Rocket Money
//   — phone card: identity left, headline figure right, labelled facts beneath)
import { useRouter } from 'solito/navigation';
import { Badge, Banner, Button, EmptyState, LoadingSkeleton, ScheduleCard, StatCard, TrendLine } from '@acme/ui';
import { Text, View } from '@acme/ui/primitives';
import type { Session } from './ops.data';
import type { TrendPoint } from '@acme/ui';
import { useLeads } from './use-leads';
import { leadsRootPath } from './ops-paths';
import { GUTTER, SectionHeader } from './leads-content';

/** Stats-only view of the pipeline: one row of transfer, org-wide statistics. */
const STATS_VIEW = { q: '', onlyAttention: false, sortDesc: false, limit: 1 } as const;

export interface OpsDashboardContentProps {
  /** "Tuesday, 26 August" — computed by the caller so this stays pure. */
  today: string;
  operatorName: string;
  /*
    Sessions and revenue arrive as PROPS rather than as module imports, because
    they are now per-district. Importing a constant would have hard-wired this
    screen to one tenant — the same mistake as the org name that used to be typed
    into the sidebar — and a component that reaches for its own data cannot be
    rendered for a second district, or in a story, or in a test.
  */
  sessions: readonly Session[];
  /*
    The read's OWN state, threaded from useSessions rather than discarded at
    the screen boundary: this surface used to render a failed fetch as a calm
    "0 sessions" day, which is the exact lie org-safety's Body is written
    against — "no sessions" and "we could not check" are different sentences.
  */
  sessionsStatus: 'loading' | 'error' | 'ready';
  revenue: readonly TrendPoint[];
}

export function OpsDashboardContent({
  today,
  operatorName,
  sessions,
  sessionsStatus,
  revenue,
}: OpsDashboardContentProps) {
  const router = useRouter();
  /*
    The dedicated stats read. `statsFor` in the service computes over every row
    in the org regardless of the page, so `limit: 1` buys the headline numbers
    without pulling a page of rows this screen no longer renders.
  */
  const { page } = useLeads(STATS_VIEW);
  const stats = page?.stats;

  /*
    Greeting by clock, not by hope. It said "Good morning" at every hour, which
    is the kind of small lie that tells someone the screen is not really looking
    at them.
  */
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  /*
    The end of the last session, taken from the schedule rather than asserted.
    Times arrive as "09:00–09:45", so the half after the en dash is the end.
  */
  const lastSessionEnds =
    sessions.length > 0
      ? (sessions[sessions.length - 1]!.time.split('–')[1] ?? '').trim() || 'the end of the day'
      : '';

  return (
    <View className={`gap-section ${GUTTER}`}>
      {/*
        PAGE HEADER. The old screen opened on a bare 20px "Today" and three
        identical cards, which is why it read as boring: nothing on the page was
        allowed to be big, so nothing was first. The greeting is this screen's
        one display moment, the eyebrow dates it, and the line underneath says
        what to do — three type tiers before any data appears. The old "Add
        lead" and "Import" buttons left with the pipeline: creating a lead is
        the Leads page's job now, and Import had no backend to be honest about.
      */}
      <View className="gap-stack">
        <Text className="font-mono text-caption uppercase tracking-wide text-text-muted">
          {today}
        </Text>
        <Text className="font-display text-display-sm text-text">
          {greeting}, {operatorName}
        </Text>
        <Text className="text-body-lg text-text-muted">
          {/*
            "before 5pm" was typed, and the last session in the seed starts at
            16:30 — so on any day the schedule ran late the sentence was simply
            wrong. It reads the last session now, and drops the clause entirely
            when there are none rather than claiming a deadline for an empty day.
          */}
          {stats?.needsAttention ?? 0} families need a decision today
          {/* The session clause only speaks when the read succeeded — a loading
              or failed read must not narrate a schedule it does not have. */}
          {sessionsStatus === 'ready' && sessions.length > 0 ? `, and ${sessions.length} ${sessions.length === 1 ? 'session runs' : 'sessions run'} before ${lastSessionEnds}.` : '.'}
        </Text>
      </View>

      {/*
        HERO. Two-thirds / one-third, NOT a row of equal cards — a strip of
        identical tiles is what "no hierarchy" looks like, and the schedule is
        the thing an ops lead actually opens this screen for at 9am. The numbers
        support it from the side rather than competing across the top.
      */}
      <View className="flex-col gap-stack xl:flex-row xl:items-start">
        <View className="min-w-0 flex-1 gap-stack xl:flex-[2]">
          <SectionHeader
            title="Today's sessions"
            /* The count chip speaks only for a settled read — a "0" chip over a
               failed or in-flight fetch is the calm-zero lie in miniature. */
            count={sessionsStatus === 'ready' ? String(sessions.length) : undefined}
          />
          {sessionsStatus === 'error' ? (
            /*
              A failed read states itself. With cached rows below it the list is
              STALE (Query keeps the last success on a refetch failure); with
              nothing cached the banner is the whole answer — never the calm
              empty day.
            */
            <Banner
              tone="warning"
              title={sessions.length > 0 ? "Today's schedule may be stale" : "Couldn't load today's sessions"}
              description={
                sessions.length > 0
                  ? 'The last read failed — these sessions are from the previous sync.'
                  : 'The read failed, so an empty list here means unknown, not a clear day. Try again in a moment.'
              }
            />
          ) : null}
          {sessionsStatus === 'loading' ? (
            <LoadingSkeleton variant="card" count={2} />
          ) : sessionsStatus === 'ready' && sessions.length === 0 ? (
            /* The contract's clean day (org.overview no_data): "Nothing needs
               you", with live exits to the schedule and the pipeline — a calm
               state, not a dead end. */
            <EmptyState
              icon={<Text className="text-title">✓</Text>}
              title="Nothing needs you"
              description="No sessions run today and nothing is waiting on a decision here."
              action={
                <View className="flex-row flex-wrap gap-element">
                  <Button
                    title="Open the schedule"
                    variant="outline"
                    onPress={() => router.push('/schedule')}
                  />
                  <Button
                    title="Open the pipeline"
                    variant="outline"
                    onPress={() => router.push(leadsRootPath())}
                  />
                </View>
              }
            />
          ) : (
            <View className="gap-stack">
              {sessions.map((session) => (
                <ScheduleCard
                  key={session.id}
                  time={session.time}
                  title={session.learner}
                  meta={[`${session.subject} · ${session.tutor}`]}
                  mode={session.mode}
                  status={session.needsAttention ? 'attention' : 'default'}
                  /*
                    `secondaryAction`, so the card's button renders outline. A
                    primary here would put three yellow buttons down the hero and
                    spend the screen's single accent (§3.2) three times over —
                    the accent belongs to the one thing that needs a decision.

                    It opens the org schedule: no per-session detail route exists
                    yet, so the door opens the day the session lives on rather
                    than doing nothing (the dead onPress this replaces) — the
                    Import-button law says a control either works or is absent.
                  */
                  secondaryAction={{ label: 'Open session', onPress: () => router.push('/schedule') }}
                />
              ))}
            </View>
          )}
        </View>

        <View className="gap-stack xl:flex-1">
          <SectionHeader title="This month" />
          {/*
            The chart panel carries the headline number in its own header, so the
            plot needs no value labels — Whop's arrangement. It sits with the
            stats rather than beside the schedule because revenue is context for
            the month, not a thing to act on before 5pm.
          */}
          <View className="gap-stack rounded-card border-2 border-border bg-surface-raised p-inset shadow-card">
            {/* REVENUE_BY_ORG is still a fixture (its own comment records why —
                doc 19 §5's rollups do not exist), so the panel says so with the
                EXAMPLE_LEADS labelling idiom rather than rendering copy as
                real money. The label leaves with the rollup read. */}
            <View className="self-start">
              <Badge label="Example data" />
            </View>
            <TrendLine
              data={revenue}
              title={`Invoiced · ${revenue.length} months`}
              height={120}
              // 'en-US' pinned, not the ambient locale: the server and the browser can
              // resolve a bare toLocaleString() differently, and a number that
              // formats one way in the HTML and another after hydration is a
              // mismatch React cannot patch.
              format={(v) => `$${v.toLocaleString('en-US')}`}
            />
          </View>
          {/*
            Both were literals — "38" and "61%" with a hand-typed "−4 pts vs
            July" beneath. Nothing computed them, so they said the same thing for
            every district and every month, and the trend arrow pointed down at a
            decline that had never happened. They are counted from the pipeline
            now, org-wide rather than page-wide.

            No trend line on either: a delta needs last month's number, and the
            rollup tables that would hold it (doc 28 §7 → doc 19) do not exist.
            An honest number with no arrow beats an invented arrow.
          */}
          <StatCard
            size="lg"
            value={String(stats?.sessionsDelivered ?? 0)}
            label="Sessions delivered"
          />
          <StatCard
            size="lg"
            value={stats?.trialConversionPct == null ? '—' : `${stats.trialConversionPct}%`}
            label="Trial conversion"
          />
        </View>
      </View>
    </View>
  );
}

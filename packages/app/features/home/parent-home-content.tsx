'use client';
// Parent home (guardian.home) — "are my kids okay, what's new, what's coming
// up". The guardian shell's landing feed.
//
// WHAT THIS PASS CHANGED, against the contract:
//
//  · THE CHILD SWITCHER IS MOUNTED. `ChildSwitcher` was built, exported and
//    rendered on exactly zero surfaces, so G-8's "one seam for which child am I
//    looking at" existed in the store and nowhere on screen. The contract names
//    it a secondary action of THIS screen; it now leads the feed and scopes the
//    sections under it.
//  · THE PRIMARY ACTION EXISTS AND IS REAL. "Open the newest report" is the
//    contract's primary_action and there was no report anywhere on this screen.
//    It reads `useGuardianReports` — a live read, so the card carries all its
//    states: skeleton while it lands, an honest failure with a retry if it does
//    not, the "waiting for the first session" state ONLY when the read answered
//    zero, and the report itself otherwise.
//  · THE EXITS EXIST. `all_reports`, `see_upcoming`, `manage_child` and
//    `incident_banner` are the contract's exits; the screen had none of them.
//    Every child card and every section now leads somewhere that resolves.
//  · THE DEAD ROWS AND THE RED ARE GONE. See parent-home.data.ts for the
//    struck "Action needed" queue and the danger-toned "Needs attention" list,
//    and why neither returns in that shape.
//
// Mobbin: https://mobbin.com/screens/6491097a-3861-4c87-ac75-caed6336b83b
// (Greenlight — a parent home leading with a horizontal child chip row, the
// selection scoping every section beneath it) ·
// https://mobbin.com/screens/96c15ebb-251f-4261-b474-b4cf3c74d36a
// (Acorns — one account, a switcher pinned at the top of home, sections below
// re-scoping rather than a per-child login) ·
// https://mobbin.com/screens/1ba00325-1eb4-4bae-973c-249c2ff8ab8c
// (SchoolAI — the newest session's headline sentence as the lead card, the
// full report one press away) ·
// https://mobbin.com/screens/77482a04-a3e4-4978-9ab6-1cbeeb89f667
// (Tana — dated entries in one reading column, title first, in a feed of
// mixed section types).
// Structure only. Tones, type ramp and spacing tiers are docs 02/08.
// SOT: design/screens/guardian/guardian.home/contract.md · docs/pack/04-screen-briefs.md §S11
// SOT-KEYWORDS: parent home guardian feed child switcher newest report upcoming exits calendar alerts

import { ArrowRight } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Dial,
  FadeIn,
  Heading,
  LoadingSkeleton,
  PressScale,
  ReadFailure,
  Text,
} from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { useAppSession } from '../../providers/session';
import { ChildSwitcher } from '../family/child-switcher';
import { useFamilyStore } from '../family/family.store';
import { useGuardianReports } from '../summary/use-reports';
import { readFailureCopy } from '../../core/read-failure-copy';
import { THIS_WEEK, UPCOMING } from './parent-home.data';

export function ParentHomeContent() {
  const { user } = useAppSession();
  const router = useRouter();
  const name = user?.name?.split(' ')[0] ?? 'there';
  // The children seam, not the fixture — this screen shares `family.store` with
  // the hub and the switcher, so a selection made anywhere means one child.
  const children = useFamilyStore((s) => s.children);
  const selectLearner = useFamilyStore((s) => s.selectLearner);

  return (
    <Dial temperature="cool" className="gap-7">
      <FadeIn>
        <Section className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">Hi</Text>
          <Heading level={1} size="title">
            {name}
          </Heading>
        </Section>
        <TWText className="text-label text-grade">Example family</TWText>
      </FadeIn>

      {/* Doc 36 §3.2's child-switcher chips, on the screen the contract puts
          them on. Renders nothing for a one-child family (its own rule). */}
      <FadeIn delay={40}>
        <ChildSwitcher />
      </FadeIn>

      <FadeIn delay={80}>
        <NewestReport />
      </FadeIn>

      {/* Child summary cards — the contract's `manage_child` exit. They used to
          push /ai-activity, which is one permission screen rather than the
          child's hub; the hub is where every control and every other per-child
          surface is reachable from. */}
      <FadeIn delay={160}>
        <Section className="gap-stack">
          <Text variant="label" tone="muted">Your children</Text>
          <View className="gap-element">
            {children.map((child) => (
              <PressScale
                key={child.id}
                className="w-full rounded-card border-2 border-border bg-surface-raised p-4 shadow-card"
                outerClassName="w-full"
                aria-label={`${child.name}, ${child.gradeBand}, ${child.status}`}
                onPress={() => {
                  selectLearner(child.id);
                  router.push('/children');
                }}
              >
                <View className="flex-row items-center gap-stack">
                  <Avatar name={child.name} size="md" />
                  <View className="flex-1 gap-0.5">
                    <TWText className="text-base font-semibold text-text">{child.name}</TWText>
                    <TWText className="text-sm text-text-muted">
                      {child.gradeBand} · {child.status}
                    </TWText>
                  </View>
                  <ArrowRight size={18} className="text-text-muted" />
                </View>
              </PressScale>
            ))}
          </View>
        </Section>
      </FadeIn>

      {/* This week */}
      <FadeIn delay={240}>
        <Card className="gap-stack">
          <Text variant="label" tone="muted">This week</Text>
          <View className="flex-row gap-element">
            <Stat value={THIS_WEEK.sessions} label="Sessions" />
            <Stat value={THIS_WEEK.assignments} label="Assignments" />
            <Stat value={THIS_WEEK.aiPractice} label="AI practice" />
          </View>
        </Card>
      </FadeIn>

      {/* Upcoming — the contract's `see_upcoming` exit, which did not exist:
          the list was five unreachable rows with the calendar two navigations
          away. Neutral tone throughout; nothing here is late, and a family
          schedule is not a to-do list. */}
      <FadeIn delay={320}>
        <Section className="gap-stack">
          <Text variant="label" tone="muted">Upcoming</Text>
          <View className="gap-element">
            {UPCOMING.map((item) => (
              <View
                key={item.id}
                className="rounded-card border-2 border-border bg-surface-raised p-3"
              >
                <View className="flex-row items-center justify-between gap-stack">
                  <TWText className="flex-1 text-base text-text">{item.title}</TWText>
                  <TWText className="text-sm text-text-muted">{item.time}</TWText>
                </View>
              </View>
            ))}
          </View>
          <Button
            title="See the week"
            variant="outline"
            className="self-start"
            onPress={() => {
              router.push('/calendar');
            }}
          />
        </Section>
      </FadeIn>

      {/*
        The contract's `incident_banner` exit, standing rather than firing: no
        incident is being announced here (that is doc 31's channel and it
        renders ON guardian.alerts), so this is a quiet pointer at where serious
        things would appear — neutral tone, no count, no bell.
      */}
      <FadeIn delay={400}>
        <Card className="flex-row flex-wrap items-center justify-between gap-stack">
          <View className="flex-1 gap-0.5">
            <TWText className="text-base font-semibold text-text">Safety alerts</TWText>
            <TWText className="text-sm text-text-muted">
              If anything serious happens in a session, it appears in Alerts first.
            </TWText>
          </View>
          <Button
            title="Open Alerts"
            variant="ghost"
            onPress={() => {
              router.push('/alerts');
            }}
          />
        </Card>
      </FadeIn>
    </Dial>
  );
}

/**
 * The contract's primary action, delivered in one press: the newest published
 * report, opening its detail.
 *
 * All six states live here because this is the screen's only live read. The one
 * that used to be missing everywhere is the split at the bottom: "waiting for
 * the first session" is a claim about a child's history and may only be made
 * about an ANSWERED read, so a failure takes the branch above it. A parent
 * whose child had a session yesterday must never be told there has not been
 * one because a fetch failed.
 */
function NewestReport() {
  const router = useRouter();
  const { reports, loading, error, retry } = useGuardianReports();
  const newest = reports[0];

  if (loading) {
    return <LoadingSkeleton variant="card" count={1} />;
  }

  if (error !== null && newest === undefined) {
    const copy = readFailureCopy(
      error,
      'your newest report',
      'Nothing has changed — every report your family has is still on file.',
    );
    return (
      <ReadFailure
        title={copy.title}
        description={copy.description}
        onRetry={retry}
        action={
          copy.signedOut ? (
            <Button
              title="Sign in"
              onPress={() => {
                router.push('/login');
              }}
            />
          ) : undefined
        }
      />
    );
  }

  if (newest === undefined) {
    return (
      <Card className="gap-stack">
        <Text variant="label" tone="muted">Newest report</Text>
        <TWText className="text-base text-text">Waiting for the first session</TWText>
        <TWText className="text-sm text-text-muted">
          After a tutoring session ends, what happened in it — and the work to show for it —
          lands here.
        </TWText>
        <Button
          title="See your children"
          variant="outline"
          className="self-start"
          onPress={() => {
            router.push('/children');
          }}
        />
      </Card>
    );
  }

  return (
    <View className="gap-element">
      {/* Cached list, labelled — the contract's offline path. It says "saved"
          only because a saved report is genuinely on screen beneath it. */}
      {error !== null ? (
        <Banner
          tone="offline"
          title="Showing your last saved report"
          description="We couldn’t reach the server just now, so a newer session may be missing."
          action={{ label: 'Try again', onPress: retry }}
        />
      ) : null}
      <Card className="gap-stack">
        <Text variant="label" tone="muted">Newest report</Text>
        <TWText className="text-base font-semibold text-text">{newest.headline}</TWText>
        <View className="flex-row flex-wrap items-center gap-stack">
          <Button
            title="Read it"
            onPress={() => {
              router.push(`/reports/${newest.sessionId}`);
            }}
          />
          {/* The contract's `all_reports` exit, beside the primary rather than
              competing with it. */}
          <Button
            title="All reports"
            variant="ghost"
            onPress={() => {
              router.push('/reports');
            }}
          />
        </View>
      </Card>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="min-w-24 flex-1 gap-1 rounded-card border-2 border-border bg-surface-raised p-3 text-center">
      <TWText className="font-display text-2xl font-bold text-text">{value}</TWText>
      <TWText className="text-sm text-text-muted">{label}</TWText>
    </View>
  );
}

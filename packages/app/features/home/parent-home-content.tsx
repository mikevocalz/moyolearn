'use client';
// Parent home (guardian.home) — "are my kids okay, what's new, what's coming up".
// The guardian shell's landing feed.
//
// The screen shows one thing that is true and links to the rest. The newest
// published report is a live read (`useGuardianReports`), so it carries all its
// states: a skeleton while it lands, an honest failure with a retry if it does
// not, a "waiting for the first session" card only when the read answered zero,
// and the report otherwise. That card is the contract's primary_action, one tap
// from launch.
//
// Everything else on this screen is an exit to a real route. It is deliberately
// not a summary: the per-child cards, the week's counts and the upcoming list
// were fixtures, and a parent reading invented facts about their own child is a
// worse screen than one that says less. The comment on each removal names the
// read it is waiting for.
//
// No role accent renders here. `tooling/check-role-accent.mjs` does not
// allowlist this file, and a status band is not one of the allowlisted slots
// (docs/design/reset/02-binding-constraints.md §2.2), so a band that wanted the
// accent would need an ADR naming the slot. Distinction comes from ink borders,
// the card shadow, and the doc 34 schoolhouse marks instead, which carry no
// accent load.
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
import { useGuardianReports } from '../summary/use-reports';
import { readFailureCopy } from '../../core/read-failure-copy';

export function ParentHomeContent() {
  const { user } = useAppSession();
  const router = useRouter();
  const name = user?.name?.split(' ')[0] ?? 'there';
  // The children seam, not the fixture — this screen shares `family.store` with
  // the hub and the switcher, so a selection made anywhere means one child.

  return (
    <Dial temperature="cool" className="gap-7">
      <FadeIn>
        <Section className="flex-row flex-wrap items-baseline gap-x-2">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">Hi</Text>
          <Heading level={1} size="title">
            {name}
          </Heading>
        </Section>
      </FadeIn>

      {/*
        The child-switcher chips are doc 36 §3.2's, and they are not rendered
        here yet, because they would name the same fixture children the cards
        below used to. `guardian.home/contract.md` records why: "Child switching
        does not exist (G-8): `ActiveContext.learnerId` is never set", and
        `family.store` is marked `[add]`. Chips that switch nothing, labelled
        with names nobody has, are two fictions rather than one.

        `ChildSwitcher` itself is fine and stays in the kit with its stories.
        It returns here when `family.store` is fed by a real children read.
      */}

      <FadeIn delay={80}>
        <NewestReport />
      </FadeIn>

      {/*
        The children exit, without inventing the children.

        This section used to render a card per child with a name, a grade band
        and a status string, all of it from the CHILDREN fixture in
        parent-home.data.ts — `setChildren` is never called from anywhere, so
        nothing real ever reached it. A parent reading their own child's name
        and "status" off a fixture is being told something about their child
        that is not true, which is worse than a screen that says less.

        Two more sections went with it for the same reason: "This week" showed
        THIS_WEEK's session, assignment and AI-practice counts, and "Upcoming"
        showed the UPCOMING list. Both are numbers a parent reads as their
        child's actual week.

        The exits survive because they are real routes with real screens behind
        them. What is gone is the fabricated summary in front of them. Each
        section returns when it has a read: per-child status needs a guardian
        learner read (`/api/family/learners` is POST-only today), and the week
        counts need an aggregate nobody exposes.
      */}
      <FadeIn delay={160}>
        <Section className="gap-stack">
          <Text variant="label" tone="muted">Your family</Text>
          <PressScale
            className="w-full rounded-card border-2 border-border bg-surface-raised p-4 shadow-card"
            outerClassName="w-full"
            aria-label="Open your children"
            onPress={() => router.push('/children')}
          >
            <View className="flex-row items-center gap-stack">
              <View className="flex-1 gap-0.5">
                <TWText className="text-base font-semibold text-text">Your children</TWText>
                <TWText className="text-sm text-text-muted">
                  Settings, controls and each child&apos;s activity.
                </TWText>
              </View>
              <ArrowRight size={18} className="text-text-muted" />
            </View>
          </PressScale>
          <PressScale
            className="w-full rounded-card border-2 border-border bg-surface-raised p-4 shadow-card"
            outerClassName="w-full"
            aria-label="Open the week"
            onPress={() => router.push('/calendar')}
          >
            <View className="flex-row items-center gap-stack">
              <View className="flex-1 gap-0.5">
                <TWText className="text-base font-semibold text-text">The week</TWText>
                <TWText className="text-sm text-text-muted">Sessions and what is booked.</TWText>
              </View>
              <ArrowRight size={18} className="text-text-muted" />
            </View>
          </PressScale>
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


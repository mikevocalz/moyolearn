'use client';
// My Stuff — the practice hub, and the resting state of `learner.stuff`.
//
// This route used to open straight into the player, so the screen answered
// neither of the contract's 5-second questions: a child could not see what was
// theirs to practise, could not see what they had already done, and every band
// got the same three quadratics — a six-year-old's My Stuff tab opened on
// "Factor: x² + 5x + 6". The hub is the answer to both questions; the player is
// a mode inside it, and finished sets return here (`completion_returns_to:
// self`).
//
// One primary action, per the contract: the first unfinished set is a filled
// card, everything else stays on paper. Snap is the single secondary. There is
// no count, no streak and no "keep it up" anywhere — finished work gets a mark
// and nothing else, because a completion total aimed at a child is the
// engagement mechanic the children's-surfaces law bans (PRD non-goal 7).
//
// Mobbin: mobbin.com/screens/51cf207f-2687-4e65-a71b-28d17cfc8ebd (Mimo "Past
// Topics" — practice rows carrying their own completion mark, so done and
// to-do read as one list rather than two screens) ·
// mobbin.com/screens/e2e48fe1-3128-4f46-bfc0-fedb163d7987 (Duolingo — a single
// filled lead card above a quiet "Your library", which is the one-primary
// shape) ·
// mobbin.com/screens/79b60f59-c5a4-4a75-9123-d8629ca1516b (GoHenry "Money
// basics" — child-sized rows, art left, two lines of text right, nothing else
// competing) ·
// mobbin.com/screens/32da9e8a-293b-4797-9b3a-752a60aaf793 (Vocabulary
// "Practice" — a lead status block, then labelled groups of sets) ·
// mobbin.com/screens/1699f458-c7e7-4bb8-bdd1-47519ce9e340 (Headway Library —
// section label above the set list, with the finished group kept separate).
// Structure only. Type ramp, targets, dial and spacing are docs 02/08.
// SOT: design/screens/learner/learner.stuff/contract.md · docs/pack/04-screen-briefs.md §S10
// SOT-KEYWORDS: practice hub my stuff learner stuff sets finished band young child empty offline start

import { Check, Play, Star } from '@acme/ui/icons';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Banner, Button, EmptyState, FadeIn, Heading, LoadingSkeleton, PressScale, Text } from '@acme/ui';
import { useRouter } from 'solito/navigation';
import { bandScaleFor, type AgeBand } from '../capture/age-band';
import { useIsOnline } from '../../core/use-is-online.ts';
import { practiceHubCopyFor, practiceSetsForBand, type PracticeSet } from './practice.data';
import { usePracticeStore } from './practice.store';

export interface PracticeHubProps {
  ageBand: AgeBand;
  /** The session is still resolving, so the BAND is unknown — see the skeleton. */
  loading: boolean;
}

export function PracticeHub({ ageBand, loading }: PracticeHubProps) {
  const scale = bandScaleFor(ageBand);
  const copy = practiceHubCopyFor(ageBand);
  const router = useRouter();
  const online = useIsOnline();
  const openSet = usePracticeStore((s) => s.openSet);
  const finishedSetIds = usePracticeStore((s) => s.finishedSetIds);

  const sets = practiceSetsForBand(ageBand);
  const finished = sets.filter((set) => finishedSetIds.includes(set.id));
  const todo = sets.filter((set) => !finishedSetIds.includes(set.id));
  // The primary is the first thing not yet done; once everything is done the
  // top of the list becomes the primary again, so the screen never loses its
  // one action (`max_interactions_to_primary: 1`).
  const lead = todo[0] ?? sets[0];
  const rest = lead ? sets.filter((set) => set.id !== lead.id && !finishedSetIds.includes(set.id)) : [];

  return (
    <View className={scale.gap}>
      <FadeIn>
        <Section className="gap-element">
          <Heading level={1} size={scale.title}>
            {copy.title}
          </Heading>
          <Text tone="muted" className={scale.lead}>
            {copy.purpose}
          </Text>
        </Section>
      </FadeIn>

      {/* Contract offline path: practice is the entitlement-proof surface and
          keeps working without a connection, so the banner LABELS the state —
          it never blocks or greys the sets already on the device. */}
      {!online ? (
        <FadeIn>
          <Banner
            tone="offline"
            title="No connection"
            description="Practice still works. New practice arrives when you are back online."
          />
        </FadeIn>
      ) : null}

      {/*
        The band is what decides which maths this child sees, and it arrives
        with the session. A skeleton here is not politeness — rendering the
        default band's content first would show a six-year-old algebra for a
        frame, and that frame is the whole defect this screen existed to carry.
      */}
      {loading ? (
        <Section className="gap-stack">
          <LoadingSkeleton variant="card" />
          <LoadingSkeleton variant="card" count={2} className="h-20" />
        </Section>
      ) : lead === undefined ? (
        /* An ANSWERED zero: the band has no sets, which is a real state and not
           a failed read. It names where practice comes from and hands over the
           one live exit rather than leaving the child on a shrug. */
        <EmptyState
          icon={<Star size={28} className="text-text-muted" />}
          title={copy.emptyTitle}
          description={copy.emptyBody}
          action={<Button variant="primary" title={copy.snap} onPress={() => router.push('/capture')} />}
        />
      ) : (
        <>
          <FadeIn delay={80}>
            <Section className="gap-stack">
              <Text variant="label" tone="muted">
                {copy.setsLabel}
              </Text>
              <PressScale
                outerClassName="w-full"
                className={`w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-primary shadow-card ${scale.target} ${scale.inset}`}
                aria-label={`${copy.start}: ${lead.title}`}
                onPress={() => openSet(lead.id)}
              >
                <View className="w-full flex-row items-center gap-stack">
                  <View className="h-12 w-12 items-center justify-center rounded-full border-2 border-border bg-surface">
                    <Star size={24} className="text-text" />
                  </View>
                  <View className="flex-1 gap-1">
                    <TWText className={`font-display font-bold text-on-primary ${scale.rowTitle}`}>
                      {lead.title}
                    </TWText>
                    <TWText className="text-body text-on-primary/80">{lead.blurb}</TWText>
                  </View>
                  {/* The action label rides the row's trailing edge, the same
                      place the quiet rows put theirs — a second line under the
                      icon read as a stray caption rather than as the action. */}
                  <TWText className="text-label font-semibold text-on-primary">{copy.start}</TWText>
                </View>
              </PressScale>

              {rest.map((set, index) => (
                <FadeIn key={set.id} delay={140 + index * 60}>
                  <SetRow set={set} ageBand={ageBand} onPress={() => openSet(set.id)} />
                </FadeIn>
              ))}
            </Section>
          </FadeIn>

          {/* "What did I do before?" — the contract's second question, answered
              from real session state. A mark, never a tally. */}
          {finished.length > 0 ? (
            <FadeIn delay={200}>
              <Section className="gap-stack">
                <Text variant="label" tone="muted">
                  {copy.finishedLabel}
                </Text>
                {finished.map((set) => (
                  <SetRow
                    key={set.id}
                    set={set}
                    ageBand={ageBand}
                    done
                    actionLabel={copy.again}
                    onPress={() => openSet(set.id)}
                  />
                ))}
              </Section>
            </FadeIn>
          ) : null}

          {/* The single secondary the contract allows. Outline, not filled —
              two filled actions is two primaries. */}
          <FadeIn delay={260}>
            <Button
              variant="outline"
              title={copy.snap}
              onPress={() => router.push('/capture')}
            />
          </FadeIn>
        </>
      )}
    </View>
  );
}

function SetRow({
  set,
  ageBand,
  done = false,
  actionLabel,
  onPress,
}: {
  set: PracticeSet;
  ageBand: AgeBand;
  done?: boolean;
  actionLabel?: string;
  onPress: () => void;
}) {
  const scale = bandScaleFor(ageBand);
  return (
    <PressScale
      outerClassName="w-full"
      className={`w-full flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised shadow-card ${scale.target} ${scale.inset}`}
      aria-label={done ? `${set.title}, finished` : set.title}
      onPress={onPress}
    >
      {/* Done is a quiet state change, not a celebration: the title keeps its
          normal face and nothing is struck through or faded out. */}
      <View
        className={`h-10 w-10 items-center justify-center rounded-full border-2 border-border ${
          done ? 'bg-grade' : 'bg-surface-sunken'
        }`}
      >
        {done ? <Check size={20} className="text-on-primary" /> : <Play size={20} className="text-text" />}
      </View>
      <View className="flex-1 gap-1">
        <TWText className={`font-semibold text-text ${scale.rowTitle}`}>{set.title}</TWText>
        <TWText className="text-body text-text-muted">{set.blurb}</TWText>
      </View>
      {actionLabel ? (
        <TWText className="text-label font-semibold text-text">{actionLabel}</TWText>
      ) : null}
    </PressScale>
  );
}

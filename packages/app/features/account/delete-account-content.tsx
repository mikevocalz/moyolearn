'use client';
// FD-26 · Delete account.
//
// Doc 38 §5A's anatomy, built: H1, a consequence list, type-to-confirm
// `DELETE`, a destructive primary and a `Keep my account` secondary. Two
// additions the doc's one-line sketch predates, both forced by what the server
// actually does:
//
//  1. A KEPT COLUMN beside the removed one. Doc 31 §4.1 holds S4 and
//     abuse-disclosure safety reports outside every retention schedule, so a
//     screen listing only what goes would be telling a parent something false
//     about the one category of record they would most want to know survived.
//
//  2. THE LEARNER LIST. `consent-flow-content.tsx:82` has been telling
//     guardians they can "withdraw it any time from the family screen" with no
//     control behind the sentence. Doc 38 puts per-child deletion in guardian
//     settings rather than here, and this IS the settings destination — the
//     family screen has no guardianship read to enumerate children with, so a
//     control there would list nothing. It lives with the account deletion it
//     shares a cascade with, and moves when that read exists.
//
// A LEARNER SEES A DIFFERENT SCREEN. Settings is reachable from more than one
// shell (`apps/mobile/app/settings.tsx` says why it sits outside the groups),
// so a guardian-managed child can arrive here. They get the reason and the
// destination, not a disabled button: a control that exists and refuses reads
// as something the child did wrong, and CLAUDE.md forbids that register on a
// learner surface.
//
// NO PERSUASION ANYWHERE. There is no "are you sure", no streak count, no offer
// to pause instead. `memory-content.tsx` argues the position for the eraser and
// it holds harder here: a screen that talks a parent out of deleting has
// decided the account matters more than they do.
// Mobbin: https://mobbin.com/screens/a007812c-a55d-48df-92a0-867af316a4a3 (Bloomberg — what goes is stated in full BEFORE the confirm field, and the field is the last thing on the page) · https://mobbin.com/screens/9ba54fb6-92a9-4bf3-839a-c18beafef0e8 (OpenPhone — a "What you can do instead" block that offers the smaller action without hiding the larger one) · https://mobbin.com/screens/5fb5cf13-994f-44c0-8746-0cd65283cc84 (South China Morning Post — what is NOT deleted by this action is named, not implied) · https://mobbin.com/screens/54bebb78-abbd-4c93-a9d1-24f393dc6caf (Plex — the typed word and the destructive button sit together, with no cancel styled as the safe default). Structure only.
// SOT: docs/38-front-door-and-flow.md §5A FD-26 · docs/pack/31-grade-voice-safety-incidents.md §4.1 · CLAUDE.md §Children's surfaces
// SOT-KEYWORDS: account deletion screen fd-26 delete account confirm consequence list learner guardian withdraw consent apple 5.1.1
import { useEffect } from 'react';
import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Dialog, FadeIn, Heading, Text, TextField } from '@acme/ui';
import { authClient, useAppSession } from '../../providers/session';
import {
  ACCOUNT_DELETION_COPY as COPY,
  DELETE_CONFIRM_WORD,
  LEARNER_DELETION_COPY,
} from './account-deletion.copy.ts';
import { confirmArmed, useAccountDeletionStore, type LearnerRow } from './account-deletion.store.ts';

function Bullets({ lines }: { lines: readonly string[] }) {
  return (
    <View className="gap-stack">
      {lines.map((line) => (
        <View key={line} className="flex-row gap-stack">
          {/* A bullet drawn as a dot rather than a list marker: RN has no
              `list-style`, and a glyph in the string would be read aloud. */}
          <View aria-hidden className="mt-2 size-1.5 rounded-full bg-text-muted" />
          <TWText className="flex-1 text-base text-text-muted">{line}</TWText>
        </View>
      ))}
    </View>
  );
}

function LearnerSection() {
  const learners = useAccountDeletionStore((s) => s.learners);
  const learnersLoaded = useAccountDeletionStore((s) => s.learnersLoaded);
  const askDeleteLearner = useAccountDeletionStore((s) => s.askDeleteLearner);
  const working = useAccountDeletionStore((s) => s.working);

  /*
    Absent, not empty, until the read answers — and absent again if it failed.
    "You look after nobody" is a claim, and on this screen it reads as the
    children having already been removed.
  */
  if (!learnersLoaded || learners.length === 0) return null;

  const kept = learners.filter((row) => !row.soleGuardian).map((row) => row.displayName);

  return (
    <FadeIn delay={200}>
      <Card className="gap-stack">
        <View className="gap-1">
          <Text variant="heading">{COPY.wardsHeading}</Text>
          <TWText className="text-base text-text-muted">{COPY.wardsLede}</TWText>
        </View>
        {kept.length > 0 ? (
          <TWText className="text-base text-text-muted">{COPY.wardsKept(kept)}</TWText>
        ) : null}
        <TWText className="text-base text-text-muted">{COPY.learnerRowHint}</TWText>
        <View className="gap-stack">
          {learners.map((row) => (
            <View
              key={row.learnerAuthId}
              className="flex-row items-center justify-between gap-stack rounded-lg border-2 border-border bg-surface-sunken p-3"
            >
              <TWText className="flex-1 text-base font-semibold text-text">{row.displayName}</TWText>
              <Button
                title={COPY.learnerDeleteAction}
                variant="outline"
                size="sm"
                disabled={working}
                onPress={() => askDeleteLearner(row)}
              />
            </View>
          ))}
        </View>
      </Card>
    </FadeIn>
  );
}

function LearnerDialog({ pending }: { pending: LearnerRow | null }) {
  const cancel = useAccountDeletionStore((s) => s.cancelDeleteLearner);
  const confirm = useAccountDeletionStore((s) => s.confirmDeleteLearner);

  return (
    <Dialog
      open={pending !== null}
      onClose={cancel}
      title={pending === null ? COPY.learnerDeleteAction : COPY.learnerDialogTitle(pending.displayName)}
      description={pending === null ? undefined : COPY.learnerDialogBody(pending.displayName)}
      actions={
        <>
          <Button title="Cancel" variant="ghost" onPress={cancel} />
          {/* `void`: onPress is fire-and-forget on both platforms and the store
              owns the failure path, which renders as `error`. */}
          <Button
            title={COPY.learnerDeleteAction}
            variant="danger"
            onPress={() => {
              void confirm();
            }}
          />
        </>
      }
    />
  );
}

/** The child's half: the reason, and where to go. No control, by design. */
function LearnerNotice() {
  return (
    <View className="gap-group">
      <FadeIn>
        <Section className="gap-1">
          <Heading level={1} size="display-sm">
            {LEARNER_DELETION_COPY.heading}
          </Heading>
        </Section>
      </FadeIn>
      <FadeIn delay={80}>
        <Card className="gap-stack">
          <TWText className="text-base text-text-muted">{LEARNER_DELETION_COPY.body}</TWText>
        </Card>
      </FadeIn>
    </View>
  );
}

export function DeleteAccountContent() {
  const router = useRouter();
  const { activeContext } = useAppSession();
  const store = useAccountDeletionStore();
  const armed = confirmArmed(store);

  const loadLearners = store.loadLearners;
  const isLearner = activeContext.kind === 'learner';

  useEffect(() => {
    if (isLearner) return;
    void loadLearners();
  }, [isLearner, loadLearners]);

  if (isLearner) return <LearnerNotice />;

  const submit = async () => {
    const gone = await useAccountDeletionStore.getState().deleteAccount();
    if (!gone) return;
    /*
      Sign out and land on the dispatcher, the shape `settings-content.tsx`
      established: the front door owns where an anon session goes on each
      platform. `finally` because the session this revokes belongs to a user row
      that no longer exists — the revocation is expected to fail, and a failed
      revocation must not strand somebody on a dead screen.
    */
    try {
      await authClient.signOut();
    } finally {
      router.replace('/');
    }
  };

  return (
    <View className="gap-group md:gap-10 lg:gap-12">
      <FadeIn>
        <Section className="gap-1">
          <Heading level={1} size="display-sm">
            {COPY.title}
          </Heading>
          <Text tone="muted">{COPY.lede}</Text>
        </Section>
      </FadeIn>

      {store.error === null ? null : (
        <TWText className="text-base text-redpen" role="alert">
          {store.error}
        </TWText>
      )}
      {store.notice === null ? null : (
        <TWText className="text-base text-text-muted" role="status">
          {store.notice}
        </TWText>
      )}

      <FadeIn delay={80}>
        <Card className="gap-4">
          <Text variant="heading">{COPY.removedHeading}</Text>
          <Bullets lines={COPY.removed} />
        </Card>
      </FadeIn>

      <FadeIn delay={140}>
        <Card className="gap-4">
          <Text variant="heading">{COPY.keptHeading}</Text>
          <Bullets lines={COPY.kept} />
        </Card>
      </FadeIn>

      <LearnerSection />

      <FadeIn delay={260}>
        <Card className="gap-4">
          <View className="gap-1">
            <Text variant="heading">{COPY.timingHeading}</Text>
            <TWText className="text-base text-text-muted">{COPY.timing}</TWText>
          </View>
          <TextField
            label={COPY.confirmLabel}
            hint={COPY.confirmHint}
            value={store.confirmText}
            onChangeText={store.setConfirmText}
            autoCapitalize="characters"
            placeholder={DELETE_CONFIRM_WORD}
          />
          <View className="flex-row gap-stack">
            <Button
              title={COPY.primary}
              variant="danger"
              disabled={!armed}
              onPress={() => {
                void submit();
              }}
            />
            <Button title={COPY.secondary} variant="ghost" onPress={() => router.back()} />
          </View>
        </Card>
      </FadeIn>

      <LearnerDialog pending={store.pendingLearner} />
    </View>
  );
}

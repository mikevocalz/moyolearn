'use client';
// S27 · What Natalie remembers about Maya.
//
// Doc 07 §S27: radical memory transparency, "the only screen where the ink
// system renders the model itself — every line is literally erasable, and the
// eraser works." So the design job is the opposite of the usual one. Nothing
// here persuades. There is no reassurance banner, no "your privacy matters"
// header, no friction on the delete path — a screen that talks a parent out of
// erasing is a screen that has decided the model matters more than they do, and
// the brief's metric (guardians who visit and KEEP AI on afterwards) only moves
// if the erasing is real.
//
// Mobbin: https://mobbin.com/screens/f5728230-f84a-40ac-aa8e-48b9238e1ae5 (Oura
// Memories — one plain sentence per row, trash on the row itself, and a
// destructive footer that states in a sentence exactly what it deletes) ·
// https://mobbin.com/screens/36d42649-b379-4175-a419-6c733dd11733 (Replika
// Memory — memories under plain-language section headings, which is what turns a
// knowledge graph into something a parent reads rather than parses) ·
// https://mobbin.com/screens/ee5524ed-0074-4887-b67d-689d54108a76 (Bevel Manage
// memory — each card carries its category and its provenance, so a row explains
// where it came from without being opened) ·
// https://mobbin.com/screens/fb2d49cb-b7c1-4de3-8bf0-e2a0b913130a (Finch data
// deletion — the confirmation counts the exact items it will remove instead of
// saying "this cannot be undone") ·
// https://mobbin.com/screens/3ddecd96-2103-42d0-ae79-3c673ac1e205 (World App
// delete-data — the two-panel "this will be deleted / this will not", the
// structure the cascade needs so a guardian knows what survives). Structure
// only; style stays on docs 02/08.
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27
// SOT-KEYWORDS: memory s27 transparency erasure cascade guardian knowledge graph delete

import { useShallow } from 'zustand/react/shallow';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Dial, Dialog, EmptyState, FadeIn, Heading, IconButton, Text } from '@acme/ui';
import { Eye, Trash2 } from '@acme/ui/icons';
import { GROUPS, provenanceLabel } from './memory.data';
import { pendingCascade, useMemoryStore } from './memory.store';

export function MemoryContent() {
  const facts = useMemoryStore((s) => s.facts);
  const transcripts = useMemoryStore((s) => s.transcripts);
  const eraseLine = useMemoryStore((s) => s.eraseLine);
  const askEraseTranscript = useMemoryStore((s) => s.askEraseTranscript);
  const cancelErase = useMemoryStore((s) => s.cancelErase);
  const confirmEraseTranscript = useMemoryStore((s) => s.confirmEraseTranscript);
  const askForgetAll = useMemoryStore((s) => s.askForgetAll);
  const confirmForgetAll = useMemoryStore((s) => s.confirmForgetAll);
  const pendingTranscriptId = useMemoryStore((s) => s.pendingTranscriptId);
  const forgetAllOpen = useMemoryStore((s) => s.forgetAllOpen);
  const eraseError = useMemoryStore((s) => s.eraseError);
  /*
    `useShallow`, for the reason `providers/session/session.tsx` gives about its
    own selector: zustand v5 compares snapshots with `Object.is`, and
    `pendingCascade` DERIVES its value — it filters, so it hands back a fresh
    array on every call even when the same facts are in it. React saw a new
    snapshot each read and warned "the result of getServerSnapshot should be
    cached to avoid an infinite loop" on every render of this screen.

    Shallow is sound rather than merely quieter here: `cascadePreview` filters
    `state.facts` and returns the ORIGINAL fact objects, so element-wise
    identity is exactly the comparison that says whether the cascade changed.
  */
  const cascade = useMemoryStore(useShallow(pendingCascade));

  const pending = transcripts.find((t) => t.id === pendingTranscriptId);
  const survivors = facts.length - cascade.length;

  return (
    <Dial temperature="cool" className="gap-7">
      <FadeIn>
        <Section className="gap-1">
          <Text className="text-2xl font-semibold text-text-muted md:text-3xl">
            What Natalie remembers
          </Text>
          <Heading
            level={1}
            size="display-sm"
            className="text-2xl font-semibold text-text md:text-3xl"
          >
            About Maya
          </Heading>
          <TWText className="text-base text-text-muted">
            This is the whole of it — the same lines her tutor sees before a session. Delete any of
            them and Natalie stops knowing it.
          </TWText>
        </Section>
      </FadeIn>

      {/* An erasure that did not reach the server has already put its line back
          above; this is the sentence that stops the restoration reading as a
          glitch. Stated rather than swallowed because the failure it describes —
          a line shown as erased when it is not — is the one this screen exists
          to make impossible. */}
      {eraseError === null ? null : (
        <TWText className="text-base text-redpen" role="alert">
          {eraseError}
        </TWText>
      )}

      {facts.length === 0 ? (
        <FadeIn delay={80}>
          <EmptyState
            icon={<Eye className="h-8 w-8 text-text-muted" />}
            title="Natalie remembers nothing about Maya"
            description="She will start again from the next session, and only from what Maya works on."
          />
        </FadeIn>
      ) : (
        GROUPS.map((group, index) => {
          const rows = facts.filter((fact) => fact.kind === group.kind);
          if (rows.length === 0) return null;
          return (
            <FadeIn key={group.kind} delay={80 + index * 60}>
              <Section className="gap-stack">
                <Text variant="label" tone="muted">
                  {group.heading}
                </Text>
                <View className="gap-element">
                  {rows.map((fact) => (
                    <View
                      key={fact.id}
                      className="flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-3"
                    >
                      <View className="flex-1 gap-0.5">
                        <TWText className="text-base text-text">{fact.sentence}</TWText>
                        <TWText className="text-sm text-text-muted">
                          {provenanceLabel(fact)}
                        </TWText>
                      </View>
                      {/* No confirmation on a single line: the guardian named the
                          row, and a dialog per line is friction pretending to be
                          care. The cascade below is where confirmation earns its
                          place, because there the effect is not what was clicked. */}
                      <IconButton
                        variant="outline"
                        size="sm"
                        icon={<Trash2 className="h-4 w-4 text-redpen" />}
                        aria-label={`Forget: ${fact.sentence}`}
                        onPress={() => {
                          // `void`, not an async handler: `onPress` is fire-and-forget
                          // on both platforms, and the store already owns the failure
                          // path — returning the promise here would only give a lint
                          // rule something to complain about.
                          void eraseLine(fact.id);
                        }}
                      />
                    </View>
                  ))}
                </View>
              </Section>
            </FadeIn>
          );
        })
      )}

      {transcripts.length > 0 ? (
        <FadeIn delay={420}>
          <Section className="gap-stack">
            <Text variant="label" tone="muted">
              Sessions Natalie can still read
            </Text>
            <View className="gap-element">
              {transcripts.map((transcript) => (
                <View
                  key={transcript.id}
                  className="flex-row items-center gap-stack rounded-card border-2 border-border bg-surface-raised p-3"
                >
                  <View className="flex-1 gap-0.5">
                    <TWText className="text-base text-text">{transcript.label}</TWText>
                    <TWText className="text-sm text-text-muted">{transcript.expiresLabel}</TWText>
                  </View>
                  <IconButton
                    variant="outline"
                    size="sm"
                    icon={<Trash2 className="h-4 w-4 text-redpen" />}
                    aria-label={`Delete ${transcript.label}`}
                    onPress={() => askEraseTranscript(transcript.id)}
                  />
                </View>
              ))}
            </View>
            <TWText className="text-sm text-text-muted">
              Sessions delete themselves on the date shown. Deleting one early also removes anything
              Natalie learned only from it.
            </TWText>
          </Section>
        </FadeIn>
      ) : null}

      {facts.length > 0 || transcripts.length > 0 ? (
        <FadeIn delay={480}>
          <Card className="gap-stack">
            <Text variant="heading">Forget everything</Text>
            <TWText className="text-base text-text-muted">
              Removes all {facts.length} things Natalie remembers and all {transcripts.length}{' '}
              sessions. Maya keeps her account and her work; Natalie starts over knowing nothing.
            </TWText>
            <Button title="Forget everything" variant="danger" onPress={askForgetAll} />
          </Card>
        </FadeIn>
      ) : null}

      {/* The cascade, stated as a count before it happens — doc 07 §4's promise is
          unactionable if a guardian only learns its reach afterwards. */}
      <Dialog
        open={pending !== undefined}
        onClose={cancelErase}
        title={pending === undefined ? '' : `Delete ${pending.label}?`}
        description={
          cascade.length === 0
            ? 'Nothing Natalie remembers came only from this session, so the rest of her notes stay as they are.'
            : `${cascade.length} of the ${facts.length} things Natalie remembers came only from this session and go with it. The other ${survivors} stay.`
        }
        actions={
          <>
            <Button title="Keep it" variant="ghost" onPress={cancelErase} />
            {/* `void`, like the row's trash icon: `onPress` is fire-and-forget on
                both platforms and the store owns the failure path — it reinstates
                the session and sets `eraseError`, which renders above. */}
            <Button
              title="Delete session"
              variant="danger"
              onPress={() => {
                void confirmEraseTranscript();
              }}
            />
          </>
        }
      />

      <Dialog
        open={forgetAllOpen}
        onClose={cancelErase}
        title="Forget everything about Maya?"
        description={`All ${facts.length} notes and ${transcripts.length} sessions are deleted. Her account, her plan and her past work are not touched.`}
        actions={
          <>
            <Button title="Cancel" variant="ghost" onPress={cancelErase} />
            <Button
              title="Forget everything"
              variant="danger"
              onPress={() => {
                void confirmForgetAll();
              }}
            />
          </>
        }
      />
    </Dial>
  );
}

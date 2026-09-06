'use client';
// S27 · What Natalie remembers.
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
// P0 RESOLUTION, 2026-09-06 — option B of docs/design/reset/04-guardian-fixture-audit.md.
//
// The fact list and the per-session list are NOT rendered, and the per-row
// erase controls are gone with them. `memory.store` seeded them from
// `MEMORY_FACTS`/`MEMORY_TRANSCRIPTS` — fixture rows with ids like
// `maya:mastery:fraction-addition` — and the trash icon beside each one posted
// that fabricated id to the real `POST /api/memory/erase`. The store removed
// the row optimistically and only put it back on a non-ok response, so a
// guardian erasing an invented line was shown a deletion that deleted nothing,
// while whatever the model actually holds — which they were never shown —
// stayed. Doc 07 §4 makes erasure a guarantee to a family; that is the one
// promise this screen exists to keep, reported kept without being kept.
//
// There is no read to fix it with: `apps/web/app/api/memory/` exposes `erase`,
// `erase-transcript` and `forget-all`, and no GET. So the list waits for one.
//
// `Forget everything` STAYS, and it is the reason this is option B rather than
// option A. It is the one action whose meaning does not depend on the list
// being accurate — it says "delete all of it", the server resolves the learner
// from context, and the response is reconciled honestly (`mediaIncomplete`
// already refuses to claim a deletion it cannot vouch for). Removing it would
// have taken away a guardian's only working control on a safety guarantee in
// order to fix a display bug.
//
// Its copy lost the counts it used to quote — "all 6 things … and all 3
// sessions" was read off the fixture, so the counts were fabricated too — and
// the child's name with them, since `memory.store` has no learner to name.
//
// Reverting to option A is deleting the one card below.
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
// SOT: docs/pack/07-security-child-ai-safety-spec.md §4 §S27 ·
//      docs/design/reset/04-guardian-fixture-audit.md §P0
// SOT-KEYWORDS: memory s27 transparency erasure guardian delete forget-all p0 fixture

import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, Card, Dial, Dialog, FadeIn, Heading, Text } from '@acme/ui';
import { useMemoryStore } from './memory.store';

export function MemoryContent() {
  const askForgetAll = useMemoryStore((s) => s.askForgetAll);
  const confirmForgetAll = useMemoryStore((s) => s.confirmForgetAll);
  const cancelErase = useMemoryStore((s) => s.cancelErase);
  const forgetAllOpen = useMemoryStore((s) => s.forgetAllOpen);
  const eraseError = useMemoryStore((s) => s.eraseError);

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
            Not shown yet
          </Heading>
          {/*
            States the gap rather than a zero. "Natalie remembers nothing" would
            be a claim about the child's record that nothing here can support —
            the same false zero the rest of this reset has been removing, and a
            more serious one, because on this screen it reads as the erasure
            having already happened.
          */}
          <TWText className="text-base text-text-muted">
            We can&rsquo;t show you these notes yet — reading them back isn&rsquo;t built, and this
            screen won&rsquo;t show you a list it can&rsquo;t stand behind. Deleting everything below
            still works, and still deletes everything.
          </TWText>
        </Section>
      </FadeIn>

      {/* A forget-all that did not fully land says so here. The store reinstates
          nothing on this path — there is no list to reinstate — so this sentence
          is the whole of the failure report, including the 200-with-files-left
          case `mediaIncomplete` exists to catch. */}
      {eraseError === null ? null : (
        <TWText className="text-base text-redpen" role="alert">
          {eraseError}
        </TWText>
      )}

      <FadeIn delay={80}>
        <Card className="gap-stack">
          <Text variant="heading">Forget everything</Text>
          <TWText className="text-base text-text-muted">
            Deletes everything Natalie remembers about your child and every session she can still
            read. Your child keeps their account and their work; Natalie starts over knowing
            nothing.
          </TWText>
          <Button title="Forget everything" variant="danger" onPress={askForgetAll} />
        </Card>
      </FadeIn>

      <Dialog
        open={forgetAllOpen}
        onClose={cancelErase}
        title="Forget everything?"
        description="Everything Natalie remembers and every session she can still read are deleted. Your child's account, their plan and their past work are not touched."
        actions={
          <>
            <Button title="Cancel" variant="ghost" onPress={cancelErase} />
            {/* `void`: onPress is fire-and-forget on both platforms and the
                store owns the failure path, which renders as `eraseError`. */}
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

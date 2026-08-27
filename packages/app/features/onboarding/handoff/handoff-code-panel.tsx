'use client';
// The guardian side of device handoff: one panel per child, minting and
// showing the short code the child's device redeems. The code is the hero —
// display type, mono, letter-spaced — because its whole job is to be read
// aloud across a room (doc 36 §2). The moyo:// link rides under it for the
// same-device case.
//
// Mobbin: Posh "Enter your code" — the code as the screen's one object
// (mobbin.com/screens/6e3bd021-387b-4ee5-9ea3-1454202a1924) · ShopBack
// verification code with expiry framing (mobbin.com/screens/4ff2f341-1c1a-46f4-aecc-c77cf150c471) ·
// PayPal code + Skip escape (mobbin.com/screens/f54d0305-c0b3-4f61-93e8-f833d8fc8efd)
// SOT: docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: handoff code panel guardian mint display child device

import { useStore } from 'zustand';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Button, useInstanceStore } from '@acme/ui';
import { mintHandoffCode, type HandoffIssueResponse } from './handoff.client';

type PanelState =
  | { phase: 'idle' }
  | { phase: 'minting' }
  | { phase: 'issued'; issue: HandoffIssueResponse }
  | { phase: 'failed'; message: string };

export interface HandoffCodePanelProps {
  displayName: string;
  /** Absent until the children step has committed the row server-side. */
  learnerAuthId?: string;
}

export function HandoffCodePanel({ displayName, learnerAuthId }: HandoffCodePanelProps) {
  const store = useInstanceStore<PanelState>(() => ({ phase: 'idle' }));
  const state = useStore(store);

  const mint = async () => {
    if (!learnerAuthId) return;
    store.setState({ phase: 'minting' });
    const result = await mintHandoffCode(learnerAuthId);
    store.setState(
      result.kind === 'issued'
        ? { phase: 'issued', issue: result.issue }
        : { phase: 'failed', message: result.message },
    );
  };

  return (
    <Section className="gap-stack rounded-card border-2 border-border bg-surface p-inset shadow-card">
      <TWText className="text-title font-semibold text-text">{displayName}</TWText>

      {state.phase === 'issued' ? (
        <View className="gap-element">
          {/* The one display moment of this screen: the code itself. */}
          <TWText className="text-center font-mono text-4xl font-bold tracking-wider text-text">
            {state.issue.code}
          </TWText>
          <TWText className="text-center text-body text-text-muted">
            On {displayName}&apos;s device, open Moyo and enter this code. It works once and
            expires in 15 minutes.
          </TWText>
          <Button variant="outline" title="Get a new code" onPress={mint} />
        </View>
      ) : (
        <View className="gap-element">
          <TWText className="text-body text-text-muted">
            {learnerAuthId
              ? `Show a code on this screen, then enter it on ${displayName}'s device — they never need an email or password.`
              : `Finish the children step first — the code is minted for ${displayName}'s account.`}
          </TWText>
          {state.phase === 'failed' ? (
            <TWText className="text-body text-redpen">{state.message}</TWText>
          ) : null}
          <Button
            title={state.phase === 'minting' ? 'Creating code…' : 'Show code'}
            onPress={mint}
            disabled={!learnerAuthId || state.phase === 'minting'}
          />
        </View>
      )}
    </Section>
  );
}

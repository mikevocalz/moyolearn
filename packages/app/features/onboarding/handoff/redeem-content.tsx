'use client';
// The learner side of device handoff — the child's whole sign-in is six
// friendly characters (doc 36 §2). Hot dial, young-band targets, one field,
// one button; a failure never says "permission" or "invalid credential" — it
// says ask your grown-up (doc 36 §4.4's no-permission-copy law, applied to the
// front door).
//
// Mobbin: Posh "Enter your code" — one field, the code is the screen
// (mobbin.com/screens/6e3bd021-387b-4ee5-9ea3-1454202a1924) · PayPal code
// entry with forgiving input boxes (mobbin.com/screens/f54d0305-c0b3-4f61-93e8-f833d8fc8efd) ·
// ShopBack code entry framing (mobbin.com/screens/4ff2f341-1c1a-46f4-aecc-c77cf150c471)
// SOT: docs/pack/36-role-navigation-flows.md §2 §4.4
// SOT-KEYWORDS: handoff redeem screen learner code entry sign-in child device

import { useStore } from 'zustand';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Button, Dial, FadeIn, MessageBubble, TextField, useInstanceStore } from '@acme/ui';
import { HANDOFF_CODE_LENGTH, isWellFormedHandoffCode, normalizeHandoffCode } from '@acme/auth';
import { redeemHandoffCode } from './handoff.client';

interface RedeemState {
  code: string;
  phase: 'idle' | 'checking' | 'not-recognized' | 'offline';
}

export interface HandoffRedeemContentProps {
  /** Fired once the session cookie is set; the caller re-dispatches shells. */
  onSignedIn: () => void;
  /** From the moyo://handoff?code=… deep link — the QR path skips the typing. */
  initialCode?: string;
}

export function HandoffRedeemContent({ onSignedIn, initialCode }: HandoffRedeemContentProps) {
  const store = useInstanceStore<RedeemState>(() => ({
    code: initialCode ? normalizeHandoffCode(initialCode) : '',
    phase: 'idle',
  }));
  const state = useStore(store);
  const ready = isWellFormedHandoffCode(state.code);

  const redeem = async () => {
    store.setState({ code: state.code, phase: 'checking' });
    const result = await redeemHandoffCode(normalizeHandoffCode(state.code));
    if (result === 'signed-in') {
      onSignedIn();
      return;
    }
    store.setState({ code: state.code, phase: result });
  };

  return (
    <Dial temperature="hot">
      <Section className="gap-group p-inset-roomy">
        <FadeIn>
          <View className="items-center gap-element">
            <Avatar name="Moyo" size="xl" />
            <MessageBubble from="tutor">
              Hi! Type the code from your grown-up&apos;s screen and we can start.
            </MessageBubble>
          </View>
        </FadeIn>

        <FadeIn delay={80}>
          <View className="gap-stack">
            {/* Uppercasing happens in the handler, so the field needs no
                platform keyboard hints — a child sees capitals appear however
                they type them. */}
            <TextField
              label="Your code"
              value={state.code}
              autoCapitalize="characters"
              onChangeText={(code: string) =>
                // Length is clamped here (the kit Input has no maxLength prop);
                // +2 leaves room for a pasted space or dash to normalize away.
                store.setState({
                  code: code.toUpperCase().slice(0, HANDOFF_CODE_LENGTH + 2),
                  phase: 'idle',
                })
              }
              className="text-center font-mono text-2xl tracking-wider"
            />
            {state.phase === 'not-recognized' ? (
              <TWText className="text-center text-body-lg text-text">
                That code didn&apos;t work. Ask your grown-up to show a new one.
              </TWText>
            ) : null}
            {state.phase === 'offline' ? (
              <TWText className="text-center text-body-lg text-text">
                We couldn&apos;t reach Moyo. Check the internet and try again.
              </TWText>
            ) : null}
            <Button
              size="xl"
              title={state.phase === 'checking' ? 'Checking…' : "Let's go"}
              className="min-h-target-young w-full"
              onPress={() => void redeem()}
              disabled={!ready || state.phase === 'checking'}
            />
          </View>
        </FadeIn>
      </Section>
    </Dial>
  );
}

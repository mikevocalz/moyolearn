'use client';
// Native purchases use RevenueCat's store-backed, localized paywall. Web trial
// promises must not be copied onto an Apple/Google offer with different eligibility.
// SOT: https://www.revenuecat.com/docs/tools/paywalls/displaying-paywalls
// SOT-KEYWORDS: paywall native revenuecat purchase restore guardian
import { useState } from 'react';
import { Button, Heading, Text } from '@acme/ui';
import { View } from '@acme/ui/tw';
import { useAppSession } from '../../providers/session';
import { purchaseFamily, restoreFamilyPurchases } from './purchases.native';
import type { PaywallProps } from './paywall.types';
export type { PaywallProps } from './paywall.types';

export function PaywallContent({ onSubscribed, onContinueFree }: PaywallProps) {
  const { user, status, activeContext } = useAppSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (status !== 'authed' || user?.kind === 'learner' || activeContext.kind === 'learner') return null;
  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    setError(null);
    try { if (await action()) onSubscribed(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  return (
    <View className="gap-stack">
      <Heading level={1} size="title">Moyo for your family</Heading>
      <Text>See the plans, prices, and any available free trial before you subscribe.</Text>
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Button title={busy ? 'Please wait…' : 'See family plans'} disabled={busy} onPress={() => { void run(purchaseFamily); }} />
      <Button title="Restore purchases" variant="outline" disabled={busy} onPress={() => { void run(restoreFamilyPurchases); }} />
      <Button title="Continue with free practice" variant="ghost" disabled={busy} onPress={onContinueFree} />
    </View>
  );
}

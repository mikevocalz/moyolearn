'use client';
// The learner device's front door (doc 36 §2): moyo://handoff?code=… lands
// here, or the child types the code. Success re-enters the dispatcher, which
// opens the learner shell.
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeArea } from '@acme/ui';
import { HandoffRedeemContent, useAppSession } from '@acme/app';

export default function HandoffRoute() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { status } = useAppSession();
  // Already signed in — a stale QR must not stack a second session flow.
  if (status === 'authed') return <Redirect href="/" />;
  return (
    <SafeArea edges={['top', 'bottom']} className="flex-1 bg-surface">
      <HandoffRedeemContent initialCode={code} onSignedIn={() => router.replace('/onboarding/learner')} />
    </SafeArea>
  );
}

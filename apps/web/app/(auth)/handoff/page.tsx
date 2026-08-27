'use client';
// /handoff — the learner device's front door on web (doc 36 §2). Chrome-free
// like the rest of (auth): entering a code is not a marketing surface.
// `useSearchParams` must sit under Suspense or the static prerender bails —
// the code param only exists client-side (it arrives by QR).
// SOT: docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: handoff page web redeem learner code
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { HandoffRedeemContent } from '@acme/app';

function HandoffInner() {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <HandoffRedeemContent
      initialCode={params.get('code') ?? undefined}
      onSignedIn={() => router.replace('/onboarding/learner')}
    />
  );
}

export default function HandoffPage() {
  return (
    <Suspense fallback={null}>
      <HandoffInner />
    </Suspense>
  );
}

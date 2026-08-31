// Mobile route: /onboarding/handoff
// SOT: docs/pack/36-role-navigation-flows.md §2
// SOT-KEYWORDS: route onboarding handoff mobile

import { useRouter } from 'solito/navigation';
import { HandoffRedeemContent } from '@acme/app';

export default function HandoffRoute() {
  const router = useRouter();
  return <HandoffRedeemContent onSignedIn={() => router.replace('/')} />;
}

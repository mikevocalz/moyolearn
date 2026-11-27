// Mobile route: /onboarding/reset-password
//
// The reset mail's link lands here: Better Auth's `/reset-password/:token`
// callback redirects to `moyo://onboarding/reset-password?token=…`, or with
// `?error=INVALID_TOKEN` once the link is spent.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6
// SOT-KEYWORDS: route onboarding reset password token deep link mobile

import { useLocalSearchParams } from 'expo-router';
import { ResetPasswordContent } from '@acme/app';

export default function ResetPasswordRoute() {
  const { token, error } = useLocalSearchParams<{ token?: string; error?: string }>();
  return <ResetPasswordContent token={token} error={error} />;
}

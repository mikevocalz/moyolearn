// /login — Moyo's own sign-in, no district branding.
// A district's families arrive at /login/[org] instead.
// SOT: docs/pack/06-auth-onboarding-spec.md §7
// SOT-KEYWORDS: login page auth sign-in unbranded
import { LoginContent } from '@/components/auth/LoginContent';

export default function LoginPage() {
  return <LoginContent />;
}

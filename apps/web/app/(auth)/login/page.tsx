// /login — Moyo's own sign-in, no district branding.
// A district's families arrive at /login/[org] instead.
//
// `?mode=signup` opens the same form on Create account. There is no `/signup`
// route: sign-in and sign-up are one form here, and the marketing site's
// `Start learning` CTA has to land on the half that creates an account.
// SOT: docs/pack/06-auth-onboarding-spec.md §7 · docs/pack/38-front-door-and-flow.md (FD-03)
// SOT-KEYWORDS: login page auth sign-in sign-up unbranded mode query param
import { LoginContent } from '@/components/auth/LoginContent';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  return <LoginContent initialMode={mode === 'signup' ? 'signup' : 'signin'} />;
}

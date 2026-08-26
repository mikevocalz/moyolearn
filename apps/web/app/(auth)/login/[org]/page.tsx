// /login/[org] — a district's branded sign-in.
//
// A SERVER component, so the district's name and mark are in the first paint. A
// client-side lookup would flash Moyo's own lockup and then swap it, which on a
// page whose entire job is "you are in the right place" is the one transition
// that undermines it.
//
// An unknown slug renders the plain sign-in rather than a 404: a mistyped or
// stale district link is far likelier than an attack, and a broken login helps
// nobody. The lookup is a public read by design — see org.service.ts.
// SOT: docs/pack/06-auth-onboarding-spec.md §5 §7 · CLAUDE.md §The block
// SOT-KEYWORDS: login district branded org slug server component co-branded auth
import type { Metadata } from 'next';
import { orgBrandingFor } from '@acme/app/server';
import { loadOrgBranding } from '@/lib/org.repository';
import { LoginContent } from '@/components/auth/LoginContent';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ org: string }>;
}): Promise<Metadata> {
  const { org: slug } = await params;
  const org = await orgBrandingFor(slug, loadOrgBranding);
  return org
    ? { title: `Sign in to ${org.name}`, description: `Sign in to Moyo for ${org.name}.` }
    : { title: 'Sign in' };
}

export default async function BrandedLoginPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const { org: slug } = await params;
  const org = await orgBrandingFor(slug, loadOrgBranding);
  return <LoginContent org={org ?? undefined} />;
}

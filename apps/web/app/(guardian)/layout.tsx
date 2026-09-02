import type { Metadata } from 'next';
import { RoleShell } from '../../components/site/RoleShell';

export const metadata: Metadata = {
  title: 'Family — Moyo',
  description: 'Your family learning dashboard.',
};

// The root layout owns the document, providers, and chrome; this RoleShell is
// the nested role wall only (it renders no second header — see InsideRoleShell).
export default function GuardianLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RoleShell allowedKinds={['guardian']}>{children}</RoleShell>;
}

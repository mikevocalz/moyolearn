import type { Metadata } from 'next';
import { RoleShell } from '../../components/site/RoleShell';

export const metadata: Metadata = {
  title: 'Business — Moyo',
  description: 'Your tutoring business overview.',
};

// The root layout owns the document, providers, and chrome; this RoleShell is
// the nested role wall only (it renders no second header — see InsideRoleShell).
export default function BusinessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RoleShell allowedKinds={['owner', 'staff']}>{children}</RoleShell>;
}

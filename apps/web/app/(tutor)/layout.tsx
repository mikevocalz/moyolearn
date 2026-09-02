import type { Metadata } from 'next';
import { RoleShell } from '../../components/site/RoleShell';

export const metadata: Metadata = {
  title: 'Tutor — Moyo',
  description: 'Your tutor dashboard.',
};

// The root layout owns the document, providers, and chrome; this RoleShell is
// the nested role wall only (it renders no second header — see InsideRoleShell).
export default function TutorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RoleShell allowedKinds={['tutor']}>{children}</RoleShell>;
}

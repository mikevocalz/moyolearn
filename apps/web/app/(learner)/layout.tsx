import type { Metadata } from 'next';
import { RoleShell } from '../../components/site/RoleShell';

export const metadata: Metadata = {
  title: 'Learner — Moyo',
  description: 'Your learning home.',
};

// The root layout owns the document, providers, and chrome; this RoleShell is
// the nested role wall only (it renders no second header — see InsideRoleShell).
export default function LearnerLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <RoleShell allowedKinds={['learner']}>{children}</RoleShell>;
}

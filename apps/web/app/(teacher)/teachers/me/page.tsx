import type { Metadata } from 'next';
import { TeacherHomeScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Teacher home — Moyo',
  description: 'Your classroom overview.',
};

export default function TeacherHomePage() {
  return <TeacherHomeScreen />;
}

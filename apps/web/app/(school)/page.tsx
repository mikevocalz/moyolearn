import type { Metadata } from 'next';
import { SchoolHomeScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'School overview — Moyo',
  description: 'Your school overview.',
};

export default function SchoolOverviewPage() {
  return <SchoolHomeScreen />;
}

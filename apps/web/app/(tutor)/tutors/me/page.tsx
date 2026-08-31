import type { Metadata } from 'next';
import { TutorTodayScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Today — Moyo Tutor',
  description: 'Your tutor day.',
};

export default function TutorTodayPage() {
  return <TutorTodayScreen />;
}

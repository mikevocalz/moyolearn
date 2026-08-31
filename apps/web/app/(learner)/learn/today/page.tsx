import type { Metadata } from 'next';
import { LearnerTodayScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Today — Moyo',
  description: 'Your learning plan for today.',
};

export default function LearnerTodayPage() {
  return <LearnerTodayScreen />;
}

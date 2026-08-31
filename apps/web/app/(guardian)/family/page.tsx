import type { Metadata } from 'next';
import { GuardianHomeScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Family — Moyo',
  description: 'Your family home feed.',
};

export default function GuardianHomePage() {
  return <GuardianHomeScreen />;
}

import type { Metadata } from 'next';
import { ScienceLabScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Science Lab — Moyo',
  description: 'Explore chemistry, biology, physics and Earth science through guided experiments.',
};

export default function ScienceLabPage() {
  return <ScienceLabScreen />;
}

import type { Metadata } from 'next';
import { DistrictHomeScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'District outcomes — Moyo',
  description: 'Your district outcomes.',
};

export default function DistrictOutcomesPage() {
  return <DistrictHomeScreen />;
}

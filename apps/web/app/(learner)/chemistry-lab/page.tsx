import type { Metadata } from 'next';
import { ChemistryLabScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Chemistry Lab — Moyo',
  description: 'Explore molecular energies with a guided chemistry experiment.',
};

export default function ChemistryLabPage() {
  return <ChemistryLabScreen />;
}

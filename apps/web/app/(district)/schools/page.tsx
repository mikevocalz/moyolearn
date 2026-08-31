import type { Metadata } from 'next';
import { InstitutionPlaceholderScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'Schools — Moyo',
  description: 'Schools in this district.',
};

export default function DistrictSchoolsPage() {
  return (
    <InstitutionPlaceholderScreen
      title="Schools"
      description="Schools in this district will appear here."
    />
  );
}

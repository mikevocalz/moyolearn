import type { Metadata } from 'next';
import { InstitutionPlaceholderScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'People — Moyo',
  description: 'People in this district.',
};

export default function DistrictPeoplePage() {
  return (
    <InstitutionPlaceholderScreen
      title="People"
      description="District staff and contacts will appear here."
    />
  );
}

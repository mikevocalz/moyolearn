import type { Metadata } from 'next';
import { InstitutionPlaceholderScreen } from '@acme/app';

export const metadata: Metadata = {
  title: 'People — Moyo',
  description: 'People in this school.',
};

export default function SchoolPeoplePage() {
  return (
    <InstitutionPlaceholderScreen
      title="People"
      description="School staff, learners and guardians will appear here."
    />
  );
}

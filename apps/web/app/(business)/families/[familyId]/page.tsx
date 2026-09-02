import { FamilyDetailScreen } from '@acme/app';

/*
  A thin unwrapper: the segment param becomes the screen's one prop. Detail is
  ROUTE-BASED per the org.crm contract's back_behavior — record → list →
  previous rail destination rides browser history, and a URL per household is
  what makes a family shareable and bookmarkable like every other CRM view
  (the lead-detail precedent, ADR-109's openability).
*/
export default async function FamilyDetailPage({
  params,
}: {
  params: Promise<{ familyId: string }>;
}) {
  const { familyId } = await params;
  return <FamilyDetailScreen familyId={familyId} />;
}

import { LeadDetailScreen } from '@acme/app';

/*
  A thin unwrapper: the segment param becomes the screen's one prop. Detail is
  ROUTE-BASED per the org.crm contract's back_behavior — record → pipeline →
  previous rail destination rides browser history, and a URL per record is what
  makes a lead shareable and bookmarkable like every other CRM view.
*/
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId } = await params;
  return <LeadDetailScreen leadId={leadId} />;
}

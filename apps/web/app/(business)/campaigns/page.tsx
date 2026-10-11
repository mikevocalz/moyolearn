// Owner workspace inside the existing business route group, never a learner tab.
// SOT: docs/business/creative-studio.md
// SOT-KEYWORDS: business campaign studio page newsletter
import { Suspense } from 'react';
import { headers } from 'next/headers';
import { LoadingSkeleton, Text } from '@acme/ui';
import { View } from '@acme/ui/primitives';
import { auth } from '@/lib/auth';
import { loadCampaignSettings } from '@/lib/campaigns/campaigns.service';
import { CampaignStudio } from '@/components/business/CampaignStudio';
export const metadata = { title: 'Campaign Studio — Moyo' };
async function Workspace() {
  const settings = await loadCampaignSettings(auth, await headers());
  if (settings.state === 'denied') return <View className="p-inset"><Text>Campaign Studio is available to your organization’s owner.</Text></View>;
  return <CampaignStudio key={settings.scopeKey} settings={settings} />;
}
export default function CampaignsPage() {
  return <Suspense fallback={<LoadingSkeleton count={4} className="m-inset" />}><Workspace /></Suspense>;
}

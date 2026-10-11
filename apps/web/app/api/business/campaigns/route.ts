// JSON email documents in; draft receipts out. There is intentionally no send,
// schedule, subscriber-import, or account-selection action on this route.
// SOT: docs/business/creative-studio.md
// SOT-KEYWORDS: business campaign API draft mailcheap
import { auth } from '@/lib/auth';
import { createCampaignDraft } from '@/lib/campaigns/campaigns.service';
import { campaignResponse } from '@/lib/campaigns/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return campaignResponse(request, (document, headers) => createCampaignDraft(auth, headers, document));
}

// Machine route: a private cron drives durable customer-data delivery.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing signaliq cron bearer retry outbox
import { drainMarketingOutbox } from '@/lib/marketing/marketing.service';
import { MarketingError } from '@/lib/marketing/contract';
import { recheckMoyoPaidInvoice } from '@acme/auth/server';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(request: Request) {
  try {
    const result = await drainMarketingOutbox(request, recheckMoyoPaidInvoice);
    console.info(
      JSON.stringify({
        event: 'moyo.marketing.sync',
        state: result.state,
        processed: result.processed,
      }),
    );
    return Response.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof MarketingError && error.status === 401)
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    console.error(
      JSON.stringify({ event: 'moyo.marketing.sync', state: 'failed' }),
    );
    return Response.json(
      { error: 'Marketing delivery could not finish.' },
      { status: 503 },
    );
  }
}

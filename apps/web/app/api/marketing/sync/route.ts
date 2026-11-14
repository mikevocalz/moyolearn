// Machine route: a private cron drives durable customer-data delivery.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing signaliq cron bearer retry outbox
import { drainMarketingOutbox } from '@/lib/marketing/marketing.service';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return Response.json(await drainMarketingOutbox(), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return Response.json(
      { error: 'Marketing delivery could not finish.' },
      { status: 503 },
    );
  }
}

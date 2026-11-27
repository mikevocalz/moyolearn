// Native Payload admin view for Moyo's own sales, never a customer operations page.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing internal admin payload view inquiry
import type { AdminViewServerProps, ServerProps } from 'payload';
import { DefaultTemplate } from '@payloadcms/ui/rsc';
import { Banner, Button, Gutter } from '@payloadcms/ui';
import { marketingInbox, isMarketingAdministrator } from '@acme/app/marketing';
import { MarketingError } from '@acme/app/marketing-contract';
import { MarketingInquiriesClient } from './MarketingInquiriesClient';

export async function MarketingInquiriesView(props: AdminViewServerProps) {
  let data: Awaited<ReturnType<typeof marketingInbox>> | null = null;
  let failure = '';
  try {
    data = await marketingInbox(props.initPageResult.req);
  } catch (error) {
    failure =
      error instanceof MarketingError
        ? error.message
        : 'The sales inbox is temporarily unavailable.';
  }
  return (
    <DefaultTemplate
      {...props}
      visibleEntities={props.initPageResult.visibleEntities}
    >
      <Gutter>
        <h1>Moyo inquiries</h1>
        <p>
          Adult requests from Moyo’s website, with confirmed delivery and
          business follow-ups. This is Moyo’s internal sales inbox.
        </p>
        {data ? (
          <MarketingInquiriesClient initialData={data} />
        ) : (
          <Banner type="danger">{failure}</Banner>
        )}
      </Gutter>
    </DefaultTemplate>
  );
}
export function MarketingInquiriesNav({ user }: ServerProps) {
  if (!isMarketingAdministrator(user ?? null)) return null;
  return (
    <Button el="link" buttonStyle="ghost" url="/admin/moyo-inquiries">
      Moyo inquiries
    </Button>
  );
}

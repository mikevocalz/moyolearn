import { createAuth } from '@acme/auth/server';
import { recordMarketingPayment } from './marketing/marketing.service';

export const auth = createAuth({onBillingPayment:recordMarketingPayment});

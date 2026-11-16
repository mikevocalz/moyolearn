import 'server-only';
// Marketing's public server API. Hosts consume services, never repository paths.
// SOT: docs/site/signaliq-business-connection.md · docs/pack/11-architectural-guardrails.md
// SOT-KEYWORDS: marketing public api barrel index server
export {
  marketingInbox,
  updateMarketingInquiry,
  receivePublicInquiry,
  recordMarketingPayment,
  drainMarketingOutbox,
  marketingOrigin,
} from './services/marketing.service.ts';
export {
  isMarketingAdministrator,
  marketingIdentityAccess,
} from './permissions/marketing.permissions.ts';

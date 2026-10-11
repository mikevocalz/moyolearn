import 'server-only';
// Owner-only pilot. The business RoleShell is courtesy; this is the boundary.
// Sending and audience selection remain outside this API entirely.
// SOT: docs/business/creative-studio.md · packages/app/core/protected-operation.ts
// SOT-KEYWORDS: business campaign service owner tenant protected operation mailcheap
import type { Auth } from '@acme/auth/server';
import { CapabilityDenied, HostTenantDenied, MembershipDenied, protectedOperation } from '@acme/app/server';
import type { CampaignDocument } from './document.ts';
import { connectionFor, createMailcheapDraft, MailcheapError } from './mailcheap.ts';
import { renderCampaign } from './render.ts';
import { emailTheme } from './theme.ts';

export async function loadCampaignSettings(auth: Auth, headers: Headers) {
  try {
    return await protectedOperation(auth, headers, async (ctx) => {
      if (ctx.isLearner || !ctx.orgId) return { state: 'denied' as const };
      const scopeKey = `${ctx.orgId}:${ctx.learnerId}`;
      const connection = connectionFor(process.env.MAILCHEAP_CONNECTIONS_JSON, ctx.orgId);
      if (!connection) return { state: 'unconfigured' as const, scopeKey };
      return { state: 'ready' as const, scopeKey, origin: connection.origin, newsletter: connection.newsletter, brand: connection.brand };
    }, {
      requires: 'practise', requiresMembership: ['owner'],
      telemetry: { op: 'campaigns.settings', resource: 'campaigns', action: 'read' },
    });
  } catch (error) {
    if (error instanceof MembershipDenied || error instanceof HostTenantDenied ||
        (error instanceof Error && error.message === 'Unauthenticated')) return { state: 'denied' as const };
    throw error;
  }
}
export type CampaignSettings = Exclude<Awaited<ReturnType<typeof loadCampaignSettings>>, { state: 'denied' }>;

export async function createCampaignDraft(auth: Auth, headers: Headers, document: CampaignDocument) {
  try {
    return await protectedOperation(auth, headers, async (ctx) => {
      if (ctx.isLearner || !ctx.orgId) throw new MailcheapError('Only a business owner may create a marketing draft.', 403);
      const connection = connectionFor(process.env.MAILCHEAP_CONNECTIONS_JSON, ctx.orgId);
      if (!connection) throw new MailcheapError('Your business has not connected a Mailcheap instance.', 503);
      const html = renderCampaign(document, connection.brand, emailTheme);
      return createMailcheapDraft(connection, document, html);
    }, {
      requires: 'write', requiresMembership: ['owner'],
      telemetry: { op: 'campaigns.create-draft', resource: 'campaigns', action: 'create' },
    });
  } catch (error) {
    if (error instanceof MembershipDenied || error instanceof HostTenantDenied) {
      throw new MailcheapError('Only a business owner may create a marketing draft.', 403);
    }
    if (error instanceof CapabilityDenied) throw new MailcheapError('Your organization cannot create drafts with its current plan status.', 402);
    if (error instanceof Error && error.message === 'Unauthenticated') throw new MailcheapError('Sign in again to create a draft.', 401);
    throw error;
  }
}

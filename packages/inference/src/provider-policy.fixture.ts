// Synthetic approvals for isolated fake-transport tests. Never production records.
// SOT-KEYWORDS: provider policy test fixture fake approval
import 'server-only';
import { providerApproval, INFERENCE_SAFETY_VERSION } from './provider-policy.ts';

export const fixtureApproval = () => ({
  ...providerApproval('anthropic-api'),
  endpoint: 'https://api.anthropic.com',
  reference: 'test-fixture-not-an-approval',
  effectiveAt: '2026-01-01T00:00:00.000Z',
  reviewAt: '2099-01-01T00:00:00.000Z',
  ageScopes: ['under-18'] as const,
  tasks: ['tutor-turn', 'classify-input', 'classify-output', 'topic-fence', 'summary-narrative'] as const,
  models: ['claude-opus-5', 'claude-haiku-4-5'] as const,
  regions: ['US'],
  retention: 'zero-retention',
  safetyVersion: INFERENCE_SAFETY_VERSION,
});
export const fixtureApprovals = async () => [fixtureApproval()];

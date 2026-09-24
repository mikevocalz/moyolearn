// Server-owned provider approvals. Credentials authenticate; they do not approve use.
// SOT: homework master V3 §§7,10,30,33 · docs/pack/18-tutor-ai-stack.md
// SOT-KEYWORDS: provider policy eligibility approval age retention egress fail closed
import 'server-only';
import type { ModelId } from './models.ts';
import type { InferenceRole } from './types.ts';

export const PROVIDER_PRODUCTS = {
  'anthropic-api': { vendor: 'anthropic', endpoint: 'https://api.anthropic.com', scope: 'learner' },
  'gemini-developer-api': { vendor: 'google', endpoint: 'https://generativelanguage.googleapis.com', scope: 'eval-only' },
  'gemini-vertex': { vendor: 'google', endpoint: 'vertex-ai', scope: 'blocked' },
  'gemini-nano': { vendor: 'google', endpoint: 'ml-kit-genai', scope: 'blocked' },
  'apple-foundation-models': { vendor: 'apple', endpoint: 'on-device', scope: 'blocked' },
  mathpix: { vendor: 'mathpix', endpoint: 'https://api.mathpix.com', scope: 'blocked' },
  myscript: { vendor: 'myscript', endpoint: 'myscript-sdk', scope: 'blocked' },
} as const;
export type ProviderProduct = keyof typeof PROVIDER_PRODUCTS;

/** Empty fields are deliberately ineligible; this factory is not an approval. */
export function providerApproval(product: ProviderProduct) {
  return {
    product,
    endpoint: '',
    reference: '',
    effectiveAt: '',
    reviewAt: '',
    ageScopes: [] as readonly ('under-18' | '18-plus')[],
    tasks: [] as readonly InferenceRole[],
    models: [] as readonly ModelId[],
    regions: [] as readonly string[],
    retention: '',
    training: false,
    safetyVersion: '',
    permittedTools: [] as readonly string[],
  };
}
export type ProviderApproval = Readonly<ReturnType<typeof providerApproval>>;
export type LoadProviderApprovals = () => Promise<readonly ProviderApproval[]>;

// No private agreement or approval has been supplied. Do not replace these with
// inferred permissions from public documentation or the presence of a key.
const APPROVALS: readonly ProviderApproval[] = [];
export const loadProviderApprovals: LoadProviderApprovals = async () => APPROVALS;

/*
  THE TEST ACCOUNT, AND ONLY THE TEST ACCOUNT. Mock auth is one identity
  (`dev-learner-1`, packages/app/core/protected-operation.ts) that exists only
  when NEXT_PUBLIC_AUTH_MODE=mock under NODE_ENV=development — never a real
  child, never a production process. The product owner's call (2026-09-24)
  was that this account is not gated on a provider approval. So under exactly
  that mode, and no other, the loader answers with a record shaped to pass
  `requireLearnerProviderApproval` whose reference says in words that it is
  not an approval. Every other mode still sees the empty list and fails
  closed. Grep TEST_ACCOUNT_APPROVAL to find the only place this exists.
*/
export const TEST_ACCOUNT_APPROVAL = 'test-account-not-an-approval-mock-auth-only';
const isMockDev = () =>
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_AUTH_MODE === 'mock';
export const loadTestAccountApprovals: LoadProviderApprovals = async () =>
  isMockDev()
    ? [
        {
          ...providerApproval('anthropic-api'),
          endpoint: PROVIDER_PRODUCTS['anthropic-api'].endpoint,
          reference: TEST_ACCOUNT_APPROVAL,
          effectiveAt: '2026-01-01T00:00:00.000Z',
          reviewAt: '2099-01-01T00:00:00.000Z',
          ageScopes: ['under-18'],
          tasks: ['tutor-turn', 'classify-input', 'classify-output', 'topic-fence', 'summary-narrative'],
          models: ['claude-opus-5', 'claude-haiku-4-5'],
          regions: ['US'],
          retention: 'zero-retention',
          safetyVersion: INFERENCE_SAFETY_VERSION,
        },
      ]
    : APPROVALS;
export const INFERENCE_SAFETY_VERSION = 'moyo-safety-plane-v1';

export class ProviderPolicyDenied extends Error {
  constructor() {
    super('Provider approval does not cover this request');
    this.name = 'ProviderPolicyDenied';
  }
}

/** The existing gateway serves learner data only, conservatively including minors. */
export function requireLearnerProviderApproval(
  records: readonly ProviderApproval[],
  product: ProviderProduct,
  task: InferenceRole,
  model: ModelId,
  now: Date,
): void {
  const catalog = PROVIDER_PRODUCTS[product];
  const matching = records.filter((record) => record.product === product);
  const record = matching[0];
  // Multiple records are ambiguous, including an overlapping stale approval.
  if (catalog.scope !== 'learner' || matching.length !== 1 || !record) throw new ProviderPolicyDenied();
  const effective = Date.parse(record.effectiveAt);
  const review = Date.parse(record.reviewAt);
  if (
    !record.reference.trim() || record.endpoint !== catalog.endpoint ||
    !Number.isFinite(now.getTime()) || !Number.isFinite(effective) || !Number.isFinite(review) ||
    new Date(effective).toISOString() !== record.effectiveAt || new Date(review).toISOString() !== record.reviewAt ||
    effective > now.getTime() || review <= now.getTime() || effective >= review ||
    !record.ageScopes.includes('under-18') || !record.tasks.includes(task) || !record.models.includes(model) ||
    !record.regions.includes('US') || record.retention !== 'zero-retention' || record.training ||
    record.safetyVersion !== INFERENCE_SAFETY_VERSION || record.permittedTools.length !== 0
  ) throw new ProviderPolicyDenied();
}

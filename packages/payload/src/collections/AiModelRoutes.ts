import type { Access, CollectionConfig } from 'payload';

/**
 * Server-side access control for the AI Control Center. The current User
 * collection has no trusted "senior admin" role, so deny by default until an
 * operations-owned allowlist exists. Authenticated does NOT mean administrator.
 */
export function isAiModelAdministrator(user: { email?: string | null } | null | undefined, allowlist: string | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email || !allowlist) return false;
  return allowlist.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean).includes(email);
}

const seniorAdminOnly: Access = ({ req }) =>
  isAiModelAdministrator(
    { email: typeof req.user?.email === 'string' ? req.user.email : undefined },
    process.env.MOYO_AI_ADMIN_EMAILS,
  );

export const AiModelRoutes: CollectionConfig = {
  slug: 'ai-model-routes',
  admin: {
    useAsTitle: 'lane',
    defaultColumns: ['lane', 'primaryModel', 'fallbackModel', 'mode', 'updatedAt'],
    group: 'AI Control Center',
    description: 'Evaluation selections only. Production tutor routing remains code-owned until provider approval and grade-band evaluations pass.',
  },
  access: {
    admin: seniorAdminOnly,
    read: seniorAdminOnly,
    create: seniorAdminOnly,
    update: seniorAdminOnly,
    delete: () => false,
  },
  // Mandatory repo rule: do not silently add an unswept _v shadow table.
  // Durable audit events must be implemented separately before promotion.
  versions: false,
  fields: [
    {
      name: 'lane',
      type: 'select',
      required: true,
      unique: true,
      index: true,
      options: [
        { label: 'Mathematics tutoring', value: 'tutor-math' },
        { label: 'Reading and writing', value: 'tutor-ela' },
        { label: 'Science tutoring', value: 'tutor-science' },
        { label: 'History and social studies', value: 'tutor-social-studies' },
        { label: 'Computer science', value: 'tutor-cs' },
        { label: 'World languages', value: 'tutor-world-language' },
        { label: 'Other school subjects', value: 'tutor-other' },
        { label: 'Parent report narrative', value: 'summary-narrative' },
        { label: 'Homework text structuring', value: 'homework-structuring' },
      ],
    },
    {
      name: 'primaryModel',
      type: 'select',
      required: true,
      defaultValue: 'claude-opus-5',
      options: [
        { label: 'Claude Opus 5', value: 'claude-opus-5' },
        { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5' },
      ],
      admin: { description: 'Evaluation preference only. Does not change the live InferenceGateway.' },
    },
    {
      name: 'fallbackModel',
      type: 'select',
      required: true,
      defaultValue: 'none',
      options: [
        { label: 'No fallback (current production behavior)', value: 'none' },
        { label: 'Qwen 3.8 Max (evaluation candidate)', value: 'qwen3.8-max' },
      ],
      admin: { description: 'Exactly one Qwen candidate. Never retry a provider refusal or a safety block.' },
    },
    {
      name: 'mode',
      type: 'select',
      required: true,
      defaultValue: 'disabled',
      options: [
        { label: 'Disabled', value: 'disabled' },
        { label: 'Synthetic evaluation only', value: 'evaluation-only' },
      ],
      admin: { description: 'No production-enabled option exists until provider review, safe audit and per-cell evaluation are implemented.' },
    },
    { name: 'providerApprovalReference', type: 'text', admin: { description: 'Reference only. An admin-entered value does not grant learner-data access.' } },
    { name: 'subjectEvaluationReference', type: 'text', admin: { description: 'Reference only. Publishing requires verifying a real passing evaluation record server-side.' } },
    { name: 'notes', type: 'textarea' },
  ],
};

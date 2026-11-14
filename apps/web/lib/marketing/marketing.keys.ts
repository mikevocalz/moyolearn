// Owner records are cached only inside the current identity and organization.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing query keys identity organization scope
export const marketingKeys = {
  all: () => ['moyo-marketing-inquiries'] as const,
  inbox: (userId?: string, orgId?: string) =>
    [...marketingKeys.all(), userId ?? null, orgId ?? null] as const,
};

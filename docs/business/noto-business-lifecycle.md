# Business lifecycle integration

## Scope and source of truth

Extend existing calendar and Payload CRM for commercial tuition plan, session attendance, makeup credits, invoices, collections, tutor compensation and guardian billing. Keep institutional enrollment separate; separate SaaS subscription, tuition, and payroll. Define versioned policies, idempotent operations, external provider reconciliation and financial audit. Reuse existing app UI, tokens, protectedOperation and repositories. No duplicate schedule or CRM, no dead navigation. Follow impeccable, no-ai-slop and relevant Expo/React skills. Acceptance: inquiry to trial to paid tutoring to attendance to invoice and tutor payable, with failure/retry tests. This PR documents boundaries and tests, not an implemented payment system.

## Review gates

- Verify current source paths and existing domain exports before implementation.
- Keep PR draft until cold-cache typecheck, tests, responsive device checks and permission tests pass.
- Validate every changed UI state: loading, empty, error, forbidden, stale and saved.
- No duplicate components, arbitrary gradients, generic AI marketing copy or fake metrics.

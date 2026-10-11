# Payload CRM integration

## Scope and source of truth

Reuse existing Payload Leads, Families, Enrollments, Sessions and ops service; do not duplicate CRM or confuse institutional Enrollments with commercial agreements. Preserve super-admin admin-vite isolation. Implement scoped activity, relationship context and lead/family to existing schedule handoff. Design: existing RoleShell, @acme/ui semantic components and tokens; no raw HTML, AI slop or decorative dashboards. Audit cross-tenant permissions and guardian/learner data wall. Follow CONTRIBUTING, impeccable, no-ai-slop, React and Expo skills. Acceptance: one family identity through lead, trial and booking; admin and app agree; no learner mastery in marketing. This PR is a scoped design contract.

## Review gates

- Verify current source paths and existing domain exports before implementation.
- Keep PR draft until cold-cache typecheck, tests, responsive device checks and permission tests pass.
- Validate every changed UI state: loading, empty, error, forbidden, stale and saved.
- No duplicate components, arbitrary gradients, generic AI marketing copy or fake metrics.

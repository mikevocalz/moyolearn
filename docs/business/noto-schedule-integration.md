# Schedule integration

## Scope and source of truth

Use existing /schedule, ScheduleGrid, BookingForm, Zustand and @acme/ui. Replace DEMO_DAY with organization-scoped Payload Sessions calendar read model; add date-range and timezone handling, stable tutor resource IDs, server-side conflict checks, durable create/move, rollback on failure, refresh and cross-device tests. No second calendar. Follow CONTRIBUTING.md, React best practices, foldable skill swiftui-iphone-duo transferable principles, expo/skills, impeccable, no-ai-slop. UI: existing tokens, semantic components, compact agenda and hinge-safe pane; no raw HTML. Acceptance: real Payload session visible, booking survives refresh, concurrent conflict rejected. This PR is a design/implementation contract, not completed runtime integration.

## Review gates

- Verify current source paths and existing domain exports before implementation.
- Keep PR draft until cold-cache typecheck, tests, responsive device checks and permission tests pass.
- Validate every changed UI state: loading, empty, error, forbidden, stale and saved.
- No duplicate components, arbitrary gradients, generic AI marketing copy or fake metrics.

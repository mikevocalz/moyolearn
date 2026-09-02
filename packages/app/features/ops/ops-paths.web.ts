// Org CRM route paths — web fork. The CRM rail group's destinations live at
// top-level routes under the (business) shell (nav.ts ORG_RAIL: /leads,
// /families, /enrollment), so the ONE thing allowed to differ per platform —
// the pushed href — lives in this fork pair instead of a runtime `Platform.OS`
// branch (repo fork law; the classes-paths trio is the precedent).
// SOT: apps/web/components/site/nav.ts (ORG_RAIL) · design/screens/org/org.crm/contract.md
// SOT-KEYWORDS: ops paths routes web leads families enrollment detail href fork

/** `/leads` — the pipeline; the lead-detail back link lands here. */
export const leadsRootPath = () => '/leads';

/** `/leads/[leadId]` — the record detail (route-based per contract back_behavior). */
export const leadDetailPath = (leadId: string) => `/leads/${encodeURIComponent(leadId)}`;

/** `/families` — the interim server-derived family grouping. */
export const familiesRootPath = () => '/families';

/** `/enrollment` — the completion queue over the same pipeline machinery. */
export const enrollmentRootPath = () => '/enrollment';

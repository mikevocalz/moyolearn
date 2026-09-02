// Org CRM route paths — native fork. There ARE no native CRM routes, by
// contract: org.crm is web-first and the mobile org companion is
// Overview·Schedule·Inbox·Safety only (design/screens/org/org.crm/contract.md
// `shell:`). This fork exists because Metro resolves the trio for any bundle
// that imports the ops feature — the mobile Overview does — and its functions
// resolve to the Overview tab so a stray call lands on a real surface instead
// of a 404. Nothing mounted on mobile calls them today.
// SOT: apps/mobile/app/(org)/(tabs)/_layout.tsx · design/screens/org/org.crm/contract.md
// SOT-KEYWORDS: ops paths routes native mobile no crm overview fallback fork

export const leadsRootPath = () => '/overview';

export const leadDetailPath = (_leadId: string) => '/overview';

export const familiesRootPath = () => '/overview';

export const enrollmentRootPath = () => '/overview';

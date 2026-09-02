'use client';
// View state for org.safety's web queue — which severity/lifecycle slice the
// list is narrowed to, and which incident's detail is open. Zustand, not
// useState, because FilterBar owns ZERO state by law and its owner off-web is
// "the screen's zustand store" (FilterBar header; tutor-incidents.store
// precedent). Session-only and unpersisted for the same reason as its sibling:
// a filter is how the triager was LOOKING at the queue, not something they
// made — and a persisted severity filter on a safety queue would be a hidden
// S4 waiting to happen.
// SOT: design/screens/org/org.safety/contract.md · packages/app/features/safety/tutor-incidents.store.ts
// SOT-KEYWORDS: org safety store zustand severity status filter open detail triage view state

import { create } from 'zustand';
import type { TriageRow } from './incidents.service.ts';

export type QueueSeverityFilter = TriageRow['severity'] | 'all';
export type QueueStatusFilter = TriageRow['status'] | 'all';

interface OrgSafetyState {
  severityFilter: QueueSeverityFilter;
  statusFilter: QueueStatusFilter;
  /** The row whose detail (triage controls) is open; one at a time. */
  openIncidentId: string | null;
  setSeverityFilter: (severityFilter: QueueSeverityFilter) => void;
  setStatusFilter: (statusFilter: QueueStatusFilter) => void;
  toggleIncident: (incidentId: string) => void;
  clearFilters: () => void;
}

export const useOrgSafetyStore = create<OrgSafetyState>((set) => ({
  severityFilter: 'all',
  statusFilter: 'all',
  openIncidentId: null,
  setSeverityFilter: (severityFilter) => set({ severityFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  toggleIncident: (incidentId) =>
    set((s) => ({ openIncidentId: s.openIncidentId === incidentId ? null : incidentId })),
  clearFilters: () => set({ severityFilter: 'all', statusFilter: 'all' }),
}));

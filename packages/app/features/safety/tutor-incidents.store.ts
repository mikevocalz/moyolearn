'use client';
// The contract's [add]: view state for tutor.incidents — which status the list
// is narrowed to, and which incident is open. Zustand, not useState, because
// FilterBar owns ZERO state by law and its owner off-web is "the screen's
// zustand store" (FilterBar header; assign.store precedent). Session-only and
// unpersisted for assign.store's own reason: a filter is how the tutor was
// LOOKING at the list, not something they made.
// SOT: design/screens/tutor/tutor.incidents/contract.md · packages/app/features/assignments/assign.store.ts
// SOT-KEYWORDS: tutor incidents store zustand status filter open detail view state

import { create } from 'zustand';
import type { TutorIncidentView } from './incidents.service.ts';

export type TutorIncidentStatusFilter = TutorIncidentView['status'] | 'all';

interface TutorIncidentsState {
  statusFilter: TutorIncidentStatusFilter;
  /** The row whose detail (timeline + note composer) is open; one at a time. */
  openIncidentId: string | null;
  setStatusFilter: (statusFilter: TutorIncidentStatusFilter) => void;
  toggleIncident: (incidentId: string) => void;
}

export const useTutorIncidentsStore = create<TutorIncidentsState>((set) => ({
  statusFilter: 'all',
  openIncidentId: null,
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  toggleIncident: (incidentId) =>
    set((s) => ({ openIncidentId: s.openIncidentId === incidentId ? null : incidentId })),
}));

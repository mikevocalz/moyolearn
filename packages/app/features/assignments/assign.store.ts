'use client';
// The contract's one [add]: the assignment DRAFT a teacher is composing.
// Zustand, not useState — the draft outlives the create screen (back keeps it,
// contract back_behavior: "drafts are kept, never silently discarded") and is
// read by more than one surface (the form composes it, the tracking list is
// where it resumes from).
//
// Persisted (contract cross_device_continuity): drafts are per-device until
// published — MMKV native / localStorage web through the assign storage fork.
// ONLY the draft fields persist. The in-flight facts (`savedAssignmentId`,
// `submitIntent`) and the list's view filters stay session-only for the same
// reason the guardian store excludes its commit flags: a resumed draft must
// never reopen mid-publish or claim a server row this device can no longer
// prove exists, and a filter is how the teacher was LOOKING at the list, not
// something they made.
// SOT: design/screens/teacher/teacher.assign/contract.md · features/onboarding/guardian/store.ts
// SOT-KEYWORDS: assign store zustand draft persist mmkv work items filters teacher assignment

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { assignStateStorage } from './assign-storage';
import type { AssignmentStatus, AssignmentWorkItem } from './assignments.types.ts';

/** What the teacher has composed so far — CreateAssignmentInput, half-built. */
export interface AssignDraft {
  classId: string | null;
  title: string;
  subject: string;
  /** As typed (YYYY-MM-DD) — validated at the form, rendered in plain speech. */
  dueAt: string;
  workItems: AssignmentWorkItem[];
}

export const EMPTY_ASSIGN_DRAFT: AssignDraft = {
  classId: null,
  title: '',
  subject: '',
  dueAt: '',
  workItems: [],
};

export type AssignStatusFilter = AssignmentStatus | 'all';

interface AssignState {
  draft: AssignDraft;
  /**
   * The working copy of a SERVER draft being edited, seeded from the row the
   * edit form loaded. Session-only, like the in-flight facts: the server row
   * is its truth, so a reload just re-seeds — and it must never displace the
   * persisted `draft`, or opening Edit would silently discard a half-composed
   * NEW assignment (contract back_behavior).
   */
  editDraft: AssignDraft;
  /** Which server row `editDraft` mirrors — null when no edit session is open. */
  editingAssignmentId: string | null;
  /**
   * Server id of this draft once `POST` has accepted it — the publish-retry
   * key. A failed publish leaves that row a draft (contract publish_failed);
   * retrying publishes IT instead of creating a twin. Session-only.
   */
  savedAssignmentId: string | null;
  /** Which submit is in flight — 'draft' or 'publish' — so each button can own its spinner. */
  submitIntent: 'draft' | 'publish' | null;
  /** Tracking-list view filters (FilterBar owns zero state — the screen does). */
  statusFilter: AssignStatusFilter;
  classFilter: string | null;
  patch: (patch: Partial<AssignDraft>) => void;
  addWorkItem: (item: AssignmentWorkItem) => void;
  removeWorkItem: (index: number) => void;
  /** Template cards toggle: present (by templateId) → removed; absent → added. */
  toggleTemplateItem: (item: AssignmentWorkItem & { templateId: string }) => void;
  /** Opens an edit session: `editDraft` becomes the ACTIVE draft the composer mutators write to. */
  beginEdit: (assignmentId: string, seed: AssignDraft) => void;
  /** Closes the edit session (the edit form's unmount) — the create draft is active again. */
  endEdit: () => void;
  setSavedAssignmentId: (savedAssignmentId: string | null) => void;
  setSubmitIntent: (submitIntent: 'draft' | 'publish' | null) => void;
  setStatusFilter: (statusFilter: AssignStatusFilter) => void;
  setClassFilter: (classFilter: string | null) => void;
  /** Publish/save succeeded — the server row is the truth now. */
  clearDraft: () => void;
}

export const useAssignStore = create<AssignState>()(
  persist(
    (set) => {
      /*
        The composer mutators write to whichever draft is ACTIVE — the edit
        working copy while an edit session is open, the persisted create
        draft otherwise — so the form's field mirror and work-item composer
        are mode-blind. The edit form brackets its session with
        beginEdit/endEdit (mount/unmount), which is what makes this routing
        safe: no create form accepts input while a session is open.
      */
      const setActive = (mutate: (draft: AssignDraft) => AssignDraft) =>
        set((s) =>
          s.editingAssignmentId !== null
            ? { editDraft: mutate(s.editDraft) }
            : { draft: mutate(s.draft) },
        );
      return {
        draft: EMPTY_ASSIGN_DRAFT,
        editDraft: EMPTY_ASSIGN_DRAFT,
        editingAssignmentId: null,
        savedAssignmentId: null,
        submitIntent: null,
        statusFilter: 'all',
        classFilter: null,
        patch: (patch) => setActive((draft) => ({ ...draft, ...patch })),
        addWorkItem: (item) =>
          setActive((draft) => ({ ...draft, workItems: [...draft.workItems, item] })),
        removeWorkItem: (index) =>
          setActive((draft) => ({
            ...draft,
            workItems: draft.workItems.filter((_, i) => i !== index),
          })),
        toggleTemplateItem: (item) =>
          setActive((draft) => ({
            ...draft,
            workItems: draft.workItems.some((w) => w.templateId === item.templateId)
              ? draft.workItems.filter((w) => w.templateId !== item.templateId)
              : [...draft.workItems, item],
          })),
        beginEdit: (assignmentId, seed) =>
          set({ editingAssignmentId: assignmentId, editDraft: seed }),
        endEdit: () => set({ editingAssignmentId: null, editDraft: EMPTY_ASSIGN_DRAFT }),
        setSavedAssignmentId: (savedAssignmentId) => set({ savedAssignmentId }),
        setSubmitIntent: (submitIntent) => set({ submitIntent }),
        setStatusFilter: (statusFilter) => set({ statusFilter }),
        setClassFilter: (classFilter) => set({ classFilter }),
        clearDraft: () => set({ draft: EMPTY_ASSIGN_DRAFT, savedAssignmentId: null }),
      };
    },
    {
      name: 'assign-draft',
      storage: createJSONStorage(() => assignStateStorage),
      // Draft fields ONLY — never the in-flight flags or view filters (header).
      partialize: (s) => ({ draft: s.draft }),
    },
  ),
);

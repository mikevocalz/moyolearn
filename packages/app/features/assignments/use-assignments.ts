'use client';
// useTeacherAssignments / useAssignment / useCreateAssignment /
// useEditAssignment / useAssignmentAction — the client models for
// teacher.assign's tracking list, draft field edits, and lifecycle, on the
// use-reports.ts pattern: exported key factories,
// exact-key invalidation, server data in Query only. The DRAFT a teacher is
// composing is not here — that is assign.store's job (Zustand + MMKV, per the
// contract); these hooks own only what the server has accepted.
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/app/features/summary/use-reports.ts
// SOT-KEYWORDS: assignments hooks client query teacher tracking list detail create edit publish close extend keys
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Assignment,
  AssignmentWithCounts,
  CreateAssignmentInput,
  EditAssignmentInput,
} from './assignments.types.ts';
import { API_URL } from '../../core/api-url.ts';
import { getJson } from '../../core/api-fetch.ts';

export const teacherAssignmentsQueryKey = (classId?: string) =>
  classId === undefined
    ? (['teacher-assignments'] as const)
    : (['teacher-assignments', { classId }] as const);
export const assignmentQueryKey = (assignmentId: string) =>
  ['teacher-assignment', assignmentId] as const;

export function useTeacherAssignments(classId?: string) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: teacherAssignmentsQueryKey(classId),
    queryFn: async ({ signal }) =>
      (
        // Reads carry the completion counts ("X of Y done"); writes below
        // still traffic in the plain Assignment the server returns.
        await getJson<{ assignments: AssignmentWithCounts[] }>(
          `/api/teacher/assignments${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`,
          signal,
        )
      ).assignments,
    placeholderData: keepPreviousData,
  });
  // The use-tutor-incidents inline-retry idiom: readers with no cached copy
  // (teacher Home's due-soon strip on a cold failure) retry the same read in
  // place instead of asking for a reload.
  return {
    assignments: data ?? [],
    loading: isPending,
    error,
    retry: () => {
      void refetch();
    },
  };
}

export function useAssignment(assignmentId: string) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: assignmentQueryKey(assignmentId),
    queryFn: async ({ signal }) =>
      (
        await getJson<{ assignment: AssignmentWithCounts }>(
          `/api/teacher/assignments/${encodeURIComponent(assignmentId)}`,
          signal,
        )
      ).assignment,
    enabled: assignmentId.length > 0,
  });
  // Inline-retry callable (the use-tutor-incidents idiom): the detail screen's
  // error branch retries the same read, never a page reload.
  return {
    assignment: data ?? null,
    loading: isPending,
    error,
    retry: () => {
      void refetch();
    },
  };
}

/*
  Both tracking-list shapes go stale on any write: the unfiltered list and
  every per-class filter share the `teacher-assignments` prefix, so one
  prefix invalidation covers them without naming each classId.
*/
export function useCreateAssignment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAssignmentInput): Promise<Assignment> => {
      const res = await fetch(`${API_URL}/api/teacher/assignments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return ((await res.json()) as { assignment: Assignment }).assignment;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: teacherAssignmentsQueryKey() });
    },
  });
}

/**
 * The field-edit mutation: patches a DRAFT's fields (PATCH action 'edit').
 * A sibling of `useAssignmentAction`, not a fourth case of it — a field patch
 * carries a `fields` object where the lifecycle actions carry at most a
 * dueAt, and the server refuses it for non-drafts.
 */
export function useEditAssignment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: { assignmentId: string } & EditAssignmentInput,
    ): Promise<Assignment> => {
      const { assignmentId, ...fields } = input;
      const res = await fetch(
        `${API_URL}/api/teacher/assignments/${encodeURIComponent(assignmentId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'edit', fields }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return ((await res.json()) as { assignment: Assignment }).assignment;
    },
    onSuccess: (_updated, { assignmentId }) => {
      void client.invalidateQueries({ queryKey: assignmentQueryKey(assignmentId) });
      void client.invalidateQueries({ queryKey: teacherAssignmentsQueryKey() });
    },
  });
}

/**
 * The lifecycle mutation: publish, close, or extend (extend carries dueAt).
 * `assignmentId` arrives at MUTATE time, not hook time: the create form's
 * publish targets an id that exists only after the create call resolves, so a
 * hook-time id would always be one render stale there.
 */
export function useAssignmentAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      assignmentId: string;
      action: 'publish' | 'close' | 'extend';
      dueAt?: string;
    }): Promise<Assignment> => {
      const { assignmentId, ...body } = input;
      const res = await fetch(
        `${API_URL}/api/teacher/assignments/${encodeURIComponent(assignmentId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return ((await res.json()) as { assignment: Assignment }).assignment;
    },
    onSuccess: (_updated, { assignmentId }) => {
      void client.invalidateQueries({ queryKey: assignmentQueryKey(assignmentId) });
      void client.invalidateQueries({ queryKey: teacherAssignmentsQueryKey() });
    },
  });
}

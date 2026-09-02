'use client';
// useTeacherAssignments / useAssignment / useCreateAssignment /
// useAssignmentAction — the client models for teacher.assign's tracking list
// and lifecycle, on the use-reports.ts pattern: exported key factories,
// exact-key invalidation, server data in Query only. The DRAFT a teacher is
// composing is not here — that is assign.store's job (Zustand + MMKV, per the
// contract); these hooks own only what the server has accepted.
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/app/features/summary/use-reports.ts
// SOT-KEYWORDS: assignments hooks client query teacher tracking list detail create publish close extend keys
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Assignment, CreateAssignmentInput } from './assignments.types.ts';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

export const teacherAssignmentsQueryKey = (classId?: string) =>
  classId === undefined
    ? (['teacher-assignments'] as const)
    : (['teacher-assignments', { classId }] as const);
export const assignmentQueryKey = (assignmentId: string) =>
  ['teacher-assignment', assignmentId] as const;

async function getJson<T>(path: string, signal: AbortSignal | undefined): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
  return (await res.json()) as T;
}

export function useTeacherAssignments(classId?: string) {
  const { data, isPending, error } = useQuery({
    queryKey: teacherAssignmentsQueryKey(classId),
    queryFn: async ({ signal }) =>
      (
        await getJson<{ assignments: Assignment[] }>(
          `/api/teacher/assignments${classId ? `?classId=${encodeURIComponent(classId)}` : ''}`,
          signal,
        )
      ).assignments,
    placeholderData: keepPreviousData,
  });
  return { assignments: data ?? [], loading: isPending, error };
}

export function useAssignment(assignmentId: string) {
  const { data, isPending, error } = useQuery({
    queryKey: assignmentQueryKey(assignmentId),
    queryFn: async ({ signal }) =>
      (
        await getJson<{ assignment: Assignment }>(
          `/api/teacher/assignments/${encodeURIComponent(assignmentId)}`,
          signal,
        )
      ).assignment,
    enabled: assignmentId.length > 0,
  });
  return { assignment: data ?? null, loading: isPending, error };
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

/** The lifecycle mutation: publish, close, or extend (extend carries dueAt). */
export function useAssignmentAction(assignmentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      action: 'publish' | 'close' | 'extend';
      dueAt?: string;
    }): Promise<Assignment> => {
      const res = await fetch(
        `${API_URL}/api/teacher/assignments/${encodeURIComponent(assignmentId)}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(input),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return ((await res.json()) as { assignment: Assignment }).assignment;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: assignmentQueryKey(assignmentId) });
      void client.invalidateQueries({ queryKey: teacherAssignmentsQueryKey() });
    },
  });
}

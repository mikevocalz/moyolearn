'use client';
// useTeacherClasses / useClassRoster / useCreateClass — the client read and
// write models for teacher.classes, on TanStack Query with exported key
// factories so mutations invalidate exactly the surface they changed. Same
// discipline `use-reports.ts` records: server data lives in Query, never in
// component state; AdaptivePanes' per-instance store owns only the SELECTION.
// SOT: design/screens/teacher/teacher.classes/contract.md · packages/app/features/summary/use-reports.ts
// SOT-KEYWORDS: classes hooks client query teacher list roster detail create keys invalidate
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Enrollment } from '../enrollment/enrollment.types.ts';
import type { CreateClassInput, TeacherClass } from './classes.types.ts';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:3001';

export const teacherClassesQueryKey = () => ['teacher-classes'] as const;
export const classRosterQueryKey = (classId: string) => ['teacher-classes', classId] as const;

async function getJson<T>(path: string, signal: AbortSignal | undefined): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', signal });
  if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
  return (await res.json()) as T;
}

export function useTeacherClasses() {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: teacherClassesQueryKey(),
    queryFn: async ({ signal }) =>
      (await getJson<{ classes: TeacherClass[] }>('/api/teacher/classes', signal)).classes,
    placeholderData: keepPreviousData,
  });
  // The use-tutor-incidents idiom: a failed read's screen owes an inline
  // retry, so the callable ships with the hook rather than each screen
  // re-deriving it from the query client.
  return {
    classes: data ?? [],
    loading: isPending,
    error,
    retry: () => {
      void refetch();
    },
  };
}

/** One class with its roster — the detail pane read. 404 surfaces as an error. */
export function useClassRoster(classId: string) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: classRosterQueryKey(classId),
    queryFn: async ({ signal }) =>
      getJson<{ class: TeacherClass; roster: Enrollment[] }>(
        `/api/teacher/classes/${encodeURIComponent(classId)}/roster`,
        signal,
      ),
    enabled: classId.length > 0,
  });
  return {
    class: data?.class ?? null,
    roster: data?.roster ?? [],
    loading: isPending,
    error,
    retry: () => {
      void refetch();
    },
  };
}

export function useCreateClass() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateClassInput): Promise<TeacherClass> => {
      const res = await fetch(`${API_URL}/api/teacher/classes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`HTTP ${String(res.status)}`);
      return ((await res.json()) as { class: TeacherClass }).class;
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: teacherClassesQueryKey() });
    },
  });
}

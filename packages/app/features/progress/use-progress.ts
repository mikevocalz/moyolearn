'use client';
// useProgress — client hook for the persisted learner student model snapshot.
// SOT: docs/pack/22-reporting-charts-spec.md §2
// SOT-KEYWORDS: progress mastery hook client fetch review scaffolding
import { useEffect, useState } from 'react';

const API_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.EXPO_PUBLIC_APP_URL ??
  'http://localhost:3001';

export interface ProgressData {
  masteryBySkill: Record<string, number>;
  reviewBySkill: Record<string, string>;
  scaffoldingBySkill: Record<string, number>;
}

export function useProgress(revision = 0) {
  const [data, setData] = useState<ProgressData>({
    masteryBySkill: {},
    reviewBySkill: {},
    scaffoldingBySkill: {},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API_URL}/api/progress`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ProgressData;
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err as Error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);

  return { ...data, loading, error };
}

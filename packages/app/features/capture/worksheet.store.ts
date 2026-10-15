'use client';
// One current worksheet in memory; its device copy is keyed to the learner.
// This is question navigation, not graded progress or a guardian report.
import { create } from 'zustand';
import { problemStorage } from './problem-storage';
import {
  advanceWorksheet,
  clearWorksheet,
  readWorksheet,
  writeWorksheet,
  type WorksheetSession,
} from './worksheet-session.ts';

interface WorksheetState {
  current: WorksheetSession | null;
  restore: (ownerId: string) => WorksheetSession | null;
  begin: (value: Omit<WorksheetSession, 'schemaVersion' | 'currentIndex'>) => WorksheetSession;
  advance: (ownerId: string) => WorksheetSession | null;
  clear: (ownerId: string) => void;
}

export const useWorksheetStore = create<WorksheetState>((set) => ({
  current: null,
  restore: (ownerId) => {
    const current = readWorksheet(problemStorage, ownerId);
    set({ current });
    return current;
  },
  begin: (input) => {
    const current: WorksheetSession = { ...input, schemaVersion: 1, currentIndex: 0 };
    writeWorksheet(problemStorage, current);
    set({ current });
    return current;
  },
  advance: (ownerId) => {
    const next = advanceWorksheet(problemStorage, ownerId);
    if (next !== null) set({ current: next });
    return next;
  },
  clear: (ownerId) => {
    clearWorksheet(problemStorage, ownerId);
    set({ current: null });
  },
}));

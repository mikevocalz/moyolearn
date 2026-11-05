'use client';
// The worksheet cache bound to this device's storage and the real homework
// routes. The behaviour lives in `worksheet-cache.ts`; this file only wires
// MMKV (native, id `capture`) or localStorage (web) and the fetch client.
// SOT: docs/work/pr-100/contract.md §Client · packages/app/features/capture/worksheet-cache.ts
// SOT-KEYWORDS: homework worksheet store zustand mmkv cache cursor
import { create } from 'zustand';
import { homeworkClient } from '../homework/homework.client.ts';
import { problemStorage } from './problem-storage';
import { worksheetStateCreator, type WorksheetState } from './worksheet-cache.ts';

export const useWorksheetStore = create<WorksheetState>()(
  worksheetStateCreator({ storage: problemStorage, client: homeworkClient }),
);

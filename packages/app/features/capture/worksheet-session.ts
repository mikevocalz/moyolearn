// The v1 device-only worksheet (`capture-worksheet-v1:<ownerId>`). Nothing
// writes it any more: `worksheet-cache.ts` reads it once, creates the server
// submission from it, and removes the key. The writers stay because the v1
// tests pin the shape the migration has to accept.
import type { ProblemStorage } from './problem-storage.shared.ts';
import type { WorksheetQuestion } from './worksheet-questions.ts';
import { MAX_WORKSHEET_QUESTIONS } from './worksheet-questions.ts';

export interface WorksheetSession {
  schemaVersion: 1;
  id: string;
  ownerId: string;
  subject: string;
  title: string;
  instructions: string;
  createdAt: string;
  questions: WorksheetQuestion[];
  currentIndex: number;
}

const keyFor = (ownerId: string) => 'capture-worksheet-v1:' + encodeURIComponent(ownerId);

function isQuestion(v: unknown): v is WorksheetQuestion {
  if (!v || typeof v !== 'object') return false;
  const q = v as Partial<WorksheetQuestion>;
  return typeof q.id === 'string' && q.id.length > 0 &&
    Number.isInteger(q.sourcePage) && q.sourcePage! > 0 &&
    (q.sourceNumber === null || Number.isInteger(q.sourceNumber)) &&
    typeof q.text === 'string' && q.text.trim().length > 0 && q.text.length <= 20_000;
}

export function isWorksheetSession(v: unknown): v is WorksheetSession {
  if (!v || typeof v !== 'object') return false;
  const value = v as Partial<WorksheetSession>;
  if (value.schemaVersion !== 1 || typeof value.id !== 'string' || !value.id ||
      typeof value.ownerId !== 'string' || !value.ownerId ||
      typeof value.subject !== 'string' || !value.subject.trim() ||
      typeof value.title !== 'string' || typeof value.instructions !== 'string' ||
      typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
      !Array.isArray(value.questions) ||
      value.questions.length < 1 || value.questions.length > MAX_WORKSHEET_QUESTIONS ||
      !Number.isInteger(value.currentIndex) ||
      value.currentIndex! < 0 || value.currentIndex! >= value.questions.length) return false;

  return value.questions.every(isQuestion) &&
    new Set(value.questions.map((q) => q.id)).size === value.questions.length;
}

export function readWorksheet(storage: ProblemStorage, ownerId: string): WorksheetSession | null {
  if (!ownerId) return null;
  const raw = storage.getString(keyFor(ownerId));
  if (!raw) return null;
  try {
    const decoded: unknown = JSON.parse(raw);
    return isWorksheetSession(decoded) && decoded.ownerId === ownerId ? decoded : null;
  } catch {
    return null;
  }
}

export function writeWorksheet(storage: ProblemStorage, worksheet: WorksheetSession): void {
  if (!isWorksheetSession(worksheet)) throw new Error('Worksheet needs verified, non-empty questions');
  storage.set(keyFor(worksheet.ownerId), JSON.stringify(worksheet));
}

export function advanceWorksheet(storage: ProblemStorage, ownerId: string): WorksheetSession | null {
  const worksheet = readWorksheet(storage, ownerId);
  if (!worksheet || worksheet.currentIndex + 1 >= worksheet.questions.length) return null;
  const next = { ...worksheet, currentIndex: worksheet.currentIndex + 1 };
  writeWorksheet(storage, next);
  return next;
}

export function clearWorksheet(storage: ProblemStorage, ownerId: string): void {
  if (ownerId) storage.remove(keyFor(ownerId));
}

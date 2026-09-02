import 'server-only';
// Assignment request-body narrowing — shared by the collection route (POST
// create) and the item route (PATCH edit), which both accept posted work
// items. Lives here because a route file may export only handlers, so the
// two routes cannot share this any other way without copying it.
// SOT: packages/app/features/assignments/assignments.types.ts
// SOT-KEYWORDS: assignments body narrow work item edit fields route validation

import type { AssignmentWorkItem, EditAssignmentInput } from '@acme/app/server';

/** Narrows one posted work item, or null when it is not one. */
export function asWorkItem(raw: unknown): AssignmentWorkItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as {
    templateId?: unknown;
    title?: unknown;
    description?: unknown;
    minutes?: unknown;
  };
  if (typeof item.title !== 'string' || item.title.trim().length === 0) return null;
  if (typeof item.description !== 'string') return null;
  if (typeof item.minutes !== 'number' || !Number.isFinite(item.minutes) || item.minutes <= 0) {
    return null;
  }
  return {
    templateId: typeof item.templateId === 'string' ? item.templateId : null,
    title: item.title.trim(),
    description: item.description,
    minutes: item.minutes,
  };
}

/**
 * Narrows a PATCH `fields` payload to an EditAssignmentInput, or null when it
 * is malformed. Absent members stay absent (patch semantics — the service
 * validates the floors on what IS present); a present-but-wrong member is a
 * 400 here, not a 500 downstream.
 */
export function asEditFields(raw: unknown): EditAssignmentInput | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const fields = raw as {
    classId?: unknown;
    title?: unknown;
    subject?: unknown;
    dueAt?: unknown;
    workItems?: unknown;
  };
  const input: EditAssignmentInput = {};

  if (fields.classId !== undefined) {
    if (typeof fields.classId !== 'string' || fields.classId.length === 0) return null;
    input.classId = fields.classId;
  }
  if (fields.title !== undefined) {
    if (typeof fields.title !== 'string' || fields.title.trim().length === 0) return null;
    input.title = fields.title;
  }
  if (fields.subject !== undefined) {
    if (fields.subject !== null && typeof fields.subject !== 'string') return null;
    input.subject = fields.subject;
  }
  if (fields.dueAt !== undefined) {
    if (typeof fields.dueAt !== 'string' || Number.isNaN(Date.parse(fields.dueAt))) return null;
    input.dueAt = fields.dueAt;
  }
  if (fields.workItems !== undefined) {
    if (!Array.isArray(fields.workItems)) return null;
    const items = fields.workItems.map(asWorkItem);
    if (items.length === 0 || items.some((item) => item === null)) return null;
    input.workItems = items as AssignmentWorkItem[];
  }

  return input;
}

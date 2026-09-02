// /api/teacher/assignments — teacher.assign's tracking list: GET lists the
// acting teacher's assignments (filterable by class), POST creates a draft.
//
// POST returns 404 — not 403 — when the target class is not the caller's:
// "can only assign to own classes (Enrollments scope); a deep link to another
// teacher's assignment resolves to not-found" (contract). The route narrows
// the body; the service resolves the class and owns the walls.
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/app/features/assignments/assignments.service.ts
// SOT-KEYWORDS: teacher assignments api route tracking list create draft work items classId filter
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  createAssignmentDraft,
  teacherAssignments,
  type AssignmentWorkItem,
} from '@acme/app/server';
import { createAssignment, loadTeacherAssignments } from '@/lib/assignments.repository';
import { loadTeacherClass } from '@/lib/classes.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// The tracking list answers "who has done it" — a cached answer is a student
// marked missing who finished an hour ago.
export const dynamic = 'force-dynamic';

function routeStatus(error: unknown, message: string): number {
  if (error instanceof CapabilityDenied || error instanceof MembershipDenied) return error.status;
  return message === 'Unauthenticated' ? 401 : 500;
}

/** Narrows one posted work item, or null when it is not one. */
function asWorkItem(raw: unknown): AssignmentWorkItem | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as { templateId?: unknown; title?: unknown; description?: unknown; minutes?: unknown };
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

export async function GET(request: NextRequest) {
  const classId = request.nextUrl.searchParams.get('classId') ?? undefined;
  try {
    const assignments = await teacherAssignments(
      loadTeacherAssignments,
      auth,
      request.headers,
      classId ? { classId } : undefined,
    );
    return NextResponse.json({ ok: true, assignments });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: routeStatus(error, message) });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { classId, title, subject, dueAt, workItems } = (body ?? {}) as {
    classId?: unknown;
    title?: unknown;
    subject?: unknown;
    dueAt?: unknown;
    workItems?: unknown;
  };

  const items = Array.isArray(workItems) ? workItems.map(asWorkItem) : [];
  if (
    typeof classId !== 'string' ||
    classId.length === 0 ||
    typeof title !== 'string' ||
    title.trim().length === 0 ||
    typeof dueAt !== 'string' ||
    Number.isNaN(Date.parse(dueAt)) ||
    items.length === 0 ||
    items.some((item) => item === null)
  ) {
    return NextResponse.json(
      { error: 'An assignment needs a class, a title, a due date, and at least one work item' },
      { status: 400 },
    );
  }

  try {
    const created = await createAssignmentDraft(
      { loadTeacherClass, createAssignment },
      auth,
      request.headers,
      {
        classId,
        title,
        subject: typeof subject === 'string' && subject.trim().length > 0 ? subject.trim() : null,
        dueAt,
        workItems: items as AssignmentWorkItem[],
      },
    );
    if (created === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, assignment: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: routeStatus(error, message) });
  }
}

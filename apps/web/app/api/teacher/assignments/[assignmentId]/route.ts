// /api/teacher/assignments/[assignmentId] — GET one assignment; PATCH moves
// its lifecycle — publish (sets publishedAt + status together, never
// half-published), close, or extend (new due date; a closed assignment
// reopens) — or, action 'edit', patches a DRAFT's fields (title, subject,
// dueAt, workItems, classId; the service refuses non-drafts).
//
// 404 for not-found and not-yours alike — the contract's "deep link to
// another teacher's assignment resolves to not-found (silent drop, doc 36
// §4.4)".
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/app/features/assignments/assignments.service.ts
// SOT-KEYWORDS: teacher assignment api route detail publish close extend edit fields lifecycle patch
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  closeAssignment,
  editAssignmentDraft,
  extendAssignment,
  publishAssignment,
  teacherAssignmentDetail,
} from '@acme/app/server';
import { asEditFields } from '@/lib/assignments.body';
import {
  loadTeacherAssignment,
  updateAssignment,
  updateAssignmentFields,
} from '@/lib/assignments.repository';
import { countCompletionsByAssignment } from '@/lib/assignment-completions.repository';
import { loadEnrollmentsByClass } from '@/lib/enrollment.repository';
import { loadTeacherClass } from '@/lib/classes.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

function routeStatus(error: unknown, message: string): number {
  if (error instanceof CapabilityDenied || error instanceof MembershipDenied) return error.status;
  return message === 'Unauthenticated' ? 401 : 500;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await params;
  if (!assignmentId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    // The detail carries counts-only completion state, same as the list —
    // never a per-student roster of who is done (the service's decision).
    const assignment = await teacherAssignmentDetail(
      {
        loadTeacherAssignment,
        countCompletionsByAssignment,
        loadClassRoster: loadEnrollmentsByClass,
      },
      auth,
      request.headers,
      assignmentId,
    );
    if (assignment === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, assignment });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: routeStatus(error, message) });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> },
) {
  const { assignmentId } = await params;
  if (!assignmentId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const { action, dueAt, fields } = (body ?? {}) as {
    action?: unknown;
    dueAt?: unknown;
    fields?: unknown;
  };

  const ports = { loadTeacherAssignment, updateAssignment };
  try {
    let assignment;
    if (action === 'publish') {
      assignment = await publishAssignment(ports, auth, request.headers, assignmentId);
    } else if (action === 'close') {
      assignment = await closeAssignment(ports, auth, request.headers, assignmentId);
    } else if (action === 'extend') {
      if (typeof dueAt !== 'string' || Number.isNaN(Date.parse(dueAt))) {
        return NextResponse.json({ error: 'An extension needs a due date' }, { status: 400 });
      }
      assignment = await extendAssignment(ports, auth, request.headers, assignmentId, dueAt);
    } else if (action === 'edit') {
      const input = asEditFields(fields);
      if (input === null) {
        return NextResponse.json({ error: 'Invalid assignment fields' }, { status: 400 });
      }
      assignment = await editAssignmentDraft(
        { loadTeacherAssignment, loadTeacherClass, updateAssignmentFields },
        auth,
        request.headers,
        assignmentId,
        input,
      );
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    if (assignment === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, assignment });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: routeStatus(error, message) });
  }
}

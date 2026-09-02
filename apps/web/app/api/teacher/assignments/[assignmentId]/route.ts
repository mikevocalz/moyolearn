// /api/teacher/assignments/[assignmentId] — GET one assignment; PATCH moves
// its lifecycle: publish (sets publishedAt + status together, never
// half-published), close, or extend (new due date; a closed assignment
// reopens).
//
// 404 for not-found and not-yours alike — the contract's "deep link to
// another teacher's assignment resolves to not-found (silent drop, doc 36
// §4.4)".
// SOT: design/screens/teacher/teacher.assign/contract.md · packages/app/features/assignments/assignments.service.ts
// SOT-KEYWORDS: teacher assignment api route detail publish close extend lifecycle patch
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  closeAssignment,
  extendAssignment,
  publishAssignment,
  teacherAssignmentDetail,
} from '@acme/app/server';
import { loadTeacherAssignment, updateAssignment } from '@/lib/assignments.repository';
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
    const assignment = await teacherAssignmentDetail(
      loadTeacherAssignment,
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
  const { action, dueAt } = (body ?? {}) as { action?: unknown; dueAt?: unknown };

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

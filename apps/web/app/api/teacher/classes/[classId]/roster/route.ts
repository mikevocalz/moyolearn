// GET /api/teacher/classes/[classId]/roster — one class with its roster, the
// teacher.classes detail pane in one read.
//
// The roster is enrollments by `classId` (the class dimension, not a second
// roster collection), loaded only after the service proves the class belongs
// to the acting teacher. 404 for not-found and not-yours alike — the
// contract's permission path is a silent drop, and a distinguishable 403
// would be an oracle over which class ids exist.
// SOT: design/screens/teacher/teacher.classes/contract.md · packages/app/features/classes/classes.service.ts
// SOT-KEYWORDS: teacher class roster api route detail enrollments classId not-found
import { NextRequest, NextResponse } from 'next/server';
import { CapabilityDenied, MembershipDenied, teacherClassDetail } from '@acme/app/server';
import { loadTeacherClass } from '@/lib/classes.repository';
import { loadEnrollmentsByClass } from '@/lib/enrollment.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
) {
  const { classId } = await params;
  if (!classId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const detail = await teacherClassDetail(
      { loadTeacherClass, loadClassRoster: loadEnrollmentsByClass },
      auth,
      request.headers,
      classId,
    );
    if (detail === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, class: detail.class, roster: detail.roster });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status =
      error instanceof CapabilityDenied || error instanceof MembershipDenied
        ? error.status
        : message === 'Unauthenticated'
          ? 401
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

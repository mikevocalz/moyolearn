// /api/teacher/classes — the teacher.classes tab root: GET lists the acting
// teacher's classes, POST creates one (the FD-23 pattern outside onboarding).
//
// A TEACHER SURFACE on the guardian-reports idiom: the service owns the walls
// (membership + ownership scope), the route owns parsing. Everything the
// client can influence is narrowed HERE — identity is not among it, and the
// class code is minted server-side, never posted.
// SOT: design/screens/teacher/teacher.classes/contract.md · packages/app/features/classes/classes.service.ts
// SOT-KEYWORDS: teacher classes api route list create grade band protected operation
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  createTeacherClass,
  teacherClasses,
} from '@acme/app/server';
import { GRADE_BANDS, type GradeBand } from '@acme/app';
import { createClass, loadTeacherClasses } from '@/lib/classes.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

// "What classes do I run" is a question about now; a cached answer hides the
// student who joined by code a minute ago.
export const dynamic = 'force-dynamic';

function routeStatus(error: unknown, message: string): number {
  if (error instanceof CapabilityDenied || error instanceof MembershipDenied) return error.status;
  return message === 'Unauthenticated' ? 401 : 500;
}

export async function GET(request: NextRequest) {
  try {
    const classes = await teacherClasses(loadTeacherClasses, auth, request.headers);
    return NextResponse.json({ ok: true, classes });
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

  const { name, gradeBand, subject } = (body ?? {}) as {
    name?: unknown;
    gradeBand?: unknown;
    subject?: unknown;
  };
  const band = GRADE_BANDS.find((b) => b.id === gradeBand)?.id as GradeBand | undefined;
  if (typeof name !== 'string' || name.trim().length === 0 || band === undefined) {
    return NextResponse.json({ error: 'A class needs a name and a grade band' }, { status: 400 });
  }

  try {
    const created = await createTeacherClass(createClass, auth, request.headers, {
      name,
      gradeBand: band,
      subject: typeof subject === 'string' && subject.trim().length > 0 ? subject.trim() : null,
    });
    return NextResponse.json({ ok: true, class: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: routeStatus(error, message) });
  }
}

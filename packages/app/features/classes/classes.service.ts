import 'server-only';
// Classes service — the teacher's own classes, and nothing else.
//
// THE SCOPE IS THE TEACHER, NOT THE INSTITUTION: every read and write below is
// keyed by `ctx.learnerId` (the acting user's Better Auth id) as
// `teacherAuthId`, so a teacher sees exactly the classes they run. The
// membership wall (`requiresMembership: MEMBERSHIP_ROLES`) is what makes this
// a staff surface — a family session holds no member row in the org and is
// refused before any query runs — and it is set HERE, in the service, so no
// route can lower it (the incidents-service rule).
//
// A foreign `classId` resolves to null → the route's 404 — never a 403. The
// contract's permission failure path ("a student detail shows the teacher's
// own class data only") is a silent drop, because a distinguishable refusal
// would be an oracle over which class ids exist.
// SOT: design/screens/teacher/teacher.classes/contract.md · packages/payload/src/collections/Classes.ts
// SOT-KEYWORDS: classes service teacher own scope roster detail create mint code membership wall

import { MEMBERSHIP_ROLES } from '@acme/auth/membership';
import type { Auth } from '@acme/auth/server';
import { protectedOperation } from '../../core/protected-operation.ts';
import { classCode, GRADE_BANDS } from '../onboarding/teacher/steps.ts';
import type { Enrollment } from '../enrollment/enrollment.types.ts';
import type { CreateClassInput, TeacherClass, TeacherClassDetail } from './classes.types.ts';

/** Repository ports — the caller provides the Payload adapters. */
export type LoadTeacherClasses = (teacherAuthId: string, orgId: string) => Promise<TeacherClass[]>;
export type LoadTeacherClass = (
  classId: string,
  teacherAuthId: string,
  orgId: string,
) => Promise<TeacherClass | null>;
export type LoadClassRoster = (classId: string, orgId: string) => Promise<Enrollment[]>;
export type CreateClass = (
  row: Omit<TeacherClass, 'id'>,
) => Promise<TeacherClass>;

export interface ClassDetailPorts {
  loadTeacherClass: LoadTeacherClass;
  loadClassRoster: LoadClassRoster;
}

/*
  Reads run at the `practise` floor, not `write`: a lapsed school card must
  never stand between a teacher and the roster they already run (the ops-leads
  rationale — org data is never hostage). The membership wall alone is the
  boundary that matters here.
*/
const READ_GATE = { requires: 'practise', requiresMembership: MEMBERSHIP_ROLES } as const;

/** Lists the classes the acting teacher runs in the current tenant. */
export async function teacherClasses(
  loadTeacherClasses: LoadTeacherClasses,
  authInstance: Auth,
  headers: Headers,
): Promise<TeacherClass[]> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => loadTeacherClasses(ctx.learnerId, ctx.orgId ?? ''),
    { ...READ_GATE, telemetry: { op: 'teacher.classes.list', resource: 'classes', action: 'read' } },
  );
}

/**
 * One class with its roster — the detail pane in one read. The roster is
 * enrollments by `classId`, loaded only AFTER ownership resolves: a foreign
 * class never leaks even its student count.
 */
export async function teacherClassDetail(
  ports: ClassDetailPorts,
  authInstance: Auth,
  headers: Headers,
  classId: string,
): Promise<TeacherClassDetail | null> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => {
      const owned = await ports.loadTeacherClass(classId, ctx.learnerId, ctx.orgId ?? '');
      if (owned === null) return null;
      return { class: owned, roster: await ports.loadClassRoster(owned.id, owned.orgId) };
    },
    { ...READ_GATE, telemetry: { op: 'teacher.classes.detail', resource: 'classes', action: 'read' } },
  );
}

/**
 * Creates a class owned by the acting teacher. The code is minted here with
 * FD-23's `classCode()` — the client never supplies one — and the grade band
 * is validated against the same GRADE_BANDS list FD-23 renders, because the
 * band decides which join routes are lawful and cannot be a free string.
 */
export async function createTeacherClass(
  createClass: CreateClass,
  authInstance: Auth,
  headers: Headers,
  input: CreateClassInput,
): Promise<TeacherClass> {
  return protectedOperation(
    authInstance,
    headers,
    async (ctx) => {
      const name = input.name.trim();
      if (name.length === 0) throw new Error('A class needs a name');
      if (!GRADE_BANDS.some((band) => band.id === input.gradeBand)) {
        throw new Error('Unknown grade band');
      }
      return createClass({
        name,
        gradeBand: input.gradeBand,
        // Mint-once: at 31^6 codes a collision is lottery-rare, and the DB's
        // unique constraint is the backstop that turns the losing ticket into
        // a retryable error rather than a shared class.
        code: classCode(),
        teacherAuthId: ctx.learnerId,
        orgId: ctx.orgId ?? '',
        subject: input.subject ?? null,
        status: 'active',
      });
    },
    {
      // Creation writes the org's data, so it names `write` explicitly — the
      // incidents-service rule for staff mutations.
      requires: 'write',
      requiresMembership: MEMBERSHIP_ROLES,
      telemetry: { op: 'teacher.classes.create', resource: 'classes', action: 'write' },
    },
  );
}

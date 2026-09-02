import type { CollectionConfig } from 'payload';

// Classes — a teacher's roster container: the thing students join by code and
// the target an assignment is published to.
//
// Grade band and code semantics are FD-23's: the band decides which join
// routes are lawful (steps.ts `joinOptions`), so it is captured at creation
// and never defaulted; the code is minted with FD-23's `classCode()` alphabet.
// The roster itself is NOT here — enrollments carry an indexed `classId`
// dimension instead of a second roster collection.
// SOT: design/screens/teacher/teacher.classes/contract.md · packages/app/features/onboarding/teacher/steps.ts (FD-23)
// SOT-KEYWORDS: classes collection teacher roster grade band class code orgId assign

export const Classes: CollectionConfig = {
  slug: 'classes',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'gradeBand', 'code', 'teacherAuthId', 'orgId', 'status'],
    group: 'Institutional',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
  },
  versions: false,
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'The class name a teacher gave it in FD-23 or teacher.classes.' },
    },
    {
      // Options mirror `GRADE_BANDS` in features/onboarding/teacher/steps.ts —
      // the SOT for what a band IS. Inlined (as Enrollments inlines its status)
      // because the payload package cannot import app features; the generated
      // type is what keeps the two lists honest at the service boundary.
      name: 'gradeBand',
      type: 'select',
      required: true,
      options: ['k-5', '6-8', '9-12', 'mixed'],
    },
    {
      name: 'code',
      type: 'text',
      required: true,
      index: true,
      unique: true,
      admin: { description: 'Join code minted with FD-23 classCode() — the readable alphabet.' },
    },
    {
      name: 'teacherAuthId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The Better Auth user id of the owning teacher.' },
    },
    {
      name: 'orgId',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The school slug the class belongs to.' },
    },
    {
      name: 'subject',
      type: 'text',
      admin: { description: 'Optional subject label.' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: ['active', 'archived'],
    },
  ],
};

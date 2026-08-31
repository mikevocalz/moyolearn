// Institutional report projections.
//
// These are the read-only shapes that screens render. They are deliberately
// separate from the generated Payload types and from the service that builds them.
// SOT: packages/app/features/institution/reports.service.ts
// SOT-KEYWORDS: reports types enrollment projection institution

/** The first real institutional report: learner enrollment counts. */
export interface EnrollmentReport {
  total: number;
  active: number;
  inactive: number;
  /** Districts only: active/inactive totals broken down by school. */
  bySchool?: { slug: string; name: string; total: number; active: number; inactive: number }[];
}

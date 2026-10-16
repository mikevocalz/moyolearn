import { NextRequest, NextResponse } from 'next/server';
import { guardianWards } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { loadWardProfile } from '@/lib/homework.repository';
import { reportRouteError } from '@/lib/report-error';
import { loadGuardianWards } from '@/lib/summary.repository';

export const dynamic = 'force-dynamic';

/** Children under an ACTIVE guardianship, as a bare array. Revoked ones are absent. */
export async function GET(request: NextRequest) {
  try {
    const wards = await guardianWards(auth, request.headers, { loadGuardianWards, loadWardProfile });
    return NextResponse.json(wards);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: message === 'Unauthenticated' ? 401 : 500 });
  }
}

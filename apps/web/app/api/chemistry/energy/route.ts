// The private, learner-authorized boundary to Microsoft QDK/Chemistry.
// No student identifier, prompt, session, or grade is sent to the worker.
// SOT: docs/compute/qdk-chemistry.md
// SOT-KEYWORDS: chemistry qdk quantum route protected operation molecular energy
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { protectedOperation } from '@acme/app/server';
import { auth } from '@/lib/auth';
import { loadAssignedGradeBand } from '@/lib/student-model.repository';
import { fetchChemistryWorker, readChemistryJson } from '@/lib/chemistry-request';

export const dynamic = 'force-dynamic';

const RequestSchema = z.object({
  moleculeId: z.enum(['h2-equilibrium', 'h2-stretched']),
}).strict();

const WorkerResult = z.object({
  moleculeId: RequestSchema.shape.moleculeId,
  energyHartree: z.number().finite(),
  method: z.literal('Hartree-Fock/SCF'),
  basis: z.literal('sto-3g'),
  computeEngine: z.literal('Microsoft QDK/Chemistry'),
  note: z.string().max(400),
});

export async function POST(request: NextRequest) {
  const json = await readChemistryJson(request);
  if (!json.ok) {
    return NextResponse.json({ error: 'Invalid request' }, { status: json.tooLarge ? 413 : 400 });
  }

  const body = RequestSchema.safeParse(json.value);
  if (!body.success) {
    return NextResponse.json({ error: 'Choose a supported molecular structure' }, { status: 400 });
  }

  try {
    return await protectedOperation(auth, request.headers, async (ctx) => {
      const band = await loadAssignedGradeBand(ctx);
      if (band !== '6-8' && band !== '9-12') {
        return NextResponse.json({ error: 'Activity unavailable for this age band' }, { status: 403 });
      }

      const base = process.env.QDK_CHEMISTRY_URL;
      const token = process.env.QDK_CHEMISTRY_TOKEN;
      if (!base || !token) {
        return NextResponse.json({ error: 'Chemistry calculations are not configured' }, { status: 503 });
      }

      const origin = new URL(base);
      if (
        origin.username || origin.password ||
        (origin.protocol !== 'https:' &&
          !(process.env.NODE_ENV === 'development' &&
            origin.protocol === 'http:' &&
            ['localhost', '127.0.0.1', '::1'].includes(origin.hostname)))
      ) {
        return NextResponse.json({ error: 'Chemistry service configuration is invalid' }, { status: 503 });
      }

      const worker = await fetchChemistryWorker(origin, token, body.data.moleculeId);
      if (!worker.ok) {
        return NextResponse.json({ error: 'Chemistry calculation is unavailable' }, { status: 503 });
      }
      const parsed = WorkerResult.safeParse(await worker.json());
      if (!parsed.success || parsed.data.moleculeId !== body.data.moleculeId) {
        return NextResponse.json({ error: 'Invalid chemistry result' }, { status: 503 });
      }

      return NextResponse.json(parsed.data, { headers: { 'Cache-Control': 'no-store' } });
    }, { requires: 'practise', telemetry: { op: 'chemistry.energy', resource: 'chemistry', action: 'read' } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthenticated') {
      return NextResponse.json({ error: 'Sign in to access the chemistry lab' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Chemistry lab is unavailable' }, { status: 503 });
  }
}

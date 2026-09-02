// GET  /api/ops/families/:familyId — one household record with its leads.
// PATCH /api/ops/families/:familyId — replace the household's contact list.
// SOT: design/screens/org/org.crm/contract.md · docs/decisions/adr-109-family-household-object.md · CLAUDE.md (The block)
// SOT-KEYWORDS: ops api family detail record household contacts crm protected operation route
import { NextRequest, NextResponse } from 'next/server';
import {
  CapabilityDenied,
  MembershipDenied,
  MEMBERSHIP_ROLES,
  getFamily,
  parseFamilyContacts,
  protectedOperation,
  updateFamilyContacts,
} from '@acme/app/server';
import { loadFamily, saveFamilyContacts } from '@/lib/families.repository';
import { loadLeads } from '@/lib/leads.repository';
import { auth } from '@/lib/auth';
import { reportRouteError } from '@/lib/report-error';

type Params = { params: Promise<{ familyId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { familyId } = await params;
  try {
    const detail = await protectedOperation(
      auth,
      request.headers,
      /*
        The repository resolves the id WHERE it also matches `ctx.orgId`, so a
        guessed id from another tenant is a 404 here, indistinguishable from a
        record that never existed — which is the point.
      */
      (ctx) => getFamily(ctx, familyId, { loadFamily, loadLeads }),
      /*
        Reading one household is the same read as reading the list: `export`,
        never `write` — doc 05 §2.3 keeps a lapsed org's own CRM readable — and
        the role wall (`requiresMembership`) is what keeps a paying session
        with no role in the org out of a page of family contacts.
      */
      {
        requires: 'export',
        requiresMembership: MEMBERSHIP_ROLES,
        telemetry: { op: 'ops.families.detail', resource: 'families', action: 'read' },
      },
    );
    if (detail === null) {
      return NextResponse.json({ error: 'Not in your records.' }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = error instanceof CapabilityDenied || error instanceof MembershipDenied
      ? error.status
      : message === 'Unauthenticated' ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { familyId } = await params;
  try {
    const result = await protectedOperation(
      auth,
      request.headers,
      async (ctx) => {
        /*
          The floor is pure and tested (`parseFamilyContacts`): every contact
          needs a name and a relationship, the list is bounded, and an empty
          list is a valid edit. Nothing else in the record is writable here —
          the name is the upsert key and learnerRefs have no client write path
          at all.
        */
        const parsed = parseFamilyContacts(await request.json().catch(() => null));
        if (!parsed.ok) return { ok: false as const, error: parsed.error };
        const family = await updateFamilyContacts(ctx, familyId, parsed.contacts, saveFamilyContacts);
        if (family === null) return { ok: false as const, error: 'Not in your records.' };
        return { ok: true as const, family };
      },
      /*
        Editing contacts is the organisation's data changing, so it is `write`
        — and the lead-create role wall: owner and manager run the CRM, the
        scheduler maintains the households booking talks to (doc 06 §1).
        Finance reads; it does not edit who to call.
      */
      {
        requires: 'write',
        requiresMembership: ['owner', 'manager', 'scheduler'],
        telemetry: { op: 'ops.families.contacts', resource: 'families', action: 'write' },
      },
    );
    if (!result.ok && result.error === 'Not in your records.') {
      return NextResponse.json(result, { status: 404 });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    if (error instanceof Error) reportRouteError(error);
    const message = error instanceof Error ? error.message : 'Server error';
    const status = error instanceof CapabilityDenied || error instanceof MembershipDenied
      ? error.status
      : message === 'Unauthenticated' ? 401
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

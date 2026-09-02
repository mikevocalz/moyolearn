// The validation floor for creating a lead — pure, so the floor has a test.
//
// The stage is NOT part of the input: a new lead starts at the pipeline's first
// manual stage ('Inquiry' — the enum has no 'New lead'), assigned server-side,
// because a client that can choose the starting stage can skip the funnel.
// Money arrives as integer CENTS and is floored to a non-negative integer —
// the collection stores cents (Leads.ts) and a float here would round-trip
// into drift.
// SOT: docs/pack/28-crm-spec.md §2–§3 · packages/payload/src/collections/Leads.ts
// SOT-KEYWORDS: lead create validation floor parse cents stage inquiry pure crm
import { MANUAL_STAGES } from './stage-change.ts';
import type { Stage } from './ops.data.ts';

/** Where every new lead starts — the first manual stage, never client-chosen. */
export const NEW_LEAD_STAGE: Stage = MANUAL_STAGES[0];

export interface NewLeadInput {
  family: string;
  learner?: string;
  subject?: string;
  valueCents: number;
}

export type ParsedNewLead =
  | { ok: true; input: NewLeadInput }
  | { ok: false; error: string };

const optionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

/**
 * Narrows an untrusted body to a lead the pipeline will accept. Floors, not a
 * schema: the family name is the one thing a lead cannot exist without, and
 * the value must be a whole non-negative number of cents. Errors are written
 * in the interface's voice because the route hands them straight back.
 */
export function parseNewLead(body: unknown): ParsedNewLead {
  const { family, learner, subject, valueCents } = (body ?? {}) as {
    family?: unknown;
    learner?: unknown;
    subject?: unknown;
    valueCents?: unknown;
  };

  const name = optionalText(family);
  if (name === undefined) return { ok: false, error: 'A lead needs a family name.' };

  let cents = 0;
  if (valueCents !== undefined) {
    if (typeof valueCents !== 'number' || !Number.isInteger(valueCents) || valueCents < 0) {
      return { ok: false, error: 'Value must be a whole, non-negative amount.' };
    }
    cents = valueCents;
  }

  return {
    ok: true,
    input: {
      family: name,
      learner: optionalText(learner),
      subject: optionalText(subject),
      valueCents: cents,
    },
  };
}

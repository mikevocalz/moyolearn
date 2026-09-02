// The household record's shape, and the validation floor for its one write
// surface — pure, so the floor has a test (the lead-create idiom).
//
// A contact is doc 28 §2's GuardianContact as BUSINESS contact data: name,
// relationship, email, phone. That is what the CRM side is allowed to hold;
// nothing here sends to a contact — the consent-scoped comms check (doc 14 T4)
// belongs to the unbuilt Activity object, not to this record.
//
// `learnerRefs` are text pointers displayed as refs and NEVER parsed here:
// the write surface is contacts only, so a client cannot grow or edit the
// learner linkage through the record page at all.
// SOT: docs/pack/28-crm-spec.md §2 · docs/decisions/adr-109-family-household-object.md
// SOT-KEYWORDS: family record household contacts guardian parse floor pure crm learner refs
export interface FamilyContact {
  name: string;
  relationship: string;
  email?: string;
  phone?: string;
}

export interface FamilyRecord {
  id: string;
  /** The household label — the upsert key beside orgId, unique per org. */
  name: string;
  contacts: FamilyContact[];
  /** Doc 28 §2's LearnerRef pointers, verbatim — displayed as refs, never resolved. */
  learnerRefs: string[];
}

export type ParsedContacts =
  | { ok: true; contacts: FamilyContact[] }
  | { ok: false; error: string };

/**
 * A ceiling, not a product limit: a household's contact list is people who can
 * be called about a child, and a payload of hundreds of rows is a client bug
 * or an abuse of the write path, not a family.
 */
export const MAX_FAMILY_CONTACTS = 12;

const optionalText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

/**
 * Narrows an untrusted body to the contact list the record will accept.
 * Floors, not a schema: a contact needs a name and a relationship; email and
 * phone are optional trimmed text. An EMPTY list is valid — removing the last
 * contact is a legitimate edit, not a refusal. Errors are written in the
 * interface's voice because the route hands them straight back.
 */
export function parseFamilyContacts(body: unknown): ParsedContacts {
  const { contacts } = (body ?? {}) as { contacts?: unknown };
  if (!Array.isArray(contacts)) {
    return { ok: false, error: 'Contacts must be a list.' };
  }
  if (contacts.length > MAX_FAMILY_CONTACTS) {
    return { ok: false, error: `A family can hold up to ${MAX_FAMILY_CONTACTS} contacts.` };
  }

  const parsed: FamilyContact[] = [];
  for (const entry of contacts) {
    const { name, relationship, email, phone } = (entry ?? {}) as {
      name?: unknown;
      relationship?: unknown;
      email?: unknown;
      phone?: unknown;
    };
    const contactName = optionalText(name);
    if (contactName === undefined) return { ok: false, error: 'A contact needs a name.' };
    const contactRelationship = optionalText(relationship);
    if (contactRelationship === undefined) {
      return { ok: false, error: 'A contact needs a relationship — "Mother", "Guardian", …' };
    }
    parsed.push({
      name: contactName,
      relationship: contactRelationship,
      email: optionalText(email),
      phone: optionalText(phone),
    });
  }

  return { ok: true, contacts: parsed };
}

'use client';
// The household record — org.crm's route-based family detail (ADR-109; the
// lead-detail idiom: back rides browser history, a URL per record makes a
// household shareable and bookmarkable). Household name, its GuardianContacts
// (view + edit — the record's one write surface), the family's pipeline rows
// with stage jump-links, and its learner refs displayed AS refs.
//
// Contact edits are business-record writes: a plain, optimistic-OFF mutation
// (unlike the stage drag) — "saved" must mean saved, failure stays a visible
// banner, and the unsaved values stay in the form for retry.
//
// NO notes and NO stage history, deliberately: doc 28 §2's Activity object
// (notes, calls, emails — consent-scoped) has no collection behind it, so a
// timeline here would be furniture. The section arrives with that schema.
//
// THE WALL (org.crm contract / doc 23 §2): learnerRefs render verbatim as
// data and are NEVER resolved — no name, no sessions, no link. A CRM record
// that could dereference a learner pointer would be the join the schema
// refuses, rebuilt in the view; `check-crm-wall.mjs` watches this feature's
// imports for exactly that.
// SOT: design/screens/org/org.crm/contract.md · docs/pack/28-crm-spec.md §2 ·
//      docs/decisions/adr-109-family-household-object.md
// SOT-KEYWORDS: family detail record household contacts guardian leads stages
//               learner refs wall route back crm
// Mobbin: https://mobbin.com/screens/f0170497-9df6-4b27-9bdc-ab606ee77530 (Twenty —
//   company record: the People list sits under the record header, related
//   Opportunities as their own section below) ·
//   https://mobbin.com/screens/6d42919c-1f78-4f9c-b61b-329c971b7059 (Xero —
//   "Primary person" contact card with the role as a chip beside the name) ·
//   https://mobbin.com/screens/a6bf013d-a947-4269-9f63-42c9ffa052b9 (Plain —
//   People rows: name leads, email trails muted on the same row) ·
//   https://mobbin.com/screens/dc505a48-5efc-4f1f-a04e-915c88055b47 (Midday —
//   related rows at the record's foot each carrying a status chip).
//   Structure only.
import { Link } from 'solito/link';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  Heading,
  LoadingSkeleton,
  useAppForm,
} from '@acme/ui';
import { Text, View } from '@acme/ui/primitives';
import { STAGE_TONE, type Lead } from './ops.data';
import type { FamilyContact, FamilyRecord } from './family-record';
import { useFamily, useUpdateFamilyContacts } from './use-families';
import { GUTTER, SectionHeader } from './leads-content';
import { familiesRootPath, leadDetailPath } from './ops-paths';

/** One saved contact — name leads, relationship rides as a chip (the Xero shape). */
function ContactRow({
  contact,
  onRemove,
  pending,
}: {
  contact: FamilyContact;
  onRemove: () => void;
  pending: boolean;
}) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-element rounded-card border-2 border-border bg-surface-raised p-inset">
      <View className="min-w-0 flex-1 gap-0">
        <View className="flex-row flex-wrap items-center gap-element">
          <Text className="text-body font-semibold text-text">{contact.name}</Text>
          <Badge label={contact.relationship} tone="neutral" />
        </View>
        {contact.email || contact.phone ? (
          <Text className="text-caption text-text-muted">
            {[contact.email, contact.phone].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
      <Button title="Remove" variant="outline" disabled={pending} onPress={onRemove} />
    </View>
  );
}

/** The Add-a-contact door — the classes Add-a-class idiom over the same form kit. */
function AddContactCard({
  onAdd,
  pending,
}: {
  onAdd: (contact: FamilyContact) => Promise<void>;
  pending: boolean;
}) {
  const form = useAppForm({
    defaultValues: { name: '', relationship: '', email: '', phone: '' },
    onSubmit: async ({ value }) => {
      try {
        await onAdd({
          name: value.name.trim(),
          relationship: value.relationship.trim(),
          email: value.email.trim() === '' ? undefined : value.email.trim(),
          phone: value.phone.trim() === '' ? undefined : value.phone.trim(),
        });
        form.reset();
      } catch {
        // Failure stays visible through the mutation's error state (the Banner
        // above the list) — swallowed here only so the form doesn't
        // double-report it, and the typed values survive for retry.
      }
    },
  });

  return (
    <Card className="gap-group">
      <Heading level={3} size="title" className="text-text">
        Add a contact
      </Heading>

      <form.AppField
        name="name"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? 'A contact needs a name' : undefined,
        }}
      >
        {(field) => <field.TextField label="Name" />}
      </form.AppField>

      <form.AppField
        name="relationship"
        validators={{
          onChange: ({ value }) =>
            value.trim().length === 0 ? 'How they relate to the household' : undefined,
        }}
      >
        {(field) => (
          <field.TextField label="Relationship" hint="Mother, Father, Guardian, Grandparent…" />
        )}
      </form.AppField>

      <form.AppField name="email">
        {(field) => <field.TextField label="Email" hint="Optional." />}
      </form.AppField>

      <form.AppField name="phone">
        {(field) => <field.TextField label="Phone" hint="Optional." />}
      </form.AppField>

      <form.AppForm>
        <form.SubmitButton title={pending ? 'Saving…' : 'Add contact'} variant="primary" />
      </form.AppForm>
    </Card>
  );
}

function FamilyRecordView({ family, leads }: { family: FamilyRecord; leads: Lead[] }) {
  const save = useUpdateFamilyContacts(family.id);

  return (
    <View className={`gap-section ${GUTTER}`}>
      <View className="gap-stack">
        {/* The explicit way back — deep links arrive with no history to pop. */}
        <Link href={familiesRootPath()} aria-label="Back to families">
          <Text className="text-caption font-semibold text-text-muted">← Families</Text>
        </Link>
        <View className="min-w-0 gap-0">
          <Heading level={1} size="display-sm" className="text-text">
            {family.name}
          </Heading>
          <Text className="text-body-lg text-text-muted">
            {leads.length} {leads.length === 1 ? 'lead' : 'leads'} in the pipeline
          </Text>
        </View>
      </View>

      <View className="gap-stack">
        <SectionHeader title="Contacts" count={String(family.contacts.length)} />

        {/* The contract's stage_write_failed posture, on the record's own
            write: mutations fail visibly — nothing queues, nothing pretends
            to have saved, and the form keeps the values for retry. */}
        {save.isError ? (
          <Banner
            tone="warning"
            title="Couldn't save contacts"
            description="Nothing was saved. Check your connection and try again."
          />
        ) : null}

        {family.contacts.length === 0 ? (
          <EmptyState
            icon={<Text className="text-title">＋</Text>}
            title="No contacts yet"
            description="Add who to reach about this household — scheduling and billing talk to these people."
          />
        ) : (
          <View className="gap-stack">
            {family.contacts.map((contact, index) => (
              <ContactRow
                key={`${contact.name}-${index}`}
                contact={contact}
                pending={save.isPending}
                onRemove={() => {
                  save.mutate(family.contacts.filter((_, i) => i !== index));
                }}
              />
            ))}
          </View>
        )}

        <AddContactCard
          pending={save.isPending}
          onAdd={async (contact) => {
            await save.mutateAsync([...family.contacts, contact]);
          }}
        />
      </View>

      <View className="gap-stack">
        <SectionHeader title="Pipeline" count={String(leads.length)} />
        {leads.length === 0 ? (
          <EmptyState
            icon={<Text className="text-title">＋</Text>}
            title="No leads for this family"
            description="This household has no pipeline rows — add one on the Leads page."
          />
        ) : (
          <View className="gap-stack">
            {leads.map((lead) => (
              /* Jump links, not an editor: the stage moves on the lead record
                 (or the board), so this list renders the same badge WITHOUT
                 the menu — one write control per value, not one per surface. */
              <Link key={lead.id} href={leadDetailPath(lead.id)} aria-label={`Open lead: ${lead.learner || lead.family}`}>
                <View className="flex-row flex-wrap items-center justify-between gap-element rounded-card border-2 border-border bg-surface-raised p-inset shadow-card">
                  <View className="min-w-0 flex-1 gap-0">
                    <Text className="text-body font-semibold text-text">
                      {lead.learner || lead.family}
                    </Text>
                    <Text className="text-caption text-text-muted">
                      {lead.subject || '—'} · {lead.value}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-element">
                    {lead.needsAttention ? <Badge label="Needs attention" tone="attention" /> : null}
                    <Badge label={lead.stage} tone={STAGE_TONE[lead.stage]} />
                  </View>
                </View>
              </Link>
            ))}
          </View>
        )}
      </View>

      {family.learnerRefs.length > 0 ? (
        <View className="gap-stack">
          <SectionHeader title="Learner references" count={String(family.learnerRefs.length)} />
          {/*
            Displayed AS refs, never resolved (the wall — org.crm contract,
            doc 23 §2): no name lookup, no link, no join. The caption says so
            in the interface's voice, because a bare id would otherwise read
            as a bug rather than a boundary.
          */}
          <View className="gap-element rounded-card border-2 border-border bg-surface-sunken p-inset">
            {family.learnerRefs.map((ref) => (
              <Text key={ref} className="font-mono text-data text-text">
                {ref}
              </Text>
            ))}
            <Text className="text-caption text-text-muted">
              References only — learning data never appears on a CRM record.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function FamilyDetailScreen({ familyId }: { familyId: string }) {
  const { detail, status } = useFamily(familyId);

  if (status === 'pending') {
    return <LoadingSkeleton count={4} className="m-inset" />;
  }

  if (detail === null && status !== 'error') {
    /*
      The classes silent-drop idiom: a foreign family and a missing family both
      resolve to null, so this copy must not distinguish them — a
      distinguishable refusal would be an oracle over which household ids exist.
    */
    return (
      <View className={GUTTER}>
        <EmptyState
          icon={<Text className="text-title">!</Text>}
          title="Family not available"
          description="This record was removed, or the link may be out of date."
          action={
            <Link href={familiesRootPath()}>
              <Button title="Back to families" variant="outline" />
            </Link>
          }
        />
      </View>
    );
  }

  if (status === 'error' || detail === null) {
    return (
      <View className={GUTTER}>
        <EmptyState
          icon={<Text className="text-title">!</Text>}
          title="Could not load this family"
          description="The record is stale, not gone. Try again in a moment."
          action={
            <Link href={familiesRootPath()}>
              <Button title="Back to families" variant="outline" />
            </Link>
          }
        />
      </View>
    );
  }

  return <FamilyRecordView family={detail.family} leads={detail.leads} />;
}

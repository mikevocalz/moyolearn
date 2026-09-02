'use client';
// Org Settings — the org rail's Settings destination (org.settings contract):
// identity and plan, read + display, owner/finance only. The read path was
// already deployed end to end — branding row, entitlement chain resolving
// org-context-first, PlanCard data-props-only — this surface mounts a screen
// on it and writes nothing.
//
// Out of scope WITH the blocker named (contract Notes): manage-plan, billing
// portal/history, payment method — no @better-auth/stripe mount exists
// (STRIPE_SECRET_KEY/WEBHOOK_SECRET absent from .env.example); payout status
// is blocked on the Stripe Connect absence that struck org.money. No dead
// buttons stand in for them (flow law).
// Mobbin: https://mobbin.com/screens/a7f61f34-7046-4595-8d87-18799b03bda0 (Sketch —
//   plan overview as labelled read-only rows: current plan with "Ends {date}",
//   a seats row, canceled state as a badge beside the billing date) ·
//   https://mobbin.com/screens/9db75eb8-1c86-4545-a091-89bd929555e4 (Twist —
//   "Billing for {org}": plan name, one billed-on sentence, seats laid out as
//   labelled facts) ·
//   https://mobbin.com/screens/f120e33f-ab77-431f-8608-8b633008a831 (Airwallex —
//   current-plan card leads with the plan mark, labelled facts beside it).
//   Structure only.
// SOT: design/screens/org/org.settings/contract.md · docs/38-front-door-and-flow.md §5B
// SOT-KEYWORDS: org settings content identity plan seats status owner finance role wall pw-05
import { useRouter } from 'solito/navigation';
import { Section, View, Text as TWText } from '@acme/ui/tw';
import { Avatar, Badge, Button, Card, FadeIn, Heading, LoadingSkeleton, PlanCard, Text } from '@acme/ui';
import { useAppSession } from '../../providers/session';
import { useEntitlements } from '../../providers/entitlements';
import type { SubscriptionState } from '@acme/auth';
import type { OrgSettingsRead } from './org-settings.service';
import { formatPeriodDate, PLAN_DISPLAY } from './org-settings.data';

export function OrgSettingsContent({ read }: { read: OrgSettingsRead }) {
  const router = useRouter();
  /*
    The role wall mirrors org.safety's denied card: a correct answer, never a
    broken screen — and never an upsell (the refusal is 403-shaped; there is
    nothing to sell). The rail already hides the item for these members, so
    this renders only on a direct URL hit.
  */
  if (read.state === 'denied') {
    return (
      /*
        The wall keeps the PAGE HEADING. It used to be a bare card floating in
        the content area, so on this branch /settings/org rendered no <h1> at
        all — the one route in the org rail with no heading in its outline, and
        the branch every member who is not owner or finance lands on. A refusal
        is a state of this page, not a different page.
      */
      <View className="gap-group">
        <Section className="gap-1">
          <Heading level={1} size="display-sm">Organization settings</Heading>
          <Text tone="muted">Your organization’s identity and plan.</Text>
        </Section>
        <Card className="gap-element">
          <Badge label="Owners and finance" tone="neutral" />
          <Text>These settings aren’t yours to read.</Text>
          <Text variant="caption" tone="muted">
            Organization settings are owner and finance work. Nothing is wrong with your account.
          </Text>
          {/* org.safety's no_data idiom: the wall carries a way out, because a
              correct refusal with no door is still a dead end. */}
          <View className="self-start">
            <Button title="Back to Overview" variant="outline" onPress={() => router.push('/ops')} />
          </View>
        </Card>
      </View>
    );
  }

  return (
    <View className="gap-group md:gap-10 lg:gap-12">
      <FadeIn>
        <Section className="gap-1">
          <Heading level={1} size="display-sm">Organization settings</Heading>
          <Text tone="muted">Your organization’s identity and plan, at a glance.</Text>
        </Section>
      </FadeIn>

      <FadeIn delay={80}>
        <IdentityCard read={read} />
      </FadeIn>

      <FadeIn delay={140}>
        <PlanSection />
      </FadeIn>
    </View>
  );
}

function IdentityCard({ read }: { read: Extract<OrgSettingsRead, { state: 'ok' }> }) {
  const { activeContext, memberships } = useAppSession();
  const org = read.org;
  /*
    The session's membership carries the org name even when the tenant key
    matches no Organizations row (the dev-persona shells are exactly that), so
    the card degrades to the name the switcher already shows rather than to a
    blank.
  */
  const membershipName = memberships.find((m) => m.orgId === activeContext.orgId)?.orgName;
  const name = org?.name ?? membershipName ?? 'Your organization';

  return (
    <Card className="gap-4">
      <View className="gap-1">
        <Text variant="heading">Identity</Text>
        <Text variant="caption" tone="muted">How Moyo shows your organization.</Text>
      </View>
      <View className="flex-row items-center gap-stack">
        <Avatar name={name} imageUri={org?.logoUrl} size="lg" />
        <View className="flex-1 gap-0.5">
          <TWText className="text-body-lg font-semibold text-text">{name}</TWText>
          {org ? (
            <TWText className="text-caption text-text-muted">{org.slug}</TWText>
          ) : (
            // An honest absence, not an error: the org exists in the member
            // table but has no Organizations row to brand from yet.
            <TWText className="text-caption text-text-muted">
              No branding record yet — tenants see Moyo’s own mark.
            </TWText>
          )}
        </View>
      </View>
      {org ? (
        <View className="gap-element">
          <FactRow label="Brand accent" value={org.brandAccent ?? 'Moyo default'} />
          <FactRow label="Theme" value={org.brandTheme ?? 'Moyo default'} />
        </View>
      ) : null}
    </Card>
  );
}

function PlanSection() {
  const { subscription, loaded } = useEntitlements();

  return (
    <Card className="gap-4">
      <View className="gap-1">
        <Text variant="heading">Plan</Text>
        <Text variant="caption" tone="muted">What your organization is on, and where it stands.</Text>
      </View>
      {!loaded ? (
        // Webhook truth has not arrived; guessing a plan state here is how a
        // paying org reads as unpaid for a frame (entitlement store law).
        <LoadingSkeleton variant="card" count={1} />
      ) : (
        <PlanSummary subscription={subscription} />
      )}
      <Text variant="caption" tone="muted">
        Plan changes, payment methods, and billing history aren’t managed here yet.
      </Text>
    </Card>
  );
}

function PlanSummary({ subscription }: { subscription: SubscriptionState }) {
  const { plan, status, periodEnd, seats } = subscription;

  if (!plan || status === 'none' || status === 'incomplete') {
    return (
      <View className="gap-1">
        <Text>No plan on record.</Text>
        <Text variant="caption" tone="muted">
          {status === 'incomplete'
            ? 'A subscription was started but its first payment never completed.'
            : 'This organization isn’t on a plan yet.'}
        </Text>
      </View>
    );
  }

  const display = PLAN_DISPLAY[plan];
  const endDate = periodEnd ? formatPeriodDate(periodEnd) : null;

  return (
    <View className="gap-stack">
      {/* Static (no onSelect) — PW-05's summary mode; nothing here is a chooser. */}
      <PlanCard
        name={display.title}
        price={display.price}
        period={display.period}
        tier="business"
        badge={status === 'trialing' ? 'Trial' : undefined}
        trialLine={status === 'trialing' && endDate ? `Free month ends ${endDate}` : undefined}
      />

      {/* Doc 38 §5B's status → treatment table, display only. */}
      {status === 'active' && endDate ? <FactRow label="Next payment" value={endDate} /> : null}
      {status === 'canceled' ? (
        <View className="gap-1">
          {/* "· Resume" waits for the Stripe mount — a resume affordance with
              nothing behind it would be a designed dead end (flow law). */}
          <FactRow label="Plan ends" value={endDate ?? 'at the period’s end'} />
          <Text variant="caption" tone="muted">
            Everything stays readable and exportable after that — nothing you’ve set up is lost.
          </Text>
        </View>
      ) : null}
      {status === 'past_due' ? (
        // Non-blocking by design: past_due keeps writing (entitlements.ts) and
        // this banner never locks the org out of its own settings.
        <View className="gap-element rounded-card border-2 border-border bg-surface-sunken p-inset">
          <Badge label="Payment issue" tone="attention" />
          <Text>
            {endDate
              ? `Your last payment didn’t go through. Access continues while it retries, through ${endDate}.`
              : 'Your last payment didn’t go through. Access continues while it retries.'}
          </Text>
        </View>
      ) : null}

      {seats !== null ? <FactRow label="Seats" value={`${seats}`} /> : null}
    </View>
  );
}

/** Labelled read-only row — the Sketch/Airwallex fact-row bone. */
function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-baseline justify-between gap-element">
      <TWText className="text-caption text-text-muted">{label}</TWText>
      <TWText className="text-body text-text">{value}</TWText>
    </View>
  );
}

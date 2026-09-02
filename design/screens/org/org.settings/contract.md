# Flow Contract — org.settings

```yaml
screen_id: org.settings
role: owner (owner-gated; finance organizationRole authorizes too — BILLING_ROLES, billing-plans.ts; the same pair org.money's contract named, E matrix)
tenant: [org]
band: n/a
shell: org (web-first by design — Settings rail group per doc 36 §3.4's grouping `Overview · CRM · Scheduling · Money · Safety · Settings`; NO mobile tab: the mobile companion is Overview·Schedule·Inbox·Safety only)
entry_points:
  - "rail: Settings group (web — `Org settings` item at /settings/org; renders for owner/finance only per org.overview's contract line 'Money and Settings rail items render for owner/finance only (billing-plans authorize)')"
  - "push: from org.overview 'settings' rail jump"
answers_within_5s:
  - "What is this organization's identity (name, logo, brand) as tenants see it?"
  - "What plan is the org on, and is it in good standing?"
  - "When is the next payment / when does the period end, and how many seats does the plan carry?"
primary_action: "Read the plan summary — status, period end, seats (display only; nothing on this surface writes)"
secondary_actions: []
exits:
  back_overview: org.overview
completion_returns_to: self (a read-only summary is its own completion)
back_behavior: "Rail destination → previous rail destination (browser history). Never traps."
failure_paths:
  offline: "identity renders from the server-rendered page; plan card falls back to the loading skeleton until the entitlement store loads — no cached-money guesses"
  no_data: "no subscription row for the org → honest 'No plan on record' state, not a zeroed card and not an upsell (a 403-shaped surface never becomes a paywall — membership-gate.ts law)"
  permission: "staff without owner/finance authorization: the rail item does not render (silent absence, same treatment as the rail), and a direct URL hit gets the role-wall card mirroring org.safety's denied precedent — a correct answer, never a broken screen, never an upsell. Server-side the read runs behind `requiresMembership: BILLING_ROLES`."
cross_role_propagation:
  - "Nothing propagates. Identity and plan are read here and written nowhere; plan truth arrives via the entitlement chain (webhook → subscription row → /api/entitlements) that every gate already reads."
cross_device_continuity: "Server truth end to end (branding row + subscription projection); web-only surface, nothing to reconcile."
max_interactions_to_primary: 0 (the summary IS the landing render)
state_owner: "Existing, deliberately nothing new: server page passes the branding read (org.repository loadOrgBranding via the gated org-settings service); plan/status/periodEnd/seats come from useEntitlementStore through useEntitlements (org-context-first referenceId). No org-settings store exists and none is added — a read-only projection owns no state."
```

**Status:** BUILT with this contract (the surface never had one — not a D-screen-inventory row of its own: D carries the plan surface as PW-05's org variant, `(org)/settings/plan` MISSING, and README's rule keeps PW-* contracts in doc 38 §5B. This contract covers the org **Settings rail destination** — identity + plan summary — which doc 36 §3.4's grouping mandates and nothing contracted). One page at `/settings/org`, not PW-05's two rows: the whole surface is read+display, and splitting a summary across `/settings` and `/settings/plan` would ship two half-screens. `/settings/org` rather than `/settings` because `(site)/settings/page.tsx` already serves the shared device-prefs page at `/settings`, and two route groups resolving one path fails the build (the exact collision the 2026-08-31 route consolidation fixed) — the flow law is "rendered href resolves", and it resolves.

**Notes:**
- **Scope is read + display, and the blocker is named:** Manage plan, billing portal, billing history, and payment method (PW-05's action rows, PW-08's portal) are OUT of scope — the `@better-auth/stripe` plugin mounts only when `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` are configured (`packages/auth/src/server.ts billingPlugin`), and neither appears in `.env.example`; there is no Stripe mount to hand a portal session from. PW-08's org payout-status row is blocked on the same Stripe Connect absence that struck org.money. When Stripe mounts, the action rows land on THIS surface per doc 38 §5B — no second settings screen.
- Status → treatment follows doc 38 §5B's entitlement-state table: `active` renders "Next payment {date}"; `past_due` renders the non-blocking payment-issue banner (access continues — entitlements.ts keeps `past_due` writing); `canceled` renders "Ends {date}" **display only** — the table's "· Resume" affordance needs the Stripe mount and does not render as a dead button (flow law).
- Seats widen the subscription projection by one field (`SubscriptionRow`/`SubscriptionState.seats`, from the plugin's own `Subscription.seats`); the row renders only when the subscription carries a number — no invented "0 of N".
- Plan display copy (title/price/period) is data beside the surface, paired to `PlanName` exactly as `PAYWALL_OFFERS` pairs S16's — prices from doc 05 §1.1's tier table, never hardcoded in the component (`PlanCard` stays data-props-only).
- Business tiers render here and only here on the org shell; nothing on this surface is reachable from a learner or guardian context (PW-03b/FR-11.2 walls hold by construction — the route sits behind the org role guard).
- Mobbin (structure only): [Sketch](https://mobbin.com/screens/a7f61f34-7046-4595-8d87-18799b03bda0) — plan overview as labelled read-only rows: current plan + "Ends {date}", seats row, canceled state as a badge beside the billing date · [Twist](https://mobbin.com/screens/9db75eb8-1c86-4545-a091-89bd929555e4) — "Billing for {org}": plan name, one billed-on sentence, seats table · [Airwallex](https://mobbin.com/screens/f120e33f-ab77-431f-8608-8b633008a831) — current-plan card leading with the plan mark, labelled facts (renews-on, seats in use) beside it · doc 38 §5B's own PW-05 pulls ([GoodRx](https://mobbin.com/screens/440942f2-dd10-41d9-9182-362b71f00591), [Deezer](https://mobbin.com/screens/c075f474-7c8b-4bc1-ba0a-93027321515d)) for plan + next-date as primary rows.

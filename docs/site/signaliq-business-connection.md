# Moyo adult inquiries → SignalIQ

SOT: `apps/web/lib/marketing/` · `packages/payload/migrations/signaliq_marketing_additive.sql` · `packages/auth/src/billing-payment.ts`

## What enters the connection

The public form on `/for-schools#request-demo` saves an adult's request in Moyo's own sales inbox. `/contact` links to that form. The visitor must affirm adulthood and permission for Moyo to answer. Sharing the inquiry and its business follow-ups with SignalIQ is a separate optional choice, initially off. No student field, learning history, household export, session transcript or freeform message is accepted.

This is Moyo's platform sales intake. A tutoring business's existing `families`, `leads`, enrollments and sessions belong to that customer's tenant. Those records are not a platform marketing prospect list and are not copied into Moyo's SignalIQ workspace.

| Actual Moyo source                                                   | SignalIQ fact                                                        | Limitation                                                                                                                                                     |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Consented adult website inquiry                                      | Known contact inquiry; explicit school/business organization context | Organization is submitted and unverified. Email domain never proves employment. Family inquiries have no company.                                              |
| Moyo owner records a discovery-call appointment                      | Booking event linked to the original inquiry                         | This saves a business appointment record. It does not send a calendar invitation or claim a tutoring session occurred.                                         |
| Moyo owner records contacted, pilot started, proposal sent or closed | Business progress linked to the inquiry                              | These are owner attestations. They are not student progress or automatic proof of a sale.                                                                      |
| Better Auth's signature-verified Stripe `invoice.paid` callback      | Paid subscription invoice amount/currency and time                   | Requires an explicit link to a real organization or verified adult billing reference. A client cannot submit payment events.                                   |
| Owner withdraws inquiry and sharing                                  | Source-scoped consent suppression                                    | Stops queued payloads and suppresses processing in SignalIQ, including an inquiry whose prior delivery response was lost. This is not a full data-erasure API. |

SignalIQ source configuration determines the destination pipeline and which booking/order meanings move a deal's stage. New company and deal population requires that server-side source grant; a website analytics key cannot supply it. The browser tracker in PR152 remains separate: consented anonymous visits on `/for-schools` do not identify a person or imply a booked call.

## Source identifiers and truthful delivery state

`moyo.inquiry:<inquiry UUID>` is the stable inquiry source ID. Booking/progress use the persisted update request UUID. Paid invoices use `moyo.invoice:<Stripe invoice ID>`. Every descendant carries the original `inquirySourceId`. `sourceRef` is a bounded internal `record:<UUID>`, without email or student data.

The inquiry and outbox insert commit together. Repeating the exact request ID and payload returns the same saved inquiry. Reusing that ID with changed fields is a conflict. Recording business progress is likewise idempotent. A timeout preserves the same source ID and payload for retry.

The outbox distinguishes:

- `pending`: no confirmed remote acceptance yet.
- `accepted`: SignalIQ saved the event, but downstream processing remains queued.
- `delivered`: SignalIQ returned `processed`, or acknowledged the specific withdrawal request.
- `blocked`: configuration, authorization, consent or source processing needs attention.
- `failed`: delivery retries were exhausted or a stored payload is invalid.

The sender polls the private receipt endpoint for accepted events. A queued receipt is never labeled delivered. Booking and payment events wait until their parent inquiry has a processed receipt. Withdrawal bypasses that dependency so it can create a remote tombstone even before an inquiry arrives. Row locks serialize sending with withdrawal; delivered or withdrawn outbox payloads no longer retain the adult contact fields. Failed consent suppression remains visible and can be retried.

## Moyo owner's workflow

Open `/marketing-inquiries` on `app.moyolearn.com` while using the configured Moyo sales organization. The backend requires a real owner or manager membership, rejects learner identities and rejects every other organization. The existing business role shell is an additional UI boundary.

The inbox shows the latest 100 adult requests, optional sharing choice, delivery counts, safe error codes and last confirmed delivery. It supports recording a scheduled discovery call, business progress, linking an actual subscription and retrying delivery after configuration is fixed. Business updates retain the existing paid write gate. Reading/exporting and withdrawing consent retain the existing free export floor, including after a plan expires. Withdrawal can also retry a previously failed suppression without a paid write entitlement.

Link billing with the actual Better Auth subscription `referenceId`. For an organization, that ID must exist in the canonical organization table. For an individual, the account email must match the inquiry and be verified; managed learner and minor accounts are refused. A Stripe customer ID supplied by a browser is never trusted. One customer can link to only one inquiry in the Moyo sales organization.

The verified webhook persists a minimal local receipt (invoice ID, customer ID, amount, currency, paid time and live/test flag) so an invoice arriving before the explicit link is not lost. The link and receipt ingestion share a transaction lock. Only a consented linked inquiry yields a SignalIQ order; raw invoice bodies, customer addresses, line items and payment credentials are never copied. Test-mode invoices do not enter production. Existing historic invoices predating this connection are not fabricated or silently backfilled. Newly submitted events more than 30 days old can be rejected by SignalIQ; their actual date must never be rewritten to bypass that rule.

## Deployment contract

There are two applications. Publishing the Vite marketing app alone does not publish the Next/Payload intake API, inbox or worker. Deploy the reviewed Next app and schema first, then the marketing form. Verify each resulting production SHA independently.

Server-only settings for the Next `moyo-app` project:

| Setting                                                                | Meaning                                                                                                      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                         | Existing canonical Moyo database connection; never export it to client variables.                            |
| `MOYO_MARKETING_ORG_ID`                                                | Verified Moyo-owned sales organization ID; not a customer's tenant.                                          |
| `MOYO_MARKETING_ALLOWED_ORIGINS`                                       | Exact HTTPS form origins, comma-separated; default `https://www.moyolearn.com`.                              |
| `MOYO_MARKETING_RATE_SECRET`                                           | Random private HMAC key for hourly request limiting. Raw IP addresses are not retained.                      |
| `SIGNALIQ_BUSINESS_ENDPOINT`                                           | Exact HTTPS `/api/ingest/v1/business-events` endpoint.                                                       |
| `SIGNALIQ_BUSINESS_KEY`                                                | Private `write_server` credential for the approved Moyo source. Never use a `VITE_`/`NEXT_PUBLIC_` variable. |
| `CRON_SECRET`                                                          | Existing private Vercel cron credential.                                                                     |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, existing price variables | Existing Better Auth billing setup; its live endpoint must include `invoice.paid`.                           |

`apps/web/vercel.json` schedules `/api/marketing/sync` once per minute. Confirm the deployed Vercel plan accepts this schedule. The handler checks `CRON_SECRET`, bounds each run to three deliveries, waits at most six seconds per network request and backs off failures. No public route can manually drain the queue. If a deployment's plan cannot run this cadence, use an authorized existing scheduler against the same private handler; do not claim minute delivery or silently upgrade a paid plan.

The intake checks exact Origin, JSON content type, an 8 KiB body ceiling, strict schema and five new requests per hashed address per hour. Duplicate exact requests do not spend another limit. CORS does not grant reads. The endpoint always chooses its tenant from deployment configuration. Missing configuration fails visibly rather than reporting a saved inquiry. The form preserves entered values after failure and reuses its request ID on retry.

## Reviewed release commands

Run these inside the existing Next deployment environment. Credentials remain in that environment, not in logs or an exported env file:

```sh
node --import tsx apps/web/scripts/marketing-migrate.mts --preflight
node --import tsx apps/web/scripts/marketing-migrate.mts --billing-preflight
node --import tsx apps/web/scripts/marketing-migrate.mts --apply
```

If the working directory is `apps/web`, use `scripts/marketing-migrate.mts` instead. `--preflight` requires `MOYO_MARKETING_OWNER_EMAIL` and reads only that exact verified adult account's owner/manager organizations and entitlement status. It changes nothing. `--billing-preflight` reads only the authenticated Stripe account ID, webhook configuration matching the exact Moyo app endpoint, and one configured OPS price's currency/live flag. It changes nothing and prints no customer, invoice or credential data. The catalog deliberately stores environment price IDs rather than a hardcoded currency; source pipeline currency must match this actual configured price.

`--apply` executes the committed additive SQL in one transaction with a schema lock. It creates five restricted tables and can be repeated. RLS is enabled; PUBLIC and existing Supabase `anon`/`authenticated` table grants are revoked. Only the existing trusted database server role may operate them. The script does not create users, organizations, memberships, subscriptions or customer records. A production deployment is not verified until the schema, tenant selection, private source grant, billing endpoint and actual scheduler have all been checked.

## Verification

`pnpm --filter web marketing:test` checks strict projection and transport behavior. `pnpm --filter @acme/auth test` includes the minimal invoice projection. `pnpm --filter web marketing:test:db` requires a dedicated localhost database named `moyo_test` through `MOYO_MARKETING_TEST_DATABASE_URL`; it refuses other targets. The database suite applies the actual Better Auth schema and additive marketing migration, exercises concurrent idempotency, tenant/learner/plan gates, queue receipts, timeout then withdrawal, verified invoice linking, input limits and public database grants. Fixtures are explicitly synthetic and confined to that isolated database.

Do not seed production customers to make SignalIQ look populated. Verify source readiness with setup diagnostics and actual production receipts, and label any authorized synthetic end-to-end fixture explicitly.

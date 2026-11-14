-- Adult public Moyo inquiries and their transactional delivery ledger.
-- SOT: docs/site/signaliq-business-connection.md
-- SOT-KEYWORDS: marketing signaliq inquiry outbox additive schema consent
-- No learner, household, session-content or raw payment records are copied.
CREATE TABLE IF NOT EXISTS payload.marketing_inquiries (
  id uuid PRIMARY KEY, org_id varchar NOT NULL, request_id uuid NOT NULL,
  request_fingerprint varchar NOT NULL, contact_name varchar(200) NOT NULL,
  email varchar(320) NOT NULL, audience varchar NOT NULL CHECK (audience IN ('school','tutoring-business','parent')),
  organization_name varchar(200) NOT NULL DEFAULT '', organization_domain varchar(253) NOT NULL DEFAULT '',
  contact_consent_at timestamptz NOT NULL, signal_consent boolean NOT NULL,
  withdrawn_at timestamptz, stripe_customer_id varchar, billing_reference_id varchar,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(org_id, request_id), UNIQUE(org_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_inquiries_billing_key
  ON payload.marketing_inquiries(org_id,stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS payload.marketing_updates (
  id uuid PRIMARY KEY, org_id varchar NOT NULL, inquiry_id uuid NOT NULL, actor_id varchar NOT NULL,
  action varchar NOT NULL, request_fingerprint varchar NOT NULL, scheduled_at timestamptz, stage varchar,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(org_id,inquiry_id) REFERENCES payload.marketing_inquiries(org_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS payload.marketing_outbox (
  id uuid PRIMARY KEY, org_id varchar NOT NULL, inquiry_id uuid NOT NULL, source_id varchar(200) NOT NULL,
  operation varchar NOT NULL DEFAULT 'business-event' CHECK(operation IN ('business-event','withdrawal')),
  event jsonb, state varchar NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','accepted','delivered','blocked','failed')),
  source_event_id uuid, attempts integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
  error_code varchar, created_at timestamptz NOT NULL DEFAULT now(), delivered_at timestamptz,
  UNIQUE(org_id,source_id), FOREIGN KEY(org_id,inquiry_id) REFERENCES payload.marketing_inquiries(org_id,id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS marketing_outbox_due ON payload.marketing_outbox(org_id,next_attempt_at) WHERE state IN ('pending','accepted');
CREATE TABLE IF NOT EXISTS payload.marketing_rate_limits (
  key varchar PRIMARY KEY, window_start timestamptz NOT NULL, attempts integer NOT NULL
);
CREATE TABLE IF NOT EXISTS payload.marketing_verified_payments (
  id varchar NOT NULL,org_id varchar NOT NULL,customer_id varchar NOT NULL,
  amount_cents integer NOT NULL CHECK(amount_cents>0),currency varchar(3) NOT NULL,
  occurred_at timestamptz NOT NULL,live boolean NOT NULL,PRIMARY KEY(org_id,id)
);
CREATE INDEX IF NOT EXISTS marketing_verified_payment_customer ON payload.marketing_verified_payments(org_id,customer_id);
-- No public Supabase access: these tables belong to the existing server DB role.
ALTER TABLE payload.marketing_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payload.marketing_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE payload.marketing_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE payload.marketing_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE payload.marketing_verified_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON payload.marketing_inquiries,payload.marketing_updates,payload.marketing_outbox,payload.marketing_rate_limits,payload.marketing_verified_payments FROM PUBLIC;
-- Supabase schemas may have standing grants to these API roles. Revoke those
-- explicitly too, while allowing isolated PostgreSQL tests without those roles.
DO $$ DECLARE api_role text; BEGIN
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated') LOOP
    EXECUTE format('REVOKE ALL ON payload.marketing_inquiries,payload.marketing_updates,payload.marketing_outbox,payload.marketing_rate_limits,payload.marketing_verified_payments FROM %I',api_role);
  END LOOP;
END $$;

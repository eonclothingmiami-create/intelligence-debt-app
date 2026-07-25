-- Financial OS event store (NOT ERP). Engines/UI never query public.* ventas.
CREATE SCHEMA IF NOT EXISTS fie_os;

COMMENT ON SCHEMA fie_os IS 'Business Financial OS — domain events only. Source of truth for sales remains Hera ERP (public.*); this schema is a read-model ingress copy.';

CREATE TABLE IF NOT EXISTS fie_os.domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text NOT NULL DEFAULT 'ventas-hera',
  event_type text NOT NULL,
  external_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  currency text NOT NULL DEFAULT 'COP',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT domain_events_idempotency UNIQUE (provider_id, event_type, external_id)
);

CREATE INDEX IF NOT EXISTS domain_events_occurred_at_idx ON fie_os.domain_events (occurred_at);
CREATE INDEX IF NOT EXISTS domain_events_type_idx ON fie_os.domain_events (event_type);

REVOKE ALL ON SCHEMA fie_os FROM PUBLIC;
REVOKE ALL ON SCHEMA fie_os FROM anon, authenticated;
GRANT USAGE ON SCHEMA fie_os TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA fie_os TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA fie_os TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fie_os GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA fie_os GRANT ALL ON SEQUENCES TO service_role;

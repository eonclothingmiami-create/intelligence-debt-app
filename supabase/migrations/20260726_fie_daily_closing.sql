-- Daily Financial Closing — durable facts for the Business Financial OS.
-- Service role only (Edge). Never delete closings; edits go through audit + revision.

CREATE TABLE IF NOT EXISTS public.fie_closing_config (
  id text PRIMARY KEY DEFAULT 'default',
  series_start_date date NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Bogota',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fie_daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_day date NOT NULL,
  status text NOT NULL DEFAULT 'closed' CHECK (status = 'closed'),
  sales_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by text NOT NULL DEFAULT 'owner',
  revision integer NOT NULL DEFAULT 1,
  CONSTRAINT fie_daily_closings_business_day_unique UNIQUE (business_day)
);

CREATE INDEX IF NOT EXISTS fie_daily_closings_closed_at_idx
  ON public.fie_daily_closings (closed_at DESC);

CREATE TABLE IF NOT EXISTS public.fie_daily_closing_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.fie_daily_closings (id) ON DELETE RESTRICT,
  line_type text NOT NULL CHECK (
    line_type IN ('expense', 'obligation_payment', 'fixed_cost_payment', 'extraordinary')
  ),
  sort_order integer NOT NULL DEFAULT 0,
  concept text,
  category text,
  note text,
  obligation_id text,
  fixed_cost_id text,
  payment_kind text CHECK (
    payment_kind IS NULL
    OR payment_kind IN ('minimo', 'cuota', 'abono_extra', 'fixed_cost')
  ),
  base_amount numeric NOT NULL DEFAULT 0,
  late_interest_amount numeric NOT NULL DEFAULT 0,
  other_adjustment_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT 'outflow' CHECK (direction IN ('outflow', 'inflow')),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fie_daily_closing_lines_closing_idx
  ON public.fie_daily_closing_lines (closing_id);

CREATE TABLE IF NOT EXISTS public.fie_daily_closing_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closing_id uuid NOT NULL REFERENCES public.fie_daily_closings (id) ON DELETE RESTRICT,
  field_path text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text NOT NULL DEFAULT 'owner'
);

CREATE INDEX IF NOT EXISTS fie_daily_closing_audit_closing_idx
  ON public.fie_daily_closing_audit (closing_id, changed_at);

CREATE TABLE IF NOT EXISTS public.fie_fixed_cost_month_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fixed_cost_id text NOT NULL,
  year_month text NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),
  closing_id uuid NOT NULL REFERENCES public.fie_daily_closings (id) ON DELETE RESTRICT,
  closing_line_id uuid REFERENCES public.fie_daily_closing_lines (id) ON DELETE RESTRICT,
  base_amount numeric NOT NULL DEFAULT 0,
  late_interest_amount numeric NOT NULL DEFAULT 0,
  other_adjustment_amount numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  paid_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fie_fixed_cost_month_payments_unique UNIQUE (fixed_cost_id, year_month)
);

CREATE INDEX IF NOT EXISTS fie_fixed_cost_month_payments_ym_idx
  ON public.fie_fixed_cost_month_payments (year_month);

REVOKE ALL ON public.fie_closing_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.fie_daily_closings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.fie_daily_closing_lines FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.fie_daily_closing_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.fie_fixed_cost_month_payments FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.fie_closing_config TO service_role;
GRANT ALL ON public.fie_daily_closings TO service_role;
GRANT ALL ON public.fie_daily_closing_lines TO service_role;
GRANT ALL ON public.fie_daily_closing_audit TO service_role;
GRANT ALL ON public.fie_fixed_cost_month_payments TO service_role;

COMMENT ON TABLE public.fie_daily_closings IS 'Daily financial closing facts — never delete; edit via revision + audit.';
COMMENT ON TABLE public.fie_fixed_cost_month_payments IS 'Actual fixed-cost payments once per month (plan lives in BEP catalog).';

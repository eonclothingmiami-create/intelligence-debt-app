-- Allow new_obligation lines in daily manual movements register.
ALTER TABLE public.fie_daily_closing_lines DROP CONSTRAINT IF EXISTS fie_daily_closing_lines_line_type_check;
ALTER TABLE public.fie_daily_closing_lines ADD CONSTRAINT fie_daily_closing_lines_line_type_check CHECK (
  line_type IN ('expense', 'obligation_payment', 'fixed_cost_payment', 'extraordinary', 'new_obligation')
);

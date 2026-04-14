-- Leads marcados como excluded_from_reports saem do funil e deixam de entrar nas métricas de relatórios.
-- Finalizados (is_finished) continuam contando nos relatórios, mas não aparecem no pipeline.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS excluded_from_reports boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_excluded_from_reports
  ON public.leads (excluded_from_reports)
  WHERE excluded_from_reports = true;

COMMENT ON COLUMN public.leads.excluded_from_reports IS 'Quando true, o lead não aparece no pipeline nem nas contagens de relatórios/analytics (remoção administrativa das métricas).';

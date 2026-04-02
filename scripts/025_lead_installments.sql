-- Parcelas por lead: vencimento e data de pagamento para relatório por período (caixa / previsto / em aberto).

CREATE TABLE IF NOT EXISTS public.lead_installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_installments_lead_id ON public.lead_installments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_installments_due_date ON public.lead_installments(due_date);

COMMENT ON TABLE public.lead_installments IS 'Parcelas do negócio: due_date para previsto no período; paid_at para caixa no período';
COMMENT ON COLUMN public.lead_installments.paid_at IS 'Preenchido quando a parcela foi efetivamente recebida';

ALTER TABLE public.lead_installments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lead_installments_select_all" ON public.lead_installments FOR SELECT USING (true);
CREATE POLICY "lead_installments_insert_all" ON public.lead_installments FOR INSERT WITH CHECK (true);
CREATE POLICY "lead_installments_update_all" ON public.lead_installments FOR UPDATE USING (true);
CREATE POLICY "lead_installments_delete_all" ON public.lead_installments FOR DELETE USING (true);

-- Campos de pagamento para leads fechados ganhos:
-- permite separar o valor que entrou em caixa do valor provisionado.

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS payment_model TEXT
  CHECK (payment_model IN ('full', 'installments', 'entry_plus_installments')),
ADD COLUMN IF NOT EXISTS amount_received DECIMAL(12, 2),
ADD COLUMN IF NOT EXISTS installments_count INTEGER;

COMMENT ON COLUMN leads.payment_model IS 'Modelo de pagamento: full, installments, entry_plus_installments';
COMMENT ON COLUMN leads.amount_received IS 'Valor já recebido em caixa (USD)';
COMMENT ON COLUMN leads.installments_count IS 'Quantidade de parcelas quando aplicável';

-- Backfill para dados antigos: assumimos pagamento integral no fechamento.
UPDATE leads
SET payment_model = COALESCE(payment_model, 'full'),
    amount_received = COALESCE(amount_received, deal_value)
WHERE column_id = '18e042dc-27af-427f-8c38-4f24c3663f28'
  AND is_lost = false;

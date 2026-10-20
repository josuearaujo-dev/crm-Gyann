-- Contrato da venda: tipo MRR/TCV, duração e valor mensal.
-- deal_value continua sendo o TCV (valor cheio do contrato).

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS contract_type text,
ADD COLUMN IF NOT EXISTS contract_months integer,
ADD COLUMN IF NOT EXISTS mrr_value numeric(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_contract_type_check'
  ) THEN
    ALTER TABLE leads
    ADD CONSTRAINT leads_contract_type_check
    CHECK (contract_type IS NULL OR contract_type IN ('mrr', 'tcv'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_contract_months_check'
  ) THEN
    ALTER TABLE leads
    ADD CONSTRAINT leads_contract_months_check
    CHECK (contract_months IS NULL OR contract_months >= 1);
  END IF;
END $$;

COMMENT ON COLUMN leads.contract_type IS 'Tipo do contrato da venda: mrr (mensal) ou tcv (valor cheio)';
COMMENT ON COLUMN leads.contract_months IS 'Duração do contrato em meses';
COMMENT ON COLUMN leads.mrr_value IS 'Valor mensal (MRR). TCV fica em deal_value';

-- Adicionar campo de valor ao lead
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_value DECIMAL(12, 2) DEFAULT 0;

-- Criar view para valor potencial (leads em aberto - não finalizados)
CREATE OR REPLACE VIEW potential_value AS
SELECT 
  SUM(deal_value) as total_potential,
  COUNT(*) as total_leads
FROM leads
WHERE column_id IN (
  SELECT id FROM pipeline_columns 
  WHERE name NOT IN ('Fechado Ganho', 'Perdido', 'Cancelado')
);

-- Criar view para valor realizado (leads fechados ganhos)
CREATE OR REPLACE VIEW realized_value AS
SELECT 
  SUM(deal_value) as total_realized,
  COUNT(*) as total_closed
FROM leads
WHERE column_id IN (
  SELECT id FROM pipeline_columns 
  WHERE name = 'Fechado Ganho'
);

-- Garantir que a coluna existe
COMMENT ON COLUMN leads.deal_value IS 'Valor do negócio em dólares';

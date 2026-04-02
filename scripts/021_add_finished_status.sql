-- Adicionar campos para status "finalizado" nos leads
-- Um lead finalizado é quando não há resposta nem no primeiro contato

ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS is_finished boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS finished_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS finished_notes text;

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_leads_is_finished ON leads(is_finished) WHERE is_finished = true;

-- Criar view para calcular valor perdido (leads perdidos com deal_value)
CREATE OR REPLACE VIEW lost_value AS
SELECT 
  COUNT(*) FILTER (WHERE is_lost = true) as total_lost_leads,
  COALESCE(SUM(deal_value) FILTER (WHERE is_lost = true), 0) as total_lost_value
FROM leads
WHERE is_lost = true;

-- Comentários
COMMENT ON COLUMN leads.is_finished IS 'Lead finalizado sem resposta no primeiro contato';
COMMENT ON COLUMN leads.finished_at IS 'Data e hora em que o lead foi marcado como finalizado';
COMMENT ON COLUMN leads.finished_notes IS 'Observações sobre a finalização do lead';
COMMENT ON VIEW lost_value IS 'View que calcula o valor total perdido (soma de deal_value dos leads perdidos)';

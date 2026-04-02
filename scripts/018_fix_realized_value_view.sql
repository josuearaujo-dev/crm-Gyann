-- Corrigir view realized_value para usar o ID da coluna ao invés do nome
-- Pois o nome pode variar

-- Dropar a view antiga
DROP VIEW IF EXISTS realized_value;

-- Recriar usando o ID fixo da coluna "Fechado Ganho"
CREATE OR REPLACE VIEW realized_value AS
SELECT 
  COALESCE(SUM(deal_value), 0) as total_realized,
  COUNT(*) as total_closed
FROM leads
WHERE column_id = '18e042dc-27af-427f-8c38-4f24c3663f28' -- ID da coluna Fechado Ganho
  AND is_lost = false;

-- Comentário explicativo
COMMENT ON VIEW realized_value IS 'Valor total de negócios fechados ganhos (coluna específica de ID fixo)';

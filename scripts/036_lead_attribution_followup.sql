-- Classificação manual: follow-up vs reentrada de campanha.
-- Não altera created_at — usa attribution_at só para coorte no relatório.

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS attribution_type text,
ADD COLUMN IF NOT EXISTS attribution_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_attribution_type_check'
  ) THEN
    ALTER TABLE leads
    ADD CONSTRAINT leads_attribution_type_check
    CHECK (
      attribution_type IS NULL
      OR attribution_type IN ('follow_up', 'campaign_reentry')
    );
  END IF;
END $$;

COMMENT ON COLUMN leads.attribution_type IS
  'follow_up = time foi atrás do lead; campaign_reentry = voltou por campanha (conta na coorte via attribution_at)';
COMMENT ON COLUMN leads.attribution_at IS
  'Data usada no relatório como entrada da coorte quando attribution_type = campaign_reentry';

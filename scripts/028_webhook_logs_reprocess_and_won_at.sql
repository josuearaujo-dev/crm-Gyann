-- Amplia webhook_logs para auditoria e reprocessamento de leads
-- e adiciona won_at em leads para data real de fechamento ganho.

ALTER TABLE webhook_logs
ADD COLUMN IF NOT EXISTS received_source text,
ADD COLUMN IF NOT EXISTS failure_stage text,
ADD COLUMN IF NOT EXISTS error_code text,
ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES leads(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reprocessed_at timestamptz,
ADD COLUMN IF NOT EXISTS reprocessed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reprocessing_status text,
ADD COLUMN IF NOT EXISTS selected_source_id uuid REFERENCES lead_sources(id) ON DELETE SET NULL;

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS won_at timestamptz,
ADD COLUMN IF NOT EXISTS lost_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_webhook_logs_lead_id
ON webhook_logs(lead_id);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_received_source
ON webhook_logs(received_source);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_failure_stage
ON webhook_logs(failure_stage);

CREATE INDEX IF NOT EXISTS idx_leads_won_at
ON leads(won_at);

-- Usuários autenticados podem ver todos os logs (equipe compartilhada)
DROP POLICY IF EXISTS "webhook_logs_select_own" ON webhook_logs;
DROP POLICY IF EXISTS "webhook_logs_select_authenticated" ON webhook_logs;

CREATE POLICY "webhook_logs_select_authenticated" ON webhook_logs
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "webhook_logs_update_authenticated" ON webhook_logs;

CREATE POLICY "webhook_logs_update_authenticated" ON webhook_logs
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

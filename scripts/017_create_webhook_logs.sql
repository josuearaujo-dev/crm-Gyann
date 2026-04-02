-- Criar tabela para armazenar logs de webhooks
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES lead_sources(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  url TEXT NOT NULL,
  headers JSONB,
  query_params JSONB,
  body JSONB,
  ip_address TEXT,
  user_agent TEXT,
  status_code INTEGER,
  response JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index para buscar logs por fonte
CREATE INDEX IF NOT EXISTS idx_webhook_logs_source_id ON webhook_logs(source_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- RLS policies
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver logs das suas próprias fontes
CREATE POLICY "webhook_logs_select_own" ON webhook_logs
  FOR SELECT
  USING (
    source_id IN (
      SELECT id FROM lead_sources WHERE created_by = auth.uid()
    )
  );

-- Permitir inserção de logs (sem autenticação, já que vem de webhooks externos)
CREATE POLICY "webhook_logs_insert_all" ON webhook_logs
  FOR INSERT
  WITH CHECK (true);

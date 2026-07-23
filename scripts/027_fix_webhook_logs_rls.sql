-- Corrige RLS de webhook_logs: a policy antiga só mostrava logs
-- de fontes com created_by = auth.uid(), então a página ficava vazia
-- para usuários que não criaram a fonte (mesmo com logs no banco).

DROP POLICY IF EXISTS "webhook_logs_select_own" ON webhook_logs;
DROP POLICY IF EXISTS "webhook_logs_select_authenticated" ON webhook_logs;

CREATE POLICY "webhook_logs_select_authenticated" ON webhook_logs
  FOR SELECT
  TO authenticated
  USING (true);

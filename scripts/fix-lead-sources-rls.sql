-- Remove a política restritiva de INSERT
DROP POLICY IF EXISTS lead_sources_insert_admin ON lead_sources;

-- Cria nova política que permite usuários autenticados criarem lead_sources
CREATE POLICY lead_sources_insert_own ON lead_sources
  FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Atualiza política de UPDATE para permitir usuários atualizarem suas próprias fontes
DROP POLICY IF EXISTS lead_sources_update_admin ON lead_sources;

CREATE POLICY lead_sources_update_own ON lead_sources
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Atualiza política de DELETE para permitir usuários deletarem suas próprias fontes
DROP POLICY IF EXISTS lead_sources_delete_admin ON lead_sources;

CREATE POLICY lead_sources_delete_own ON lead_sources
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

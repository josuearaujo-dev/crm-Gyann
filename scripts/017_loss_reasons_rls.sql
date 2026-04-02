-- Políticas RLS para tabela loss_reasons
-- Permite que usuários autenticados gerenciem motivos de perda

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "loss_reasons_select_own" ON loss_reasons;
DROP POLICY IF EXISTS "loss_reasons_insert_own" ON loss_reasons;
DROP POLICY IF EXISTS "loss_reasons_update_own" ON loss_reasons;
DROP POLICY IF EXISTS "loss_reasons_delete_own" ON loss_reasons;

-- Habilitar RLS
ALTER TABLE loss_reasons ENABLE ROW LEVEL SECURITY;

-- SELECT: Usuários autenticados podem ver todos os motivos de perda
CREATE POLICY "loss_reasons_select_own" ON loss_reasons
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Usuários autenticados podem criar motivos de perda
CREATE POLICY "loss_reasons_insert_own" ON loss_reasons
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Usuários autenticados podem atualizar motivos de perda
CREATE POLICY "loss_reasons_update_own" ON loss_reasons
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Usuários autenticados podem deletar motivos de perda
CREATE POLICY "loss_reasons_delete_own" ON loss_reasons
  FOR DELETE
  TO authenticated
  USING (true);

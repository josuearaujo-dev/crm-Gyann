-- Corrigir políticas RLS da tabela pipeline_columns
-- Permitir que usuários autenticados criem, visualizem, atualizem e deletem suas próprias colunas

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Users can view their own pipeline columns" ON pipeline_columns;
DROP POLICY IF EXISTS "Users can create their own pipeline columns" ON pipeline_columns;
DROP POLICY IF EXISTS "Users can update their own pipeline columns" ON pipeline_columns;
DROP POLICY IF EXISTS "Users can delete their own pipeline columns" ON pipeline_columns;

-- Garantir que RLS está ativo
ALTER TABLE pipeline_columns ENABLE ROW LEVEL SECURITY;

-- Política para SELECT - usuários podem ver suas próprias colunas
CREATE POLICY "Users can view their own pipeline columns"
ON pipeline_columns
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
);

-- Política para INSERT - usuários podem criar colunas
CREATE POLICY "Users can create their own pipeline columns"
ON pipeline_columns
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

-- Política para UPDATE - usuários podem atualizar suas próprias colunas
CREATE POLICY "Users can update their own pipeline columns"
ON pipeline_columns
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
)
WITH CHECK (
  created_by = auth.uid()
);

-- Política para DELETE - usuários podem deletar suas próprias colunas
CREATE POLICY "Users can delete their own pipeline columns"
ON pipeline_columns
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
);

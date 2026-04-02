-- Corrigir política de inserção na tabela lead_sources
-- Permitir que usuários autenticados criem novas fontes de leads

-- Remover política antiga se existir
DROP POLICY IF EXISTS "Users can insert their own lead sources" ON lead_sources;

-- Criar nova política de inserção
CREATE POLICY "Users can insert their own lead sources"
ON lead_sources
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

-- Verificar se a política de select existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lead_sources' 
    AND policyname = 'Users can view their own lead sources'
  ) THEN
    CREATE POLICY "Users can view their own lead sources"
    ON lead_sources
    FOR SELECT
    TO authenticated
    USING (created_by = auth.uid());
  END IF;
END $$;

-- Verificar se a política de update existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lead_sources' 
    AND policyname = 'Users can update their own lead sources'
  ) THEN
    CREATE POLICY "Users can update their own lead sources"
    ON lead_sources
    FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- Verificar se a política de delete existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'lead_sources' 
    AND policyname = 'Users can delete their own lead sources'
  ) THEN
    CREATE POLICY "Users can delete their own lead sources"
    ON lead_sources
    FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());
  END IF;
END $$;

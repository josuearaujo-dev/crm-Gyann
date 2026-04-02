-- Criar tabela de categorias de tags
CREATE TABLE IF NOT EXISTS tag_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Popular com categorias padrão
INSERT INTO tag_categories (name, prefix, description) VALUES
  ('Qualificação', 'QUAL_', 'Tags relacionadas ao nível de qualificação do lead'),
  ('Temperatura', 'TEMP_', 'Tags relacionadas ao interesse e engajamento do lead'),
  ('Contato', 'CONT_', 'Tags relacionadas a tentativas de contato'),
  ('Follow Up', 'FU_', 'Tags relacionadas a follow-ups e próximos passos');

-- Adicionar coluna category_id na tabela tags
ALTER TABLE tags ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES tag_categories(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_tags_category_id ON tags(category_id);

-- Habilitar RLS
ALTER TABLE tag_categories ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para tag_categories
-- Usuários autenticados podem ver todas as categorias
CREATE POLICY "Users can view all tag categories"
  ON tag_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- Usuários autenticados podem criar categorias
CREATE POLICY "Users can create tag categories"
  ON tag_categories
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Usuários podem atualizar suas próprias categorias
CREATE POLICY "Users can update own tag categories"
  ON tag_categories
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Usuários podem deletar suas próprias categorias
CREATE POLICY "Users can delete own tag categories"
  ON tag_categories
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

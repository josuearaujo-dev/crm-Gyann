-- Criar tabela de templates de tasks
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_task_templates_created_by ON task_templates(created_by);

-- RLS Policies
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Usuários autenticados podem ver seus próprios templates
CREATE POLICY "Users can view their own task templates"
  ON task_templates FOR SELECT
  USING (auth.uid() = created_by);

-- Policy: Usuários autenticados podem criar templates
CREATE POLICY "Users can create task templates"
  ON task_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Policy: Usuários podem atualizar seus próprios templates
CREATE POLICY "Users can update their own task templates"
  ON task_templates FOR UPDATE
  USING (auth.uid() = created_by);

-- Policy: Usuários podem deletar seus próprios templates
CREATE POLICY "Users can delete their own task templates"
  ON task_templates FOR DELETE
  USING (auth.uid() = created_by);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_task_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_task_templates_updated_at();

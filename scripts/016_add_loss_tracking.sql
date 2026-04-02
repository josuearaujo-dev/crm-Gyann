-- Criar tabela de motivos de perda
CREATE TABLE IF NOT EXISTS loss_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar campos de perda na tabela leads
ALTER TABLE leads 
  ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS loss_reason_id UUID REFERENCES loss_reasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS loss_notes TEXT,
  ADD COLUMN IF NOT EXISTS lost_at TIMESTAMPTZ;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_leads_is_lost ON leads(is_lost);
CREATE INDEX IF NOT EXISTS idx_leads_loss_reason_id ON leads(loss_reason_id);
CREATE INDEX IF NOT EXISTS idx_loss_reasons_created_by ON loss_reasons(created_by);

-- RLS para loss_reasons
ALTER TABLE loss_reasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own loss_reasons" ON loss_reasons;
CREATE POLICY "Users can view own loss_reasons" ON loss_reasons
  FOR SELECT USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can insert own loss_reasons" ON loss_reasons;
CREATE POLICY "Users can insert own loss_reasons" ON loss_reasons
  FOR INSERT WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update own loss_reasons" ON loss_reasons;
CREATE POLICY "Users can update own loss_reasons" ON loss_reasons
  FOR UPDATE USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own loss_reasons" ON loss_reasons;
CREATE POLICY "Users can delete own loss_reasons" ON loss_reasons
  FOR DELETE USING (created_by = auth.uid());

-- Inserir motivos padrão de perda
INSERT INTO loss_reasons (name, description, created_by)
SELECT 
  'Preço muito alto', 
  'O cliente considerou o preço acima do orçamento',
  auth.uid()
WHERE NOT EXISTS (SELECT 1 FROM loss_reasons WHERE name = 'Preço muito alto');

INSERT INTO loss_reasons (name, description, created_by)
SELECT 
  'Escolheu concorrente', 
  'O cliente optou por uma solução da concorrência',
  auth.uid()
WHERE NOT EXISTS (SELECT 1 FROM loss_reasons WHERE name = 'Escolheu concorrente');

INSERT INTO loss_reasons (name, description, created_by)
SELECT 
  'Não está interessado', 
  'O cliente perdeu o interesse na solução',
  auth.uid()
WHERE NOT EXISTS (SELECT 1 FROM loss_reasons WHERE name = 'Não está interessado');

INSERT INTO loss_reasons (name, description, created_by)
SELECT 
  'Timing ruim', 
  'Não é o momento certo para o cliente',
  auth.uid()
WHERE NOT EXISTS (SELECT 1 FROM loss_reasons WHERE name = 'Timing ruim');

INSERT INTO loss_reasons (name, description, created_by)
SELECT 
  'Sem orçamento', 
  'O cliente não tem orçamento disponível',
  auth.uid()
WHERE NOT EXISTS (SELECT 1 FROM loss_reasons WHERE name = 'Sem orçamento');

INSERT INTO loss_reasons (name, description, created_by)
SELECT 
  'Não qualificado', 
  'O lead não era qualificado para o produto/serviço',
  auth.uid()
WHERE NOT EXISTS (SELECT 1 FROM loss_reasons WHERE name = 'Não qualificado');

INSERT INTO loss_reasons (name, description, created_by)
SELECT 
  'Sem resposta', 
  'O cliente não respondeu às tentativas de contato',
  auth.uid()
WHERE NOT EXISTS (SELECT 1 FROM loss_reasons WHERE name = 'Sem resposta');

INSERT INTO loss_reasons (name, description, created_by)
SELECT 
  'Outro motivo', 
  'Motivo não especificado acima',
  auth.uid()
WHERE NOT EXISTS (SELECT 1 FROM loss_reasons WHERE name = 'Outro motivo');

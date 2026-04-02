-- Criar tabela de lembretes de reuniões
CREATE TABLE IF NOT EXISTS meeting_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL, -- Quantos minutos antes da reunião enviar
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  webhook_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_meeting_reminders_meeting_id ON meeting_reminders(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_reminders_sent ON meeting_reminders(sent) WHERE sent = FALSE;

-- RLS Policies
ALTER TABLE meeting_reminders ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver todos os lembretes
CREATE POLICY "Users can view all meeting reminders"
  ON meeting_reminders FOR SELECT
  TO authenticated
  USING (true);

-- Usuários autenticados podem criar lembretes
CREATE POLICY "Users can insert meeting reminders"
  ON meeting_reminders FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Usuários autenticados podem atualizar lembretes
CREATE POLICY "Users can update meeting reminders"
  ON meeting_reminders FOR UPDATE
  TO authenticated
  USING (true);

-- Usuários autenticados podem deletar lembretes
CREATE POLICY "Users can delete meeting reminders"
  ON meeting_reminders FOR DELETE
  TO authenticated
  USING (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_meeting_reminders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meeting_reminders_updated_at
  BEFORE UPDATE ON meeting_reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_reminders_updated_at();

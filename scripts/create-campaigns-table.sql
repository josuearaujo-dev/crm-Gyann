-- Criar tabela de campanhas
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  budget numeric(10,2) NOT NULL DEFAULT 0,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_select_all" ON campaigns
  FOR SELECT USING (true);

CREATE POLICY "campaigns_insert_own" ON campaigns
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "campaigns_update_own" ON campaigns
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "campaigns_delete_own" ON campaigns
  FOR DELETE USING (auth.uid() = created_by);
